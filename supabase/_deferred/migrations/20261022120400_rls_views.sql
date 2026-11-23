-- ============================================================================
-- 05 / RLS, RBAC, column privileges and cashier-safe views
--
-- Role matrix (assumption, see supabase/README.md):
--   ADMIN     : everything, including settings + user role changes.
--   ADMIN      : products, stock, clients, void, cashflows, manage CASHIERs.
--   CASHIER    : sell, read own transactions, read active products via
--                products_cashier, create clients, manual cashflows.
--
-- cost_price / unit_cost / profit are NOT selectable by authenticated on the
-- base tables. Admins read them through products_admin /
-- transaction_items_admin (security-definer views guarded by current_role()).
-- ============================================================================

alter table public.users             enable row level security;
alter table public.products          enable row level security;
alter table public.stock_movements   enable row level security;
alter table public.clients           enable row level security;
alter table public.invoice_counters  enable row level security;
alter table public.transactions      enable row level security;
alter table public.transaction_items enable row level security;
alter table public.cashflows         enable row level security;
alter table public.settings          enable row level security;

-- ----------------------------------------------------------------------------
-- users
-- ----------------------------------------------------------------------------
drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users
  for select to authenticated
  using (id = auth.uid());

drop policy if exists users_select_admin on public.users;
create policy users_select_admin on public.users
  for select to authenticated
  using (public.current_role() = 'ADMIN');

drop policy if exists users_update_superadmin on public.users;
drop policy if exists users_update_admin on public.users;
create policy users_update_admin on public.users
  for update to authenticated
  using (public.current_role() = 'ADMIN')
  with check (public.current_role() = 'ADMIN');

drop policy if exists users_update_admin_cashiers on public.users;
create policy users_update_admin_cashiers on public.users
  for update to authenticated
  using (public.current_role() = 'ADMIN' and role = 'CASHIER')
  with check (public.current_role() = 'ADMIN' and role = 'CASHIER');

-- ----------------------------------------------------------------------------
-- products
-- ----------------------------------------------------------------------------
drop policy if exists products_select_scope on public.products;
create policy products_select_scope on public.products
  for select to authenticated
  using (
    public.current_role() is not null
    and (
      public.current_role() = 'ADMIN'
      or not is_deleted
    )
  );

drop policy if exists products_insert_admin on public.products;
create policy products_insert_admin on public.products
  for insert to authenticated
  with check (public.current_role() = 'ADMIN');

drop policy if exists products_update_admin on public.products;
create policy products_update_admin on public.products
  for update to authenticated
  using (public.current_role() = 'ADMIN')
  with check (public.current_role() = 'ADMIN');

drop policy if exists products_delete_admin on public.products;
create policy products_delete_admin on public.products
  for delete to authenticated
  using (public.current_role() = 'ADMIN');

-- ----------------------------------------------------------------------------
-- stock_movements
-- ----------------------------------------------------------------------------
drop policy if exists stock_movements_select_scope on public.stock_movements;
create policy stock_movements_select_scope on public.stock_movements
  for select to authenticated
  using (
    public.current_role() = 'ADMIN'
    or created_by = auth.uid()
    or exists (
      select 1 from public.transactions t
      where t.id = transaction_id
        and t.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- clients
-- ----------------------------------------------------------------------------
drop policy if exists clients_select_scope on public.clients;
create policy clients_select_scope on public.clients
  for select to authenticated
  using (
    public.current_role() is not null
    and (
      public.current_role() = 'ADMIN'
      or not is_deleted
    )
  );

drop policy if exists clients_insert_active_user on public.clients;
create policy clients_insert_active_user on public.clients
  for insert to authenticated
  with check (
    public.current_role() is not null
    and (
      public.current_role() = 'ADMIN'
      or not is_deleted
    )
  );

drop policy if exists clients_update_admin on public.clients;
create policy clients_update_admin on public.clients
  for update to authenticated
  using (public.current_role() = 'ADMIN')
  with check (public.current_role() = 'ADMIN');

-- invoice_counters: deliberately no policies (RPC-only).

-- ----------------------------------------------------------------------------
-- transactions
-- ----------------------------------------------------------------------------
drop policy if exists transactions_select_scope on public.transactions;
create policy transactions_select_scope on public.transactions
  for select to authenticated
  using (
    public.current_role() = 'ADMIN'
    or user_id = auth.uid()
  );

-- No INSERT/UPDATE/DELETE policies: writes go through SECURITY DEFINER RPCs.

-- ----------------------------------------------------------------------------
-- transaction_items
-- ----------------------------------------------------------------------------
drop policy if exists transaction_items_select_scope on public.transaction_items;
create policy transaction_items_select_scope on public.transaction_items
  for select to authenticated
  using (
    public.current_role() = 'ADMIN'
    or exists (
      select 1 from public.transactions t
      where t.id = transaction_id
        and t.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- cashflows
-- ----------------------------------------------------------------------------
drop policy if exists cashflows_select_scope on public.cashflows;
create policy cashflows_select_scope on public.cashflows
  for select to authenticated
  using (
    public.current_role() = 'ADMIN'
    or created_by = auth.uid()
    or (
      transaction_id is not null
      and exists (
        select 1 from public.transactions t
        where t.id = transaction_id
          and t.user_id = auth.uid()
      )
    )
  );

drop policy if exists cashflows_insert_manual_self on public.cashflows;
create policy cashflows_insert_manual_self on public.cashflows
  for insert to authenticated
  with check (
    public.current_role() is not null
    and is_manual
    and transaction_id is null
    and created_by = auth.uid()
  );

drop policy if exists cashflows_update_manual on public.cashflows;
create policy cashflows_update_manual on public.cashflows
  for update to authenticated
  using (
    is_manual
    and (
      public.current_role() = 'ADMIN'
      or created_by = auth.uid()
    )
  )
  with check (
    is_manual
    and transaction_id is null
    and (
      public.current_role() = 'ADMIN'
      or created_by = auth.uid()
    )
  );

drop policy if exists cashflows_delete_manual on public.cashflows;
create policy cashflows_delete_manual on public.cashflows
  for delete to authenticated
  using (
    is_manual
    and (
      public.current_role() = 'ADMIN'
      or created_by = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- settings
-- ----------------------------------------------------------------------------
drop policy if exists settings_select_active on public.settings;
create policy settings_select_active on public.settings
  for select to authenticated
  using (public.current_role() is not null);

drop policy if exists settings_update_superadmin on public.settings;
drop policy if exists settings_update_admin on public.settings;
create policy settings_update_admin on public.settings
  for update to authenticated
  using (public.current_role() = 'ADMIN')
  with check (public.current_role() = 'ADMIN');

-- ============================================================================
-- Privileges
-- ============================================================================
revoke all on table public.users, public.products, public.stock_movements,
  public.clients, public.invoice_counters, public.transactions,
  public.transaction_items, public.cashflows, public.settings
from anon, authenticated;

-- Products: authenticated may read everything EXCEPT cost_price on the base
-- table. Admin cost visibility is via public.products_admin.
grant select (
  id, sku, barcode, name, unit, selling_price, stock, min_stock,
  is_deleted, deleted_at, created_at, updated_at
) on table public.products to authenticated;

grant insert, update, delete on table public.products to authenticated;

-- Transaction items: no unit_cost / profit on the base table.
grant select (
  id, transaction_id, product_id, product_name, sku, unit, qty,
  unit_price, discount_amount, line_total, created_at
) on table public.transaction_items to authenticated;

grant select, update on table public.users to authenticated;
grant select on table public.stock_movements to authenticated;
grant select, insert, update on table public.clients to authenticated;
grant select on table public.transactions to authenticated;
grant select, insert, update, delete on table public.cashflows to authenticated;
grant select, update on table public.settings to authenticated;

-- invoice_counters intentionally has zero grants to authenticated.
grant all on all tables in schema public to service_role;

-- ============================================================================
-- Cashier-safe views (security_invoker => caller's RLS + column privileges)
-- ============================================================================
create or replace view public.products_cashier
with (security_invoker = true)
as
select
  p.id,
  p.sku,
  p.barcode,
  p.name,
  p.unit,
  p.selling_price,
  p.stock,
  p.min_stock,
  p.is_deleted,
  p.deleted_at,
  p.created_at,
  p.updated_at
from public.products p
where not p.is_deleted;

comment on view public.products_cashier is
  'Cashier product list: base products columns minus cost_price.';

create or replace view public.transaction_items_cashier
with (security_invoker = true)
as
select
  ti.id,
  ti.transaction_id,
  ti.product_id,
  ti.product_name,
  ti.sku,
  ti.unit,
  ti.qty,
  ti.unit_price,
  ti.discount_amount,
  ti.line_total,
  ti.created_at
from public.transaction_items ti;

comment on view public.transaction_items_cashier is
  'Cashier transaction lines without unit_cost or profit.';

-- ============================================================================
-- Admin-only views (security definer, explicitly guarded)
--
-- These are the only supported way to read cost/profit from the API.
-- They return zero rows for CASHIER, and are unavailable to anon.
-- ============================================================================
create or replace view public.products_admin
with (security_invoker = false, security_barrier = true)
as
select p.*
from public.products p
where public.current_role() = 'ADMIN';

comment on view public.products_admin is
  'Full product rows (incl. cost_price) for ADMIN only.';

create or replace view public.transaction_items_admin
with (security_invoker = false, security_barrier = true)
as
select ti.*
from public.transaction_items ti
where public.current_role() = 'ADMIN';

comment on view public.transaction_items_admin is
  'Full transaction lines (incl. unit_cost/profit) for ADMIN only.';

revoke all on table public.products_cashier, public.products_admin,
  public.transaction_items_cashier, public.transaction_items_admin
from anon, authenticated;

grant select on table public.products_cashier, public.products_admin,
  public.transaction_items_cashier, public.transaction_items_admin
to authenticated, service_role;

-- ============================================================================
-- RPC privileges
-- ============================================================================
revoke all on function public.current_role() from public;
revoke all on function public.next_invoice_number(date) from public;
revoke all on function public.create_transaction(
  uuid, jsonb, public.payment_method, numeric, uuid, numeric, numeric, text
) from public;
revoke all on function public.void_transaction(uuid, text) from public;
revoke all on function public.adjust_stock(
  uuid, text, numeric, public.adjust_reason, text
) from public;

grant execute on function public.current_role() to authenticated, service_role;
grant execute on function public.next_invoice_number(date) to authenticated, service_role;
grant execute on function public.create_transaction(
  uuid, jsonb, public.payment_method, numeric, uuid, numeric, numeric, text
) to authenticated, service_role;
grant execute on function public.void_transaction(uuid, text) to authenticated, service_role;
grant execute on function public.adjust_stock(
  uuid, text, numeric, public.adjust_reason, text
) to authenticated, service_role;
