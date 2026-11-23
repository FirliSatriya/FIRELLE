-- ============================================================================
-- 04 / Invoice numbering + manual stock adjustment
--
-- Only these two business functions live in this step. Transaction/void
-- functions are intentionally NOT defined here.
--
-- Error contract (custom SQLSTATE / stable message):
--   FR001 INSUFFICIENT_STOCK   result would be negative (BR-01)
--   FR002 PRODUCT_ARCHIVED     product is soft-deleted
--   FR007 INVALID_QUANTITY     delta is null, zero, or rounds to zero
--   FR009 UNAUTHENTICATED      auth.uid() is null
--   FR009 FORBIDDEN            caller is not an active ADMIN
--   FR010 INVALID_ADJUSTMENT   missing reason (BR-12)
--   FR013 PRODUCT_NOT_FOUND    unknown product id
--   FR018 INVALID_DATE         null invoice date
-- ============================================================================

-- ----------------------------------------------------------------------------
-- next_invoice_number(date)
--
-- Format: INV-YYYYMMDD-NNN (zero-padded to 3; grows naturally past 999).
-- The argument is the WIB business date; when omitted it defaults to today
-- in Asia/Jakarta, independent of the database/server timezone.
--
-- Concurrency safety: INSERT ... ON CONFLICT DO UPDATE locks the single
-- invoice_counters row for that date, so concurrent checkouts receive
-- distinct sequence numbers. Numbering is per-date and resets daily.
-- ----------------------------------------------------------------------------
create or replace function public.next_invoice_number(
  p_date date default ((now() at time zone 'Asia/Jakarta')::date)
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq integer;
begin
  if p_date is null then
    raise exception using errcode = 'FR018', message = 'INVALID_DATE',
      detail = 'Invoice date may not be null.';
  end if;

  insert into public.invoice_counters as ic (invoice_date, last_number)
  values (p_date, 1)
  on conflict (invoice_date) do update
    set last_number = ic.last_number + 1
  returning last_number into v_seq;

  return format(
    'INV-%s-%s',
    to_char(p_date, 'YYYYMMDD'),
    lpad(v_seq::text, 3, '0')
  );
end;
$$;

comment on function public.next_invoice_number(date) is
  'Returns the next daily invoice number (INV-YYYYMMDD-NNN) using a row-locked invoice_counters upsert. WIB business date.';

-- ----------------------------------------------------------------------------
-- adjust_stock(product_id, delta, reason, note)
--
-- p_delta is a signed quantity change (+ in / - out). Rounds to 3 decimals.
-- Locks the product row FOR UPDATE, computes the resulting balance, writes
-- the product stock and one append-only stock_movements row, and returns it.
--
-- BR-01: negative results are rejected unless settings.allow_negative_stock.
-- BR-12: an adjustment reason is mandatory; note is optional.
-- ----------------------------------------------------------------------------
create or replace function public.adjust_stock(
  p_product_id uuid,
  p_delta numeric,
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
  v_delta numeric(12,3);
  v_stock_after numeric(12,3);
  v_type public.stock_movement_type;
  v_allow_negative boolean;
  v_movement public.stock_movements;
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

  if v_role is null or v_role <> 'ADMIN' then
    raise exception using errcode = 'FR009', message = 'FORBIDDEN',
      detail = 'Only an active ADMIN may adjust stock.';
  end if;

  -- --- Input validation -----------------------------------------------------
  if p_reason is null then
    raise exception using errcode = 'FR010', message = 'INVALID_ADJUSTMENT',
      detail = 'reason is required.';
  end if;

  if p_delta is null then
    raise exception using errcode = 'FR007', message = 'INVALID_QUANTITY',
      detail = 'delta may not be null.';
  end if;

  v_delta := round(p_delta, 3);
  if v_delta = 0 then
    raise exception using errcode = 'FR007', message = 'INVALID_QUANTITY',
      detail = 'delta must not be zero (or round to zero).';
  end if;

  -- --- Row lock: the only writer of this product's stock --------------------
  select *
  into v_product
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

  -- --- BR-01: resulting balance --------------------------------------------
  select coalesce(s.allow_negative_stock, false)
  into v_allow_negative
  from public.settings s
  where s.singleton;

  v_allow_negative := coalesce(v_allow_negative, false);
  v_stock_after := round(v_product.stock + v_delta, 3);

  if v_stock_after < 0 and not v_allow_negative then
    raise exception using errcode = 'FR001', message = 'INSUFFICIENT_STOCK',
      detail = format(
        '%s: available=%s delta=%s result=%s (negative stock disabled).',
        v_product.name, v_product.stock, v_delta, v_stock_after
      );
  end if;

  -- --- Apply + ledger -------------------------------------------------------
  v_type := case
    when v_delta > 0 then 'ADJUSTMENT_IN'::public.stock_movement_type
    else 'ADJUSTMENT_OUT'::public.stock_movement_type
  end;

  update public.products
  set stock = v_stock_after
  where id = p_product_id;

  insert into public.stock_movements (
    product_id,
    type,
    qty_change,
    stock_after,
    reason,
    note,
    created_by
  )
  values (
    p_product_id,
    v_type,
    v_delta,
    v_stock_after,
    p_reason,
    p_note,
    v_uid
  )
  returning * into v_movement;

  return v_movement;
end;
$$;

comment on function public.adjust_stock(uuid, numeric, public.adjust_reason, text) is
  'ADMIN-only manual stock change (signed delta) with a required reason; locks the product row, enforces BR-01/BR-12 and writes a stock_movements ledger row.';
