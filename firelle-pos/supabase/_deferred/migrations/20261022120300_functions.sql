-- ============================================================================
-- 04 / Business functions (SECURITY DEFINER, search_path pinned)
--
-- Error contract (custom SQLSTATE / message):
--   FR001 INSUFFICIENT_STOCK
--   FR002 PRODUCT_ARCHIVED
--   FR003 PRICE_CHANGED
--   FR004 DISCOUNT_EXCEEDS_SUBTOTAL
--   FR005 INSUFFICIENT_PAYMENT
--   FR006 ALREADY_VOID
--   FR007 INVALID_QUANTITY
--   FR008 EMPTY_CART
--   FR009 UNAUTHENTICATED / FORBIDDEN / IDEMPOTENCY_KEY_CONFLICT
--   FR010 INVALID_ADJUSTMENT
--   FR011 TRANSACTION_NOT_FOUND
--   FR012 INVALID_ITEM
--   FR013 PRODUCT_NOT_FOUND
--   FR014 IMMUTABLE_CASHFLOW
--   FR015 INVALID_IDEMPOTENCY_KEY
--   FR016 INVALID_AMOUNT
--   FR017 CLIENT_NOT_FOUND
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Role helper: null when unauthenticated, unknown, or deactivated.
-- ----------------------------------------------------------------------------
create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select u.role
  from public.users u
  where u.id = auth.uid()
    and u.is_active;
$$;

comment on function public.current_role() is
  'Role of the authenticated user, or NULL when not signed in / inactive.';

-- ----------------------------------------------------------------------------
-- next_invoice_number(date): INV-YYYYMMDD-0001, resets every business date.
-- ON CONFLICT ... DO UPDATE takes a row lock, so concurrent callers get
-- distinct numbers.
-- ----------------------------------------------------------------------------
create or replace function public.next_invoice_number(p_date date default current_date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq integer;
  v_prefix text;
begin
  if p_date is null then
    raise exception using errcode = 'FR016', message = 'INVALID_AMOUNT',
      detail = 'Invoice date may not be null.';
  end if;

  insert into public.invoice_counters as ic (invoice_date, last_number)
  values (p_date, 1)
  on conflict (invoice_date) do update
    set last_number = ic.last_number + 1,
        updated_at = now()
  returning ic.last_number into v_seq;

  select s.invoice_prefix into v_prefix
  from public.settings s
  where s.singleton;

  return format(
    '%s-%s-%s',
    coalesce(v_prefix, 'INV'),
    to_char(p_date, 'YYYYMMDD'),
    lpad(v_seq::text, 4, '0')
  );
end;
$$;

comment on function public.next_invoice_number(date) is
  'Daily-reset invoice sequence: PREFIX-YYYYMMDD-NNNN.';

-- ----------------------------------------------------------------------------
-- create_transaction
--
-- p_items: JSON array of:
--   { "product_id": uuid, "qty": numeric,
--     "unit_price": numeric (optional; if present it must match DB price),
--     "discount_amount": numeric (optional, per-line) }
--
-- Prices and costs are always re-read from products. Product rows are locked
-- in id order before stock is checked, which serializes the last-unit race.
-- ----------------------------------------------------------------------------
create or replace function public.create_transaction(
  p_client_id uuid,
  p_items jsonb,
  p_payment_method public.payment_method,
  p_amount_paid numeric,
  p_idempotency_key uuid,
  p_discount_amount numeric default 0,
  p_tax_amount numeric default 0,
  p_notes text default null
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_existing public.transactions;
  v_txn public.transactions;
  v_item jsonb;
  v_product public.products;
  v_product_id uuid;
  v_qty numeric(12,3);
  v_expected_price numeric(14,2);
  v_item_discount numeric(14,2);
  v_line_total numeric(14,2);
  v_subtotal numeric(14,2) := 0;
  v_header_discount numeric(14,2);
  v_tax numeric(14,2);
  v_total numeric(14,2);
  v_paid numeric(14,2);
  v_change numeric(14,2);
  v_invoice text;
  v_stock_after numeric(12,3);
  v_item_count integer;
  v_distinct_count integer;
begin
  -- Auth / RBAC -------------------------------------------------------------
  if v_uid is null then
    raise exception using errcode = 'FR009', message = 'UNAUTHENTICATED';
  end if;

  v_role := public.current_role();
  if v_role is null then
    raise exception using errcode = 'FR009', message = 'FORBIDDEN',
      detail = 'User is inactive or has no role.';
  end if;

  if p_idempotency_key is null then
    raise exception using errcode = 'FR015', message = 'INVALID_IDEMPOTENCY_KEY',
      detail = 'A non-null idempotency key is required.';
  end if;

  if p_payment_method is null then
    raise exception using errcode = 'FR016', message = 'INVALID_AMOUNT',
      detail = 'payment_method is required.';
  end if;

  -- Serialize retries of the same key before touching the counter.
  perform pg_advisory_xact_lock(hashtext(p_idempotency_key::text)::bigint);

  select * into v_existing
  from public.transactions t
  where t.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.user_id <> v_uid then
      raise exception using errcode = 'FR009', message = 'IDEMPOTENCY_KEY_CONFLICT',
        detail = 'This idempotency key belongs to another user.';
    end if;
    return v_existing;
  end if;

  -- Cart validation ---------------------------------------------------------
  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = 'FR008', message = 'EMPTY_CART';
  end if;

  v_item_count := jsonb_array_length(p_items);

  if exists (
    select 1
    from jsonb_array_elements(p_items) as i(item)
    where coalesce(i.item ->> 'product_id', '') !~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) then
    raise exception using errcode = 'FR012', message = 'INVALID_ITEM',
      detail = 'Every item needs a valid product_id UUID.';
  end if;

  select count(distinct i.item ->> 'product_id')
  into v_distinct_count
  from jsonb_array_elements(p_items) as i(item);

  if v_distinct_count <> v_item_count then
    raise exception using errcode = 'FR012', message = 'DUPLICATE_ITEM',
      detail = 'A product may only appear once per transaction.';
  end if;

  if p_client_id is null
     or not exists (
       select 1 from public.clients c
       where c.id = p_client_id and not c.is_deleted
     ) then
    raise exception using errcode = 'FR017', message = 'CLIENT_NOT_FOUND';
  end if;

  -- Lock every product row in a deterministic order -------------------------
  for v_product in
    select p.*
    from public.products p
    where p.id in (
      select (i.item ->> 'product_id')::uuid
      from jsonb_array_elements(p_items) as i(item)
    )
    order by p.id
    for update
  loop
    null;
  end loop;

  -- Pass 1: validate and total ---------------------------------------------
  for v_item in
    select i.item from jsonb_array_elements(p_items) as i(item)
  loop
    begin
      v_product_id := (v_item ->> 'product_id')::uuid;
      v_qty := round((v_item ->> 'qty')::numeric, 3);
      v_expected_price := nullif(v_item ->> 'unit_price', '')::numeric;
      v_item_discount := round(
        coalesce(nullif(v_item ->> 'discount_amount', '')::numeric, 0), 2
      );
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception using errcode = 'FR012', message = 'INVALID_ITEM',
          detail = v_item::text;
    end;

    if v_qty is null or v_qty <= 0 then
      raise exception using errcode = 'FR007', message = 'INVALID_QUANTITY',
        detail = format('Product %s qty must be > 0.', v_product_id);
    end if;

    if v_item_discount is null or v_item_discount < 0 then
      raise exception using errcode = 'FR016', message = 'INVALID_AMOUNT',
        detail = 'Line discount may not be negative.';
    end if;

    select * into v_product
    from public.products p
    where p.id = v_product_id;

    if not found then
      raise exception using errcode = 'FR013', message = 'PRODUCT_NOT_FOUND',
        detail = v_product_id::text;
    end if;

    if v_product.is_deleted then
      raise exception using errcode = 'FR002', message = 'PRODUCT_ARCHIVED',
        detail = format('%s (%s) is archived.', v_product.name, v_product.sku);
    end if;

    if v_product.stock < v_qty then
      raise exception using errcode = 'FR001', message = 'INSUFFICIENT_STOCK',
        detail = format(
          '%s: available=%s requested=%s',
          v_product.name, v_product.stock, v_qty
        );
    end if;

    if v_expected_price is not null
       and v_expected_price <> v_product.selling_price then
      raise exception using errcode = 'FR003', message = 'PRICE_CHANGED',
        detail = format(
          '%s: client=%s current=%s',
          v_product.name, v_expected_price, v_product.selling_price
        );
    end if;

    if v_item_discount > round(v_product.selling_price * v_qty, 2) then
      raise exception using errcode = 'FR004', message = 'DISCOUNT_EXCEEDS_SUBTOTAL',
        detail = format('Line discount exceeds line subtotal for %s.', v_product.name);
    end if;

    v_line_total := round(v_product.selling_price * v_qty - v_item_discount, 2);
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  v_header_discount := round(coalesce(p_discount_amount, 0), 2);
  if v_header_discount < 0 then
    raise exception using errcode = 'FR016', message = 'INVALID_AMOUNT',
      detail = 'Discount may not be negative.';
  end if;
  if v_header_discount > v_subtotal then
    raise exception using errcode = 'FR004', message = 'DISCOUNT_EXCEEDS_SUBTOTAL',
      detail = format('discount=%s subtotal=%s', v_header_discount, v_subtotal);
  end if;

  v_tax := round(coalesce(p_tax_amount, 0), 2);
  if v_tax < 0 then
    raise exception using errcode = 'FR016', message = 'INVALID_AMOUNT',
      detail = 'Tax may not be negative.';
  end if;

  v_total := round(v_subtotal - v_header_discount + v_tax, 2);

  -- Payment validation ------------------------------------------------------
  if p_amount_paid is null then
    if p_payment_method = 'CASH' then
      raise exception using errcode = 'FR005', message = 'INSUFFICIENT_PAYMENT',
        detail = 'amount_paid is required for CASH.';
    end if;
    v_paid := v_total;
  else
    v_paid := round(p_amount_paid, 2);
  end if;

  if v_paid < v_total then
    raise exception using errcode = 'FR005', message = 'INSUFFICIENT_PAYMENT',
      detail = format('total=%s paid=%s', v_total, v_paid);
  end if;

  v_change := round(v_paid - v_total, 2);
  v_invoice := public.next_invoice_number(current_date);

  begin
    insert into public.transactions (
      invoice_number, client_id, user_id, subtotal, discount_amount, tax_amount,
      total, payment_method, amount_paid, change_amount, status,
      idempotency_key, notes
    )
    values (
      v_invoice, p_client_id, v_uid, v_subtotal, v_header_discount, v_tax,
      v_total, p_payment_method, v_paid, v_change, 'COMPLETED',
      p_idempotency_key, p_notes
    )
    returning * into v_txn;
  exception
    when unique_violation then
      select * into v_txn
      from public.transactions t
      where t.idempotency_key = p_idempotency_key;

      if found then
        if v_txn.user_id <> v_uid then
          raise exception using errcode = 'FR009', message = 'IDEMPOTENCY_KEY_CONFLICT';
        end if;
        return v_txn;
      end if;
      raise;
  end;

  -- Pass 2: items, stock, ledger, cashflow ---------------------------------
  for v_item in
    select i.item from jsonb_array_elements(p_items) as i(item)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_qty := round((v_item ->> 'qty')::numeric, 3);
    v_item_discount := round(
      coalesce(nullif(v_item ->> 'discount_amount', '')::numeric, 0), 2
    );

    select * into v_product
    from public.products p
    where p.id = v_product_id;

    insert into public.transaction_items (
      transaction_id, product_id, product_name, sku, unit, qty,
      unit_price, unit_cost, discount_amount, line_total
    )
    values (
      v_txn.id, v_product_id, v_product.name, v_product.sku, v_product.unit,
      v_qty, v_product.selling_price, v_product.cost_price, v_item_discount,
      round(v_product.selling_price * v_qty - v_item_discount, 2)
    );

    update public.products
    set stock = stock - v_qty
    where id = v_product_id
    returning stock into v_stock_after;

    insert into public.stock_movements (
      product_id, type, qty_change, stock_after, transaction_id, created_by
    )
    values (
      v_product_id, 'SALE', -v_qty, v_stock_after, v_txn.id, v_uid
    );
  end loop;

  if v_total > 0 then
    insert into public.cashflows (
      type, amount, category, description, transaction_id, is_manual, created_by
    )
    values (
      'INCOME', v_total, 'SALE', 'Invoice ' || v_invoice,
      v_txn.id, false, v_uid
    );
  end if;

  return v_txn;
end;
$$;

comment on function public.create_transaction(uuid, jsonb, public.payment_method, numeric, uuid, numeric, numeric, text) is
  'Creates a sale atomically: locks products, re-reads prices, writes items, stock ledger and auto cashflow. Idempotent per key.';

-- ----------------------------------------------------------------------------
-- void_transaction
-- ----------------------------------------------------------------------------
create or replace function public.void_transaction(
  p_transaction_id uuid,
  p_reason text default null
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_txn public.transactions;
  v_item public.transaction_items;
  v_lock record;
  v_stock_after numeric(12,3);
begin
  if v_uid is null then
    raise exception using errcode = 'FR009', message = 'UNAUTHENTICATED';
  end if;

  v_role := public.current_role();
  if v_role is null or v_role <> 'ADMIN' then
    raise exception using errcode = 'FR009', message = 'FORBIDDEN',
      detail = 'Only ADMIN may void a transaction.';
  end if;

  select * into v_txn
  from public.transactions t
  where t.id = p_transaction_id
  for update;

  if not found then
    raise exception using errcode = 'FR011', message = 'TRANSACTION_NOT_FOUND',
      detail = coalesce(p_transaction_id::text, 'null');
  end if;

  if v_txn.status = 'VOIDED' then
    raise exception using errcode = 'FR006', message = 'ALREADY_VOID',
      detail = v_txn.invoice_number;
  end if;

  -- Lock all products in id order to avoid deadlocks with concurrent sales.
  for v_lock in
    select p.id
    from public.products p
    where p.id in (
      select ti.product_id
      from public.transaction_items ti
      where ti.transaction_id = p_transaction_id
    )
    order by p.id
    for update
  loop
    null;
  end loop;

  for v_item in
    select ti.*
    from public.transaction_items ti
    where ti.transaction_id = p_transaction_id
    order by ti.product_id
  loop
    update public.products
    set stock = stock + v_item.qty
    where id = v_item.product_id
    returning stock into v_stock_after;

    insert into public.stock_movements (
      product_id, type, qty_change, stock_after, transaction_id,
      created_by, note
    )
    values (
      v_item.product_id, 'VOID_RETURN', v_item.qty, v_stock_after,
      p_transaction_id, v_uid, 'Void ' || v_txn.invoice_number
    );
  end loop;

  update public.transactions
  set status = 'VOIDED',
      voided_at = now(),
      voided_by = v_uid,
      void_reason = p_reason
  where id = p_transaction_id
  returning * into v_txn;

  if v_txn.total > 0 then
    insert into public.cashflows (
      type, amount, category, description, transaction_id, is_manual, created_by
    )
    values (
      'EXPENSE', v_txn.total, 'VOID', 'Void ' || v_txn.invoice_number,
      v_txn.id, false, v_uid
    );
  end if;

  return v_txn;
end;
$$;

comment on function public.void_transaction(uuid, text) is
  'Voids a completed transaction, restores stock, writes VOID_RETURN ledger rows and a reversal cashflow.';

-- ----------------------------------------------------------------------------
-- adjust_stock
-- ----------------------------------------------------------------------------
create or replace function public.adjust_stock(
  p_product_id uuid,
  p_direction text,
  p_qty numeric,
  p_reason public.adjust_reason,
  p_note text default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_product public.products;
  v_direction text;
  v_qty numeric(12,3);
  v_delta numeric(12,3);
  v_type public.stock_movement_type;
  v_stock_after numeric(12,3);
  v_movement public.stock_movements;
begin
  if v_uid is null then
    raise exception using errcode = 'FR009', message = 'UNAUTHENTICATED';
  end if;

  v_role := public.current_role();
  if v_role is null or v_role <> 'ADMIN' then
    raise exception using errcode = 'FR009', message = 'FORBIDDEN',
      detail = 'Only ADMIN may adjust stock.';
  end if;

  v_direction := lower(btrim(coalesce(p_direction, '')));
  if v_direction not in ('add', 'deduct') then
    raise exception using errcode = 'FR010', message = 'INVALID_ADJUSTMENT',
      detail = 'direction must be add or deduct.';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception using errcode = 'FR007', message = 'INVALID_QUANTITY',
      detail = 'qty must be > 0.';
  end if;

  v_qty := round(p_qty, 3);
  if v_qty <= 0 then
    raise exception using errcode = 'FR007', message = 'INVALID_QUANTITY',
      detail = 'qty rounds to 0.';
  end if;

  if p_reason is null then
    raise exception using errcode = 'FR010', message = 'INVALID_ADJUSTMENT',
      detail = 'reason is required.';
  end if;

  select * into v_product
  from public.products p
  where p.id = p_product_id
  for update;

  if not found then
    raise exception using errcode = 'FR013', message = 'PRODUCT_NOT_FOUND',
      detail = coalesce(p_product_id::text, 'null');
  end if;

  if v_product.is_deleted then
    raise exception using errcode = 'FR002', message = 'PRODUCT_ARCHIVED',
      detail = format('%s (%s) is archived.', v_product.name, v_product.sku);
  end if;

  if v_direction = 'deduct' then
    if v_product.stock < v_qty then
      raise exception using errcode = 'FR001', message = 'INSUFFICIENT_STOCK',
        detail = format(
          '%s: available=%s requested=%s',
          v_product.name, v_product.stock, v_qty
        );
    end if;
    v_delta := -v_qty;
    v_type := 'ADJUSTMENT_OUT';
  else
    v_delta := v_qty;
    v_type := 'ADJUSTMENT_IN';
  end if;

  update public.products
  set stock = stock + v_delta
  where id = p_product_id
  returning stock into v_stock_after;

  insert into public.stock_movements (
    product_id, type, qty_change, stock_after, reason, note, created_by
  )
  values (
    p_product_id, v_type, v_delta, v_stock_after, p_reason, p_note, v_uid
  )
  returning * into v_movement;

  return v_movement;
end;
$$;

comment on function public.adjust_stock(uuid, text, numeric, public.adjust_reason, text) is
  'Manual stock in/out with a required reason; writes an append-only ledger row.';

-- ----------------------------------------------------------------------------
-- Auto-generated cashflows are immutable at the DB level.
-- ----------------------------------------------------------------------------
create or replace function public.prevent_auto_cashflow_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_manual = false then
      raise exception using errcode = 'FR014', message = 'IMMUTABLE_CASHFLOW',
        detail = 'Auto-generated cashflow rows cannot be deleted.';
    end if;
    return old;
  end if;

  if old.is_manual = false or new.is_manual = false then
    raise exception using errcode = 'FR014', message = 'IMMUTABLE_CASHFLOW',
      detail = 'Auto-generated cashflow rows cannot be updated.';
  end if;

  return new;
end;
$$;

drop trigger if exists cashflows_prevent_auto_mutation on public.cashflows;
create trigger cashflows_prevent_auto_mutation
  before update or delete on public.cashflows
  for each row execute function public.prevent_auto_cashflow_mutation();
