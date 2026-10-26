-- ============================================================================
-- 13 / Retire the walk-in client
--
-- Every sale now needs an explicit customer, so the shared "Pelanggan Umum"
-- row and its protection trigger are removed. POS enforces the selection in
-- the UI; `create_transaction(null, ...)` fails naturally with FR017 because
-- no active walk-in row exists anymore.
--
-- The `clients.is_walk_in` column is kept (deprecated) so historical rows and
-- the existing cashier insert policy stay valid without a table rewrite.
-- ============================================================================

-- 1. The walk-in guard no longer applies.
drop trigger if exists clients_prevent_walk_in_mutation on public.clients;
drop function if exists public.prevent_walk_in_client_mutation();

-- 2. Detach any historical transactions from the walk-in row. The
--    transactions.client_name snapshot keeps the receipt readable.
update public.transactions t
set client_id = null
where t.client_id in (
  select c.id
  from public.clients c
  where c.is_walk_in
);

-- 3. Remove every walk-in row (the seeded "Pelanggan Umum").
delete from public.clients where is_walk_in;

-- 4. The one-walk-in-row index is meaningless once the concept is retired.
drop index if exists public.clients_single_walk_in_key;

comment on column public.clients.is_walk_in is
  'Deprecated: walk-in clients are retired; every sale requires a real client.';

reset search_path;
