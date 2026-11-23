-- ============================================================================
-- 08 / Atomic checkout + void
--
-- Only these two functions are defined here. Invoice numbering and manual
-- stock adjustment live in the earlier invoice/stock migration.
--
-- Error contract used by these functions:
--   FR001 INSUFFICIENT_STOCK      requested qty exceeds stock (BR-01)
--   FR002 PRODUCT_ARCHIVED        product is soft-deleted (BR-09)
--   FR003 PRICE_CHANGED           client price != current DB price
--   FR004 DISCOUNT_EXCEEDS_SUBTOTAL  line/header discount too large (BR-11)
--   FR005 INSUFFICIENT_PAYMENT    CASH paid < total (BR-07)
--   FR006 ALREADY_VOID            transaction is already VOID
--   FR008 EMPTY_CART
--   FR009 UNAUTHENTICATED / FORBIDDEN / IDEMPOTENCY_KEY_CONFLICT
--   FR011 TRANSACTION_NOT_FOUND
--   FR012 INVALID_ITEM / DUPLICATE_ITEM
--   FR013 PRODUCT_NOT_FOUND
--   FR015 INVALID_IDEMPOTENCY_KEY
--   FR016 INVALID_AMOUNT         negative discount/amount
--   FR017 CLIENT_NOT_FOUND
--   FR018 VOID_REASON_REQUIRED
--   FR021 INVALID_PAYMENT        payment method/amount mismatch (BR-07)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- create_transaction(...)
--
-- One atomic checkout:
--   1. idempotency replay guard + unique key
--   2. lock product rows in id order (serializes last-unit races)
--   3. re-read selling_price / cost_price from products (never trust the client)
--   4. validate stock, price, discounts and payment
--   5. insert transactions + immutable transaction_items snapshots
--   6. deduct stock + one SALE stock_movements row per line
--   7. insert an immutable IN cashflow for the sale total
--
-- Returns the cashier-safe transaction row (no cost/profit columns), so a
-- CASHIER cannot read margin data through the RPC response.
-- ----------------------------------------------------------------------------
create or replace function public.create_transaction(
  p_client_id uuid,
  p_items jsonb,
  p_payment_method public.payment_method,
  p_amount_paid numeric,
  p_idempotency_key uuid,
  p_discount_amount numeric default 0,
  p_notes text default null
)
returns public.transactions_cashier
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_existing public.transactions;
  v_txn public.transactions;
  v_receipt public.transactions_cashier;
  v_client public.clients;
  v_item jsonb;
  v_product public.products;
  v_product_id uuid;
  v_qty numeric(12,3);
  v_expected_price numeric(14,2);
  v_item_discount numeric(14,2);
  v_line_gross numeric(14,2);
  v_subtotal numeric(14,2) := 0;
  v_line_discount_total numeric(14,2) := 0;
  v_header_discount numeric(14,2);
  v_discount_total numeric(14,2);
  v_total numeric(14,2);
  v_total_cost numeric(14,2) := 0;
  v_total_profit numeric(14,2);
  v_paid numeric(14,2);
  v_change numeric(14,2);
  v_invoice text;
  v_stock_after numeric(12,3);
  v_item_count integer;
  v_distinct_count integer;
  v_allow_negative boolean;
begin
  -- --- Authentication / authorization ---------------------------------------
  if v_uid is null then
    raise exception using errcode = 'FR009', message = 'UNAUTHENTICATED';
  end if;

  select u.role
  into v_role
  from public.users u
  where u.id = v_uid
    and u.is_active;

  if v_role is null then
    raise exception using errcode = 'FR009', message = 'FORBIDDEN',
      detail = 'User is inactive or has no role.';
  end if;

  if p_idempotency_key is null then
    raise exception using errcode = 'FR015', message = 'INVALID_IDEMPOTENCY_KEY',
      detail = 'A non-null idempotency key is required.';
  end if;

  if p_payment_method is null then
    raise exception using errcode = 'FR021', message = 'INVALID_PAYMENT',
      detail = 'payment_method is required.';
  end if;

  -- Serialize retries of the same key before touching the invoice counter.
  perform pg_advisory_xact_lock(hashtext(p_idempotency_key::text)::bigint);

  select *
  into v_existing
  from public.transactions t
  where t.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.created_by <> v_uid then
      raise exception using errcode = 'FR009', message = 'IDEMPOTENCY_KEY_CONFLICT',
        detail = 'This idempotency key belongs to another user.';
    end if;

    select * into v_receipt
    from public.transactions_cashier tc
    where tc.id = v_existing.id;

    return v_receipt;
  end if;

  -- --- Cart shape -----------------------------------------------------------
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

  select count(distinct (i.item ->> 'product_id')::uuid)
  into v_distinct_count
  from jsonb_array_elements(p_items) as i(item);

  if v_distinct_count <> v_item_count then
    raise exception using errcode = 'FR012', message = 'DUPLICATE_ITEM',
      detail = 'A product may only appear once per transaction.';
  end if;

  -- --- Client snapshot ------------------------------------------------------
  if p_client_id is null then
    select * into v_client
    from public.clients c
    where c.is_walk_in and c.is_active;
  else
    select * into v_client
    from public.clients c
    where c.id = p_client_id and c.is_active;
  end if;

  if not found then
    raise exception using errcode = 'FR017', message = 'CLIENT_NOT_FOUND',
      detail = coalesce(p_client_id::text, 'no active walk-in client');
  end if;

  select coalesce(
    (select s.allow_negative_stock from public.settings s where s.singleton),
    false
  ) into v_allow_negative;

  -- --- Lock every product row in deterministic order ------------------------
  perform 1
  from public.products p
  where p.id in (
    select (i.item ->> 'product_id')::uuid
    from jsonb_array_elements(p_items) as i(item)
  )
  order by p.id
  for update;

  -- --- Pass 1: validate, re-read prices/costs, total ------------------------
  for v_item in
    select i.item from jsonb_array_elements(p_items) as i(item)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception using errcode = 'FR012', message = 'INVALID_ITEM',
        detail = v_item::text;
    end if;

    begin
      v_product_id := (v_item ->> 'product_id')::uuid;
      v_qty := round((v_item ->> 'qty')::numeric, 3);
      v_expected_price := round(
        nullif(v_item ->> 'unit_price', '')::numeric, 2
      );
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

    if not v_allow_negative and v_product.stock < v_qty then
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

    v_line_gross := round(v_product.selling_price * v_qty, 2);

    if v_item_discount > v_line_gross then
      raise exception using errcode = 'FR004', message = 'DISCOUNT_EXCEEDS_SUBTOTAL',
        detail = format('Line discount exceeds line subtotal for %s.', v_product.name);
    end if;

    v_subtotal := v_subtotal + v_line_gross;
    v_line_discount_total := v_line_discount_total + v_item_discount;
    v_total_cost := v_total_cost + round(v_product.cost_price * v_qty, 2);
  end loop;

  v_header_discount := round(coalesce(p_discount_amount, 0), 2);
  if v_header_discount < 0 then
    raise exception using errcode = 'FR016', message = 'INVALID_AMOUNT',
      detail = 'Discount may not be negative.';
  end if;

  v_discount_total := round(v_line_discount_total + v_header_discount, 2);
  if v_discount_total > v_subtotal then
    raise exception using errcode = 'FR004', message = 'DISCOUNT_EXCEEDS_SUBTOTAL',
      detail = format('discount=%s subtotal=%s', v_discount_total, v_subtotal);
  end if;

  v_total := round(v_subtotal - v_discount_total, 2);
  v_total_profit := round(v_total - v_total_cost, 2);

  -- --- BR-07 payment validation --------------------------------------------
  if p_amount_paid is null then
    if p_payment_method = 'CASH' then
      raise exception using errcode = 'FR021', message = 'INVALID_PAYMENT',
        detail = 'amount_paid is required for CASH.';
    end if;
    v_paid := v_total;
  else
    v_paid := round(p_amount_paid, 2);
  end if;

  if v_paid < 0 then
    raise exception using errcode = 'FR021', message = 'INVALID_PAYMENT',
      detail = 'amount_paid may not be negative.';
  end if;

  if v_paid < v_total then
    if p_payment_method = 'CASH' then
      raise exception using errcode = 'FR005', message = 'INSUFFICIENT_PAYMENT',
        detail = format('total=%s paid=%s', v_total, v_paid);
    end if;
    raise exception using errcode = 'FR021', message = 'INVALID_PAYMENT',
      detail = format('%s must be paid exactly (total=%s paid=%s).',
                      p_payment_method, v_total, v_paid);
  end if;

  if p_payment_method <> 'CASH' and v_paid <> v_total then
    raise exception using errcode = 'FR021', message = 'INVALID_PAYMENT',
      detail = format('%s must be paid exactly (total=%s paid=%s).',
                      p_payment_method, v_total, v_paid);
  end if;

  v_change := round(v_paid - v_total, 2);
  v_invoice := public.next_invoice_number();

  -- --- Header row -----------------------------------------------------------
  begin
    insert into public.transactions (
      invoice_number, client_id, client_name,
      subtotal_amount, discount_amount, total_amount, total_cost, total_profit,
      payment_method, amount_paid, change_amount, status,
      idempotency_key, notes, created_by
    )
    values (
      v_invoice, v_client.id, v_client.name,
      v_subtotal, v_discount_total, v_total, v_total_cost, v_total_profit,
      p_payment_method, v_paid, v_change, 'COMPLETED',
      p_idempotency_key, p_notes, v_uid
    )
    returning * into v_txn;
  exception
    when unique_violation then
      select * into v_txn
      from public.transactions t
      where t.idempotency_key = p_idempotency_key;

      if found then
        if v_txn.created_by <> v_uid then
          raise exception using errcode = 'FR009', message = 'IDEMPOTENCY_KEY_CONFLICT';
        end if;

        select * into v_receipt
        from public.transactions_cashier tc
        where tc.id = v_txn.id;

        return v_receipt;
      end if;
      raise;
  end;

  -- --- Pass 2: snapshots, stock deduction, ledger, cashflow ----------------
  for v_item in
    select i.item from jsonb_array_elements(p_items) as i(item)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_qty := round((v_item ->> 'qty')::numeric, 3);

    select * into v_product
    from public.products p
    where p.id = v_product_id;

    insert into public.transaction_items (
      transaction_id, product_id, product_name, unit, qty,
      cost_price, selling_price, subtotal, subtotal_profit
    )
    values (
      v_txn.id, v_product_id, v_product.name, v_product.unit, v_qty,
      v_product.cost_price, v_product.selling_price,
      round(v_product.selling_price * v_qty, 2),
      round((v_product.selling_price - v_product.cost_price) * v_qty, 2)
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
      'IN', v_total, 'SALE', 'Invoice ' || v_invoice,
      v_txn.id, false, v_uid
    );
  end if;

  select * into v_receipt
  from public.transactions_cashier tc
  where tc.id = v_txn.id;

  return v_receipt;
end;
$$;

comment on function public.create_transaction(
  uuid, jsonb, public.payment_method, numeric, uuid, numeric, text
) is
  'Atomic, idempotent sale: server-side prices/costs, stock guard, item snapshots, SALE ledger and immutable IN cashflow. Returns the cashier-safe row.';

-- ----------------------------------------------------------------------------
-- void_transaction(...)
--
-- ADMIN only. Locks the transaction, requires a reason, flips it to VOID,
-- restores stock through VOID_RETURN ledger rows, and writes a reversal OUT
-- cashflow while keeping the original IN row untouched.
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
  v_reason text;
  v_stock_after numeric(12,3);
begin
  -- --- ADMIN only -----------------------------------------------------------
  if v_uid is null then
    raise exception using errcode = 'FR009', message = 'UNAUTHENTICATED';
  end if;

  select u.role
  into v_role
  from public.users u
  where u.id = v_uid
    and u.is_active;

  if v_role is null or v_role <> 'ADMIN' then
    raise exception using errcode = 'FR009', message = 'FORBIDDEN',
      detail = 'Only ADMIN may void a transaction.';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception using errcode = 'FR018', message = 'VOID_REASON_REQUIRED';
  end if;

  -- --- Lock the transaction -------------------------------------------------
  select *
  into v_txn
  from public.transactions t
  where t.id = p_transaction_id
  for update;

  if not found then
    raise exception using errcode = 'FR011', message = 'TRANSACTION_NOT_FOUND',
      detail = coalesce(p_transaction_id::text, 'null');
  end if;

  if v_txn.status <> 'COMPLETED' then
    raise exception using errcode = 'FR006', message = 'ALREADY_VOID',
      detail = v_txn.invoice_number;
  end if;

  -- Lock products in id order to avoid deadlocks with concurrent sales.
  perform 1
  from public.products p
  where p.id in (
    select ti.product_id
    from public.transaction_items ti
    where ti.transaction_id = p_transaction_id
      and ti.product_id is not null
  )
  order by p.id
  for update;

  -- --- Restore stock + VOID_RETURN ledger -----------------------------------
  for v_item in
    select ti.*
    from public.transaction_items ti
    where ti.transaction_id = p_transaction_id
      and ti.product_id is not null
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

  -- --- VOID status ----------------------------------------------------------
  update public.transactions
  set status = 'VOID',
      voided_at = now(),
      voided_by = v_uid,
      void_reason = v_reason
  where id = p_transaction_id
  returning * into v_txn;

  -- --- Reversal cashflow (original IN stays) --------------------------------
  if v_txn.total_amount > 0 then
    insert into public.cashflows (
      type, amount, category, description, transaction_id, is_manual, created_by
    )
    values (
      'OUT', v_txn.total_amount, 'VOID', 'Void ' || v_txn.invoice_number,
      v_txn.id, false, v_uid
    );
  end if;

  return v_txn;
end;
$$;

comment on function public.void_transaction(uuid, text) is
  'ADMIN-only void: locks the transaction, requires a reason, restores stock with VOID_RETURN rows and writes a reversal OUT cashflow.';
