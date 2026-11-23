-- ============================================================================
-- 01 / Extensions + enum types
-- Schema step only: no business functions, RLS, seed or UI.
-- Idempotent: safe to re-run.
-- ============================================================================

create schema if not exists extensions;

-- pgcrypto: gen_random_uuid().
-- pg_trgm: fuzzy search on products (name / sku / barcode).
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_type
    where typname = 'user_role' and typnamespace = 'public'::regnamespace
  ) then
    create type public.user_role as enum ('ADMIN', 'CASHIER');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type
    where typname = 'txn_status' and typnamespace = 'public'::regnamespace
  ) then
    create type public.txn_status as enum ('COMPLETED', 'VOID');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type
    where typname = 'payment_method' and typnamespace = 'public'::regnamespace
  ) then
    create type public.payment_method as enum ('CASH', 'QRIS', 'TRANSFER');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type
    where typname = 'cashflow_type' and typnamespace = 'public'::regnamespace
  ) then
    create type public.cashflow_type as enum ('IN', 'OUT');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type
    where typname = 'stock_movement_type' and typnamespace = 'public'::regnamespace
  ) then
    create type public.stock_movement_type as enum (
      'INITIAL',
      'SALE',
      'VOID_RETURN',
      'ADJUSTMENT_IN',
      'ADJUSTMENT_OUT'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type
    where typname = 'adjust_reason' and typnamespace = 'public'::regnamespace
  ) then
    create type public.adjust_reason as enum (
      'RESTOCK',
      'DAMAGED',
      'LOST',
      'STOCK_OPNAME',
      'OTHER'
    );
  end if;
end
$$;

comment on type public.user_role is
  'Application roles. The first auth user ever becomes ADMIN; later signups default to CASHIER.';
comment on type public.txn_status is
  'COMPLETED = counted in sales/profit; VOID = reversed but retained for audit.';
comment on type public.payment_method is
  'CASH allows overpayment (change); QRIS and TRANSFER must be paid exactly.';
comment on type public.cashflow_type is
  'IN = money in, OUT = money out. Direction lives in the type, amount is always positive.';
comment on type public.stock_movement_type is
  'SALE and ADJUSTMENT_OUT are negative; INITIAL, VOID_RETURN and ADJUSTMENT_IN are positive.';
