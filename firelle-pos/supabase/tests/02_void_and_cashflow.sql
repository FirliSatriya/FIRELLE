-- ============================================================================
-- 02 / Void flow, double void, auto-cashflow immutability, cashier cashflow denial
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
values ('cccccccc-0001-4000-8000-000000000001', 'Pelanggan Uji', false, true)
on conflict (id) do nothing;

insert into public.products (
  id, sku, name, unit, cost_price, selling_price, stock, min_stock
)
values (
  'aaaaaaaa-0001-4000-8000-000000000001', 'TST-001', 'Pashmina Uji',
  'Pcs', 40000.00, 50000.00, 5.000, 1.000
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
-- Sale by cashier, void by admin
-- ----------------------------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');

select lives_ok(
  $$
    select public.create_transaction(
      'cccccccc-0001-4000-8000-000000000001'::uuid,
      '[{"product_id":"aaaaaaaa-0001-4000-8000-000000000001","qty":2}]'::jsonb,
      'CASH'::public.payment_method,
      100000,
      'dddddddd-0001-4000-8000-000000000001'::uuid
    )
  $$,
  'cashier completes a sale'
);

select is(
  (select stock from public.products where id = 'aaaaaaaa-0001-4000-8000-000000000001'),
  3.000::numeric,
  'stock is 3 after selling 2 of 5'
);

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');

select lives_ok(
  $$
    select public.void_transaction(
      (select id from public.transactions
       where idempotency_key = 'dddddddd-0001-4000-8000-000000000001'),
      'Salah input'
    )
  $$,
  'admin can void a completed sale'
);

select is(
  (select status from public.transactions
   where idempotency_key = 'dddddddd-0001-4000-8000-000000000001'),
  'VOID'::public.txn_status,
  'transaction status becomes VOID'
);

select is(
  (select stock from public.products where id = 'aaaaaaaa-0001-4000-8000-000000000001'),
  5.000::numeric,
  'void restores stock'
);

select is(
  (select count(*) from public.stock_movements where type = 'VOID_RETURN'),
  1::bigint,
  'one VOID_RETURN movement written'
);

select is(
  (select count(*) from public.cashflows
   where type = 'OUT' and is_manual = false),
  1::bigint,
  'one auto OUT cashflow written'
);

-- ----------------------------------------------------------------------------
-- Double void
-- ----------------------------------------------------------------------------
select throws_ok(
  $$
    select public.void_transaction(
      (select id from public.transactions
       where idempotency_key = 'dddddddd-0001-4000-8000-000000000001'),
      'again'
    )
  $$,
  'FR006',
  'ALREADY_VOID',
  'voiding the same transaction twice is rejected'
);

-- Cashier cannot void (even their own sale).
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');

select throws_ok(
  $$
    select public.void_transaction(
      (select id from public.transactions
       where idempotency_key = 'dddddddd-0001-4000-8000-000000000001'),
      'cashier attempt'
    )
  $$,
  'FR009',
  'FORBIDDEN',
  'cashier cannot void transactions'
);

-- Cashier cannot mutate auto cashflows. RLS hides them, so the UPDATE is a
-- no-op; verify as ADMIN that the snapshotted amount is unchanged.
update public.cashflows
set amount = 1.00
where transaction_id = (
  select id from public.transactions
  where idempotency_key = 'dddddddd-0001-4000-8000-000000000001'
)
and type = 'IN';

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');

select is(
  (select amount from public.cashflows
   where transaction_id = (
     select id from public.transactions
     where idempotency_key = 'dddddddd-0001-4000-8000-000000000001'
   )
   and type = 'IN'),
  100000.00::numeric,
  'cashier cannot update an auto cashflow'
);

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');

-- ----------------------------------------------------------------------------
-- Auto cashflows are immutable at the DB level (trigger, not just RLS)
-- ----------------------------------------------------------------------------
reset role;

select throws_ok(
  $$ update public.cashflows set amount = 1.00 where is_manual = false $$,
  'FR014',
  'IMMUTABLE_CASHFLOW',
  'auto cashflow UPDATE is rejected by trigger'
);

select throws_ok(
  $$ delete from public.cashflows where is_manual = false $$,
  'FR014',
  'IMMUTABLE_CASHFLOW',
  'auto cashflow DELETE is rejected by trigger'
);

-- Manual cashflows are ADMIN-only.
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');

select lives_ok(
  $$
    insert into public.cashflows (type, amount, category, description, created_by)
    values ('OUT', 15000.00, 'MISC', 'Beli plastik',
            '22222222-2222-4222-8222-222222222222')
  $$,
  'admin can insert a manual cashflow'
);

select lives_ok(
  $$ update public.cashflows set amount = 20000.00 where category = 'MISC' $$,
  'admin can update a manual cashflow'
);

-- CASHIER has no cashflow access at all under the RLS matrix.
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');

select is(
  (select count(*) from public.cashflows),
  0::bigint,
  'cashier cannot read cashflows'
);

select throws_ok(
  $$
    insert into public.cashflows (type, amount, category, description, created_by)
    values ('OUT', 15000.00, 'MISC', 'Beli plastik',
            '11111111-1111-4111-8111-111111111111')
  $$,
  '42501',
  'cashier cannot insert a manual cashflow'
);

update public.cashflows set amount = 1.00 where category = 'MISC';

-- Verify the no-op as ADMIN, because the cashier cannot see the row.
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');

select is(
  (select amount from public.cashflows where category = 'MISC'),
  20000.00::numeric,
  'cashier cannot update a manual cashflow'
);

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');

delete from public.cashflows where category = 'MISC';

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');

select is(
  (select count(*) from public.cashflows where category = 'MISC'),
  1::bigint,
  'cashier cannot delete a manual cashflow'
);

reset role;

select * from finish();
rollback;
