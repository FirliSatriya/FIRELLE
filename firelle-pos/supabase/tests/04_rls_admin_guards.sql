-- ============================================================================
-- 04 / RLS matrix, last-active-admin guard, transaction DELETE guard,
--      walk-in-client protection
-- ============================================================================
begin;

create extension if not exists pgtap;
select no_plan();

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  -- First profile becomes ADMIN; keep that row first so the fixture does not
  -- try to demote the only active admin.
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin@firelle.test', '', now(),
   '{}'::jsonb, '{"full_name":"Admin Toko"}'::jsonb, now(), now()),
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cashier@firelle.test', '', now(),
   '{}'::jsonb, '{"full_name":"Kasir Satu"}'::jsonb, now(), now())
on conflict (id) do nothing;

update public.users set role = 'ADMIN'   where id = '22222222-2222-4222-8222-222222222222';
update public.users set role = 'CASHIER' where id = '11111111-1111-4111-8111-111111111111';

insert into public.clients (id, name, is_walk_in, is_active)
values ('cccccccc-0002-4000-8000-000000000002', 'Pelanggan Guard', false, true)
on conflict (id) do nothing;

insert into public.products (
  id, sku, name, unit, cost_price, selling_price, stock, min_stock
)
values (
  'aaaaaaaa-0004-4000-8000-000000000004', 'TST-004', 'Produk Guard',
  'Pcs', 10000.00, 20000.00, 5.000, 1.000
)
on conflict (id) do nothing;

create or replace function pg_temp.act_as(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
end;
$$;

-- ----------------------------------------------------------------------------
-- CASHIER: own sales only; no cashflow or stock-ledger access
-- ----------------------------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');

select lives_ok(
  $$
    select public.create_transaction(
      'cccccccc-0002-4000-8000-000000000002'::uuid,
      '[{"product_id":"aaaaaaaa-0004-4000-8000-000000000004","qty":1}]'::jsonb,
      'CASH'::public.payment_method,
      20000,
      'dddddddd-0008-4000-8000-000000000008'::uuid
    )
  $$,
  'cashier creates a sale through the RPC'
);

select is(
  (select count(*) from public.transactions),
  1::bigint,
  'cashier reads own transaction'
);

select is(
  (select count(*) from public.cashflows),
  0::bigint,
  'cashier cannot read cashflows'
);

select is(
  (select count(*) from public.stock_movements),
  0::bigint,
  'cashier cannot read the stock ledger'
);

-- ----------------------------------------------------------------------------
-- Last active ADMIN cannot be removed, deactivated or demoted
-- ----------------------------------------------------------------------------
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');

select throws_ok(
  $$ update public.users set is_active = false
     where id = '22222222-2222-4222-8222-222222222222' $$,
  'FR022',
  'LAST_ACTIVE_ADMIN',
  'cannot deactivate the last active ADMIN'
);

select throws_ok(
  $$ update public.users set role = 'CASHIER'
     where id = '22222222-2222-4222-8222-222222222222' $$,
  'FR022',
  'LAST_ACTIVE_ADMIN',
  'cannot demote the last active ADMIN'
);

select lives_ok(
  $$ update public.users set role = 'ADMIN'
     where id = '11111111-1111-4111-8111-111111111111' $$,
  'can promote a second ADMIN'
);

select lives_ok(
  $$ update public.users set is_active = false
     where id = '11111111-1111-4111-8111-111111111111' $$,
  'can deactivate an ADMIN while another remains'
);

select lives_ok(
  $$ update public.users set is_active = true
     where id = '11111111-1111-4111-8111-111111111111' $$,
  'can reactivate the second ADMIN'
);

select lives_ok(
  $$ update public.users set role = 'CASHIER'
     where id = '11111111-1111-4111-8111-111111111111' $$,
  'can demote an ADMIN while another remains'
);

-- ----------------------------------------------------------------------------
-- Seeded walk-in client is immutable
-- ----------------------------------------------------------------------------
reset role;

insert into public.clients (id, name, is_walk_in, is_active)
values ('c1c1c1c1-0001-4000-8000-000000000001', 'Pelanggan Umum', true, true)
on conflict do nothing;

select throws_ok(
  $$ update public.clients set name = 'Hacked' where is_walk_in $$,
  'FR024',
  'WALK_IN_CLIENT_PROTECTED',
  'walk-in client cannot be edited or deactivated'
);

select throws_ok(
  $$ delete from public.clients where is_walk_in $$,
  'FR024',
  'WALK_IN_CLIENT_PROTECTED',
  'walk-in client cannot be deleted'
);

-- ----------------------------------------------------------------------------
-- Financial rows are never hard-deleted
-- ----------------------------------------------------------------------------
select throws_ok(
  $$ delete from public.transactions $$,
  'FR023',
  'TRANSACTION_DELETE_FORBIDDEN',
  'transaction DELETE is blocked for every role'
);

select throws_ok(
  $$ delete from public.users
     where id = '22222222-2222-4222-8222-222222222222' $$,
  'FR022',
  'LAST_ACTIVE_ADMIN',
  'cannot delete the last active ADMIN even as table owner'
);

select * from finish();
rollback;
