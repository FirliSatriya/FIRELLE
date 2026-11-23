-- ============================================================================
-- 09 / RLS matrix, cashier-safe products, financial-row guards
--
-- Re-asserts the complete policy matrix on top of the earlier RLS migration:
--
--   CASHIER : create sales through create_transaction(), read own
--             transactions/items, read active products without cost/profit,
--             create and read active clients.
--   ADMIN   : every other business read/write, including products, clients,
--             users, settings, manual cashflows, voids and stock adjustments.
--
-- Financial writes are deliberately RPC-only:
--   * no INSERT/UPDATE/DELETE policy on transactions (create_transaction /
--     void_transaction are SECURITY DEFINER RPCs);
--   * no INSERT/UPDATE/DELETE policy on stock_movements or invoice_counters;
--   * auto sale/void cashflows are written by RPCs, and the trigger below
--     makes them immutable even for service_role.
--
-- Error contract added here:
--   FR022 LAST_ACTIVE_ADMIN
--   FR023 TRANSACTION_DELETE_FORBIDDEN
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RLS on every application table
-- ----------------------------------------------------------------------------
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
-- 2. Role helper
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
  'Active application role for the JWT user, or NULL for anon/inactive users.';

revoke all on function public.current_role() from public;
revoke all on function public.current_role() from anon;
grant execute on function public.current_role() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Policies
-- ----------------------------------------------------------------------------

-- users: self-read for the profile, ADMIN sees/manages everyone.
drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users
  for select to authenticated
  using (id = auth.uid());

drop policy if exists users_select_admin on public.users;
create policy users_select_admin on public.users
  for select to authenticated
  using (public.current_role() = 'ADMIN');

drop policy if exists users_update_admin on public.users;
create policy users_update_admin on public.users
  for update to authenticated
  using (public.current_role() = 'ADMIN')
  with check (public.current_role() = 'ADMIN');

-- products: active rows are visible to both roles; cost is removed by column
-- grants. Only ADMIN may create/update (soft delete = update).
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

-- stock_movements: append-only ledger; ADMIN read only. Writes are RPC-only.
drop policy if exists stock_movements_select_scope on public.stock_movements;
drop policy if exists stock_movements_select_admin on public.stock_movements;
create policy stock_movements_select_admin on public.stock_movements
  for select to authenticated
  using (public.current_role() = 'ADMIN');

-- clients: CASHIER may read active clients and create active non-walk-in
-- clients. ADMIN may read archived rows and update/archive.
drop policy if exists clients_select_scope on public.clients;
create policy clients_select_scope on public.clients
  for select to authenticated
  using (
    public.current_role() is not null
    and (
      public.current_role() = 'ADMIN'
      or is_active
    )
  );

drop policy if exists clients_insert_active_user on public.clients;
create policy clients_insert_active_user on public.clients
  for insert to authenticated
  with check (
    public.current_role() is not null
    and (
      public.current_role() = 'ADMIN'
      or (is_active and not is_walk_in)
    )
  );

drop policy if exists clients_update_admin on public.clients;
create policy clients_update_admin on public.clients
  for update to authenticated
  using (public.current_role() = 'ADMIN')
  with check (public.current_role() = 'ADMIN');

-- invoice_counters: no policy by design. Only next_invoice_number() touches it.

-- transactions: CASHIER sees only own rows; ADMIN sees all. No write policies:
-- create_transaction() and void_transaction() are the only supported writers.
drop policy if exists transactions_select_scope on public.transactions;
create policy transactions_select_scope on public.transactions
  for select to authenticated
  using (
    public.current_role() = 'ADMIN'
    or created_by = auth.uid()
  );

-- transaction_items: same ownership scope as the parent transaction.
drop policy if exists transaction_items_select_scope on public.transaction_items;
create policy transaction_items_select_scope on public.transaction_items
  for select to authenticated
  using (
    public.current_role() = 'ADMIN'
    or exists (
      select 1
      from public.transactions t
      where t.id = transaction_id
        and t.created_by = auth.uid()
    )
  );

-- cashflows: ADMIN only. CASHIER explicitly has no cashflow access.
drop policy if exists cashflows_select_scope on public.cashflows;
drop policy if exists cashflows_select_admin on public.cashflows;
create policy cashflows_select_admin on public.cashflows
  for select to authenticated
  using (public.current_role() = 'ADMIN');

drop policy if exists cashflows_insert_manual_self on public.cashflows;
drop policy if exists cashflows_insert_manual_admin on public.cashflows;
create policy cashflows_insert_manual_admin on public.cashflows
  for insert to authenticated
  with check (
    public.current_role() = 'ADMIN'
    and is_manual
    and transaction_id is null
    and created_by = auth.uid()
  );

-- UPDATE/DELETE USING is ADMIN-wide so an attempt on an auto row reaches the
-- immutability trigger and raises FR014 instead of silently matching 0 rows.
-- The trigger, not RLS, is the final guard for is_manual = false.
drop policy if exists cashflows_update_manual on public.cashflows;
drop policy if exists cashflows_update_manual_admin on public.cashflows;
drop policy if exists cashflows_update_admin on public.cashflows;
create policy cashflows_update_admin on public.cashflows
  for update to authenticated
  using (public.current_role() = 'ADMIN')
  with check (
    public.current_role() = 'ADMIN'
    and is_manual
    and transaction_id is null
  );

drop policy if exists cashflows_delete_manual on public.cashflows;
drop policy if exists cashflows_delete_manual_admin on public.cashflows;
drop policy if exists cashflows_delete_admin on public.cashflows;
create policy cashflows_delete_admin on public.cashflows
  for delete to authenticated
  using (public.current_role() = 'ADMIN');

-- settings: active users may read the store/receipt configuration; only ADMIN
-- may update it. There is no insert/delete policy (singleton row).
drop policy if exists settings_select_active on public.settings;
create policy settings_select_active on public.settings
  for select to authenticated
  using (public.current_role() is not null);

drop policy if exists settings_update_admin on public.settings;
create policy settings_update_admin on public.settings
  for update to authenticated
  using (public.current_role() = 'ADMIN')
  with check (public.current_role() = 'ADMIN');

-- ----------------------------------------------------------------------------
-- 4. Table privileges: safe columns only for CASHIER, writes gated by RLS
-- ----------------------------------------------------------------------------
revoke all on table public.users, public.products, public.stock_movements,
  public.clients, public.invoice_counters, public.transactions,
  public.transaction_items, public.cashflows, public.settings
from anon, authenticated;

-- products: every base column except cost_price.
grant select (
  id, sku, barcode, name, unit, selling_price, stock, min_stock,
  is_deleted, deleted_at, created_at, updated_at
) on table public.products to authenticated;
grant insert, update on table public.products to authenticated;

-- transaction_items: every base column except cost_price/subtotal_profit.
grant select (
  id, transaction_id, product_id, product_name, unit, qty,
  selling_price, subtotal, created_at
) on table public.transaction_items to authenticated;

-- transactions: every base column except total_cost/total_profit.
grant select (
  id, invoice_number, client_id, client_name, subtotal_amount,
  discount_amount, total_amount, payment_method, amount_paid,
  change_amount, status, idempotency_key, notes, void_reason, voided_at,
  voided_by, created_by, created_at, updated_at
) on table public.transactions to authenticated;

grant select, update on table public.users to authenticated;
grant select on table public.stock_movements to authenticated;
grant select, insert, update on table public.clients to authenticated;
grant select, insert, update, delete on table public.cashflows to authenticated;
grant select, update on table public.settings to authenticated;

-- invoice_counters intentionally has zero grants to authenticated.
grant all on all tables in schema public to service_role;

-- ----------------------------------------------------------------------------
-- 5. Cashier-safe product view (no cost column, caller's RLS/grants apply)
-- ----------------------------------------------------------------------------
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
  'Cashier product list: products columns minus cost_price.';

-- Keep the existing transaction-item cashier view grant-safe as well.
revoke all on table public.products_cashier, public.transaction_items_cashier,
  public.transactions_cashier
from anon, authenticated;
grant select on table public.products_cashier, public.transaction_items_cashier,
  public.transactions_cashier
to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. Triggers
-- ----------------------------------------------------------------------------

-- 6a. Auto-generated cashflows are immutable. This is a trigger, not just RLS,
-- so it also applies to service_role and table owners.
create or replace function public.prevent_auto_cashflow_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if not old.is_manual then
      raise exception using errcode = 'FR014', message = 'IMMUTABLE_CASHFLOW',
        detail = 'Auto-generated cashflow rows cannot be deleted.';
    end if;
    return old;
  end if;

  if not old.is_manual or not new.is_manual then
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

revoke all on function public.prevent_auto_cashflow_mutation() from public;
revoke all on function public.prevent_auto_cashflow_mutation() from anon, authenticated;

-- 6b. Never allow the last active ADMIN to be deleted, deactivated or demoted.
create or replace function public.protect_last_active_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_other_admins integer;
begin
  -- Serialize concurrent admin removals. Without this, two sessions could
  -- each remove one of the last two admins and both commit.
  perform pg_advisory_xact_lock(hashtext('firelle.last_active_admin')::bigint);

  if tg_op = 'DELETE' then
    if old.role = 'ADMIN' and old.is_active then
      select count(*) into v_other_admins
      from public.users u
      where u.role = 'ADMIN'
        and u.is_active
        and u.id <> old.id;

      if v_other_admins = 0 then
        raise exception using errcode = 'FR022', message = 'LAST_ACTIVE_ADMIN',
          detail = 'At least one active ADMIN must remain.';
      end if;
    end if;
    return old;
  end if;

  if old.role = 'ADMIN'
     and old.is_active
     and (new.role <> 'ADMIN' or not new.is_active) then
    select count(*) into v_other_admins
    from public.users u
    where u.role = 'ADMIN'
      and u.is_active
      and u.id <> old.id;

    if v_other_admins = 0 then
      raise exception using errcode = 'FR022', message = 'LAST_ACTIVE_ADMIN',
        detail = 'At least one active ADMIN must remain.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists users_protect_last_admin on public.users;
create trigger users_protect_last_admin
  before update or delete on public.users
  for each row execute function public.protect_last_active_admin();

revoke all on function public.protect_last_active_admin() from public;
revoke all on function public.protect_last_active_admin() from anon, authenticated;

-- 6c. Transactions are financial history: DELETE is blocked for every role.
create or replace function public.prevent_transaction_delete()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception using errcode = 'FR023',
    message = 'TRANSACTION_DELETE_FORBIDDEN',
    detail = 'Transactions cannot be deleted; void them instead.';
end;
$$;

drop trigger if exists transactions_prevent_delete on public.transactions;
create trigger transactions_prevent_delete
  before delete on public.transactions
  for each row execute function public.prevent_transaction_delete();

revoke all on function public.prevent_transaction_delete() from public;
revoke all on function public.prevent_transaction_delete() from anon, authenticated;
