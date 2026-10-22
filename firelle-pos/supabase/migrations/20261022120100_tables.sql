-- ============================================================================
-- 02 / Core tables, CHECK constraints, FKs, indexes, updated_at triggers
-- Schema step only: no business functions, RLS, seed or UI.
-- Idempotent: create ... if not exists + drop/create triggers.
-- ============================================================================

set search_path = public, extensions;

-- ----------------------------------------------------------------------------
-- Shared updated_at trigger
-- (trigger plumbing only; business RPCs live in a later step)
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- users (profile mirror of auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null check (length(btrim(full_name)) > 0),
  email       text not null,
  role        public.user_role not null default 'CASHIER',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint users_email_key unique (email)
);

create index if not exists users_role_idx on public.users (role);
create index if not exists users_is_active_idx on public.users (is_active);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

comment on table public.users is
  'Application profile keyed 1:1 to auth.users. is_active = false blocks application access.';

-- ----------------------------------------------------------------------------
-- clients (soft archive via is_active, per PRD BR-10)
-- ----------------------------------------------------------------------------
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) > 0),
  phone       text,
  address     text,
  is_active   boolean not null default true,
  is_walk_in  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists clients_name_idx on public.clients (lower(name));
create index if not exists clients_phone_idx on public.clients (phone) where phone is not null;
create index if not exists clients_is_active_idx on public.clients (is_active);

-- Exactly one walk-in client row is allowed.
create unique index if not exists clients_single_walk_in_key
  on public.clients (is_walk_in)
  where is_walk_in;

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- products
-- ----------------------------------------------------------------------------
create table if not exists public.products (
  id             uuid primary key default gen_random_uuid(),
  sku            text,
  barcode        text,
  name           text not null check (length(btrim(name)) > 0),
  unit           text not null default 'Pcs' check (length(btrim(unit)) > 0),
  cost_price     numeric(14,2) not null default 0 check (cost_price >= 0),
  selling_price  numeric(14,2) not null check (selling_price >= 0),
  stock          numeric(12,3) not null default 0,
  min_stock      numeric(12,3) not null default 5 check (min_stock >= 0),
  is_deleted     boolean not null default false,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint products_deleted_ck check (
    (is_deleted and deleted_at is not null)
    or (not is_deleted and deleted_at is null)
  )
);

-- Active rows only: SKU may be reused after a product is archived.
create unique index if not exists products_sku_active_key
  on public.products (lower(sku))
  where sku is not null and not is_deleted;

-- Barcode is indexed for scanner lookups; not forced unique per PRD.
create index if not exists products_barcode_active_idx
  on public.products (barcode)
  where barcode is not null and not is_deleted;

-- Trigram search: name, SKU, barcode (PRD performance requirement).
create index if not exists products_name_trgm_idx
  on public.products using gin (name gin_trgm_ops);
create index if not exists products_sku_trgm_idx
  on public.products using gin (sku gin_trgm_ops);
create index if not exists products_barcode_trgm_idx
  on public.products using gin (barcode gin_trgm_ops);

create index if not exists products_not_deleted_idx on public.products (is_deleted);
create index if not exists products_created_at_idx on public.products (created_at desc);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- invoice_counters (one row per business date, daily reset)
-- ----------------------------------------------------------------------------
create table if not exists public.invoice_counters (
  invoice_date date primary key,
  last_number  integer not null default 0 check (last_number >= 0)
);

comment on table public.invoice_counters is
  'Daily invoice sequence. Format: INV-YYYYMMDD-NNN (zero-padded, grows past 999).';

-- ----------------------------------------------------------------------------
-- transactions
-- ----------------------------------------------------------------------------
create table if not exists public.transactions (
  id                uuid primary key default gen_random_uuid(),
  invoice_number    text not null check (length(btrim(invoice_number)) > 0),
  client_id         uuid references public.clients (id) on delete restrict,
  client_name       text not null check (length(btrim(client_name)) > 0),
  subtotal_amount   numeric(14,2) not null check (subtotal_amount >= 0),
  discount_amount   numeric(14,2) not null default 0 check (discount_amount >= 0),
  total_amount      numeric(14,2) not null check (total_amount >= 0),
  total_cost        numeric(14,2) not null default 0 check (total_cost >= 0),
  total_profit      numeric(14,2) not null default 0,
  payment_method    public.payment_method not null,
  amount_paid       numeric(14,2) not null check (amount_paid >= 0),
  change_amount     numeric(14,2) not null default 0 check (change_amount >= 0),
  status            public.txn_status not null default 'COMPLETED',
  idempotency_key   uuid,
  notes             text,
  void_reason       text,
  voided_at         timestamptz,
  voided_by         uuid references public.users (id) on delete restrict,
  created_by        uuid not null references public.users (id) on delete restrict,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint transactions_invoice_number_key unique (invoice_number),
  constraint transactions_totals_ck check (
    total_amount = subtotal_amount - discount_amount
  ),
  constraint transactions_discount_ck check (discount_amount <= subtotal_amount),
  constraint transactions_profit_ck check (total_profit = total_amount - total_cost),
  constraint transactions_change_ck check (change_amount = amount_paid - total_amount),
  constraint transactions_payment_ck check (
    (payment_method = 'CASH' and amount_paid >= total_amount)
    or (
      payment_method in ('QRIS', 'TRANSFER')
      and amount_paid = total_amount
      and change_amount = 0
    )
  ),
  constraint transactions_void_ck check (
    (
      status = 'VOID'
      and void_reason is not null
      and voided_at is not null
      and voided_by is not null
    )
    or (
      status = 'COMPLETED'
      and void_reason is null
      and voided_at is null
      and voided_by is null
    )
  )
);

create unique index if not exists transactions_idempotency_key_key
  on public.transactions (idempotency_key)
  where idempotency_key is not null;

create index if not exists transactions_created_at_idx
  on public.transactions (created_at desc);
create index if not exists transactions_status_created_at_idx
  on public.transactions (status, created_at desc);
create index if not exists transactions_client_id_idx
  on public.transactions (client_id);
create index if not exists transactions_payment_method_idx
  on public.transactions (payment_method);
create index if not exists transactions_created_by_idx
  on public.transactions (created_by);

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- transaction_items (immutable price/cost snapshot per line)
-- ----------------------------------------------------------------------------
create table if not exists public.transaction_items (
  id               uuid primary key default gen_random_uuid(),
  transaction_id   uuid not null references public.transactions (id) on delete restrict,
  product_id       uuid references public.products (id) on delete restrict,
  product_name     text not null,
  unit             text not null,
  qty              numeric(12,3) not null check (qty > 0),
  cost_price       numeric(14,2) not null check (cost_price >= 0),
  selling_price    numeric(14,2) not null check (selling_price >= 0),
  subtotal         numeric(14,2) not null check (subtotal >= 0),
  subtotal_profit  numeric(14,2) not null,
  created_at       timestamptz not null default now(),
  constraint transaction_items_subtotal_ck check (
    subtotal = round(qty * selling_price, 2)
  ),
  constraint transaction_items_profit_ck check (
    subtotal_profit = round((selling_price - cost_price) * qty, 2)
  )
);

create unique index if not exists transaction_items_txn_product_key
  on public.transaction_items (transaction_id, product_id)
  where product_id is not null;

create index if not exists transaction_items_transaction_id_idx
  on public.transaction_items (transaction_id);
create index if not exists transaction_items_product_id_idx
  on public.transaction_items (product_id);

-- ----------------------------------------------------------------------------
-- stock_movements (append-only ledger)
-- ----------------------------------------------------------------------------
create table if not exists public.stock_movements (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products (id) on delete restrict,
  type            public.stock_movement_type not null,
  qty_change      numeric(12,3) not null check (qty_change <> 0),
  stock_after     numeric(12,3) not null,
  reason          public.adjust_reason,
  note            text,
  transaction_id  uuid references public.transactions (id) on delete restrict,
  created_by      uuid references public.users (id) on delete restrict,
  created_at      timestamptz not null default now(),
  constraint stock_movements_reason_ck check (
    (type in ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT') and reason is not null)
    or (type not in ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT') and reason is null)
  ),
  constraint stock_movements_sign_ck check (
    (type in ('SALE', 'ADJUSTMENT_OUT') and qty_change < 0)
    or (type in ('INITIAL', 'VOID_RETURN', 'ADJUSTMENT_IN') and qty_change > 0)
  )
);

create index if not exists stock_movements_product_created_idx
  on public.stock_movements (product_id, created_at desc);
create index if not exists stock_movements_created_at_idx
  on public.stock_movements (created_at desc);
create index if not exists stock_movements_transaction_id_idx
  on public.stock_movements (transaction_id);
create index if not exists stock_movements_type_idx
  on public.stock_movements (type);
create index if not exists stock_movements_created_by_idx
  on public.stock_movements (created_by);

-- ----------------------------------------------------------------------------
-- cashflows (manual rows + immutable auto rows from sale/void)
-- ----------------------------------------------------------------------------
create table if not exists public.cashflows (
  id              uuid primary key default gen_random_uuid(),
  type            public.cashflow_type not null,
  amount          numeric(14,2) not null check (amount > 0),
  category        text not null check (length(btrim(category)) > 0),
  description     text,
  is_manual       boolean not null default true,
  transaction_id  uuid references public.transactions (id) on delete restrict,
  occurred_at     timestamptz not null default now(),
  created_by      uuid references public.users (id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint cashflows_manual_link_ck check (
    (is_manual and transaction_id is null)
    or (not is_manual and transaction_id is not null)
  )
);

create index if not exists cashflows_occurred_at_idx
  on public.cashflows (occurred_at desc);
create index if not exists cashflows_type_occurred_at_idx
  on public.cashflows (type, occurred_at desc);
create index if not exists cashflows_transaction_id_idx
  on public.cashflows (transaction_id);
create index if not exists cashflows_is_manual_idx
  on public.cashflows (is_manual);
create index if not exists cashflows_created_by_idx
  on public.cashflows (created_by);

drop trigger if exists cashflows_set_updated_at on public.cashflows;
create trigger cashflows_set_updated_at
  before update on public.cashflows
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- settings (singleton row)
-- ----------------------------------------------------------------------------
create table if not exists public.settings (
  singleton            boolean primary key default true,
  store_name           text not null default 'Firelle' check (length(btrim(store_name)) > 0),
  store_address        text,
  store_phone          text,
  receipt_footer       text,
  allow_negative_stock boolean not null default false,
  low_stock_default    numeric(12,3) not null default 5 check (low_stock_default >= 0),
  receipt_paper        text not null default '58mm'
                       check (receipt_paper in ('58mm', '80mm', 'A4')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint settings_singleton_ck check (singleton)
);

drop trigger if exists settings_set_updated_at on public.settings;
create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

reset search_path;
