-- ============================================================================
-- 01 / Sale happy path, idempotency, last-unit race, cash underpayment,
--      discounts > subtotal, cashier cost-price leak.
-- Run with: supabase test db
-- ============================================================================
begin;

create extension if not exists pgtap;
select no_plan();

-- ----------------------------------------------------------------------------
-- Fixtures (auth.users insert also creates public.users via trigger)
-- ----------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  -- Insert the ADMIN first: the first-ever profile becomes ADMIN, and the
  -- last-active-admin guard blocks demoting it before another admin exists.
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin@firelle.test', '', now(),
   '{}'::jsonb, '{"full_name":"Admin Toko"}'::jsonb, now(), now()),
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cashier@firelle.test', '', now(),
   '{}'::jsonb, '{"full_name":"Kasir Satu"}'::jsonb, now(), now()),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cashier2@firelle.test', '', now(),
   '{}'::jsonb, '{"full_name":"Kasir Dua"}'::jsonb, now(), now())
on conflict (id) do nothing;

update public.users set role = 'ADMIN'   where id = '22222222-2222-4222-8222-222222222222';
update public.users set role = 'CASHIER' where id = '11111111-1111-4111-8111-111111111111';
update public.users set role = 'CASHIER' where id = '33333333-3333-4333-8333-333333333333';

insert into public.clients (id, name, is_walk_in, is_active)
values ('cccccccc-0001-4000-8000-000000000001', 'Pelanggan Uji', false, true)
on conflict (id) do nothing;

insert into public.products (
  id, sku, name, unit, cost_price, selling_price, stock, min_stock
)
values
  ('aaaaaaaa-0001-4000-8000-000000000001', 'TST-001', 'Pashmina Uji',
   'Pcs', 40000.00, 50000.00, 5.000, 1.000),
  ('aaaaaaaa-0002-4000-8000-000000000002', 'TST-002', 'Bella Uji',
   'Pcs', 10000.00, 20000.00, 10.000, 1.000),
  ('aaaaaaaa-0003-4000-8000-000000000003', 'TST-003', 'Bergo Uji',
   'Pcs', 10000.00, 20000.00, 1.000, 1.000)
on conflict (id) do nothing;

-- Impersonation helper: sets JWT claims then switches to the authenticated role.
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
-- Happy path + idempotency
-- ----------------------------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');

select lives_ok(
  $$
    select public.create_transaction(
      'cccccccc-0001-4000-8000-000000000001'::uuid,
      '[{"product_id":"aaaaaaaa-0001-4000-8000-000000000001","qty":1}]'::jsonb,
      'CASH'::public.payment_method,
      50000,
      'dddddddd-0001-4000-8000-000000000001'::uuid
    )
  $$,
  'cashier can complete a cash sale'
);

select is(
  (select stock from public.products where id = 'aaaaaaaa-0001-4000-8000-000000000001'),
  4.000::numeric,
  'stock decremented by 1'
);

select is(
  (select count(*) from public.transactions),
  1::bigint,
  'one transaction written'
);

select is(
  (select total_amount from public.transactions
   where idempotency_key = 'dddddddd-0001-4000-8000-000000000001'),
  50000.00::numeric,
  'transaction total is snapshotted'
);

select is(
  (select subtotal from public.transaction_items
   where transaction_id = (
     select id from public.transactions
     where idempotency_key = 'dddddddd-0001-4000-8000-000000000001'
   )),
  50000.00::numeric,
  'line subtotal is snapshotted'
);

-- Cost/profit and the internal ledgers are ADMIN-only. Read the snapshotted
-- profit through the guarded admin view.
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');

select is(
  (select subtotal_profit from public.transaction_items_admin
   where transaction_id = (
     select id from public.transactions
     where idempotency_key = 'dddddddd-0001-4000-8000-000000000001'
   )),
  10000.00::numeric,
  'line profit is snapshotted'
);

select is(
  (select count(*) from public.stock_movements
   where type = 'SALE'
     and product_id = 'aaaaaaaa-0001-4000-8000-000000000001'),
  1::bigint,
  'one SALE movement written'
);

select is(
  (select count(*) from public.cashflows
   where type = 'IN'
     and is_manual = false
     and transaction_id = (
       select id from public.transactions
       where idempotency_key = 'dddddddd-0001-4000-8000-000000000001'
     )),
  1::bigint,
  'one auto IN cashflow written'
);

-- Same key again: must return the same row and must not decrement again.
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');

select lives_ok(
  $$
    select public.create_transaction(
      'cccccccc-0001-4000-8000-000000000001'::uuid,
      '[{"product_id":"aaaaaaaa-0001-4000-8000-000000000001","qty":1}]'::jsonb,
      'CASH'::public.payment_method,
      50000,
      'dddddddd-0001-4000-8000-000000000001'::uuid
    )
  $$,
  'replaying the idempotency key succeeds'
);

select is(
  (select stock from public.products where id = 'aaaaaaaa-0001-4000-8000-000000000001'),
  4.000::numeric,
  'idempotent replay does not decrement stock again'
);

select is(
  (select count(*) from public.transactions),
  1::bigint,
  'idempotent replay does not create a second transaction'
);

-- ----------------------------------------------------------------------------
-- Last-unit race (serialized by SELECT ... FOR UPDATE)
-- ----------------------------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');

select lives_ok(
  $$
    select public.create_transaction(
      'cccccccc-0001-4000-8000-000000000001'::uuid,
      '[{"product_id":"aaaaaaaa-0003-4000-8000-000000000003","qty":1}]'::jsonb,
      'CASH'::public.payment_method, 20000,
      'dddddddd-0003-4000-8000-000000000003'::uuid
    )
  $$,
  'first buyer takes the last unit'
);

select pg_temp.act_as('33333333-3333-4333-8333-333333333333');

select throws_ok(
  $$
    select public.create_transaction(
      'cccccccc-0001-4000-8000-000000000001'::uuid,
      '[{"product_id":"aaaaaaaa-0003-4000-8000-000000000003","qty":1}]'::jsonb,
      'CASH'::public.payment_method, 20000,
      'dddddddd-0004-4000-8000-000000000004'::uuid
    )
  $$,
  'FR001',
  'INSUFFICIENT_STOCK',
  'second buyer is rejected when stock is 0'
);

select is(
  (select stock from public.products where id = 'aaaaaaaa-0003-4000-8000-000000000003'),
  0.000::numeric,
  'stock never goes negative'
);

-- ----------------------------------------------------------------------------
-- Cash underpayment
-- ----------------------------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');

select throws_ok(
  $$
    select public.create_transaction(
      'cccccccc-0001-4000-8000-000000000001'::uuid,
      '[{"product_id":"aaaaaaaa-0002-4000-8000-000000000002","qty":1}]'::jsonb,
      'CASH'::public.payment_method, 5000,
      'dddddddd-0005-4000-8000-000000000005'::uuid
    )
  $$,
  'FR005',
  'INSUFFICIENT_PAYMENT',
  'cash underpayment is rejected'
);

-- ----------------------------------------------------------------------------
-- Discounts greater than the subtotal
-- ----------------------------------------------------------------------------
select throws_ok(
  $$
    select public.create_transaction(
      'cccccccc-0001-4000-8000-000000000001'::uuid,
      '[{"product_id":"aaaaaaaa-0002-4000-8000-000000000002","qty":1,"discount_amount":30000}]'::jsonb,
      'CASH'::public.payment_method, 20000,
      'dddddddd-0006-4000-8000-000000000006'::uuid
    )
  $$,
  'FR004',
  'DISCOUNT_EXCEEDS_SUBTOTAL',
  'line discount greater than line subtotal is rejected'
);

select throws_ok(
  $$
    select public.create_transaction(
      'cccccccc-0001-4000-8000-000000000001'::uuid,
      '[{"product_id":"aaaaaaaa-0002-4000-8000-000000000002","qty":1}]'::jsonb,
      'CASH'::public.payment_method, 0,
      'dddddddd-0007-4000-8000-000000000007'::uuid,
      30000
    )
  $$,
  'FR004',
  'DISCOUNT_EXCEEDS_SUBTOTAL',
  'header discount greater than subtotal is rejected'
);

-- ----------------------------------------------------------------------------
-- Cashier must not read cost/profit from the base tables
-- ----------------------------------------------------------------------------
select throws_ok(
  'select cost_price from public.products limit 1',
  '42501',
  'cashier cannot select products.cost_price'
);

select throws_ok(
  'select * from public.products limit 1',
  '42501',
  'cashier cannot select * from the base products table'
);

select lives_ok(
  'select * from public.products_cashier',
  'cashier product view is readable'
);

select is(
  (select count(*) from public.products_admin),
  0::bigint,
  'cashier sees zero rows in products_admin'
);

select throws_ok(
  'select total_cost from public.transactions limit 1',
  '42501',
  'cashier cannot select transactions.total_cost'
);

select throws_ok(
  'select total_profit from public.transactions limit 1',
  '42501',
  'cashier cannot select transactions.total_profit'
);

select throws_ok(
  'select * from public.transactions limit 1',
  '42501',
  'cashier cannot select * from the base transactions table'
);

select throws_ok(
  'select subtotal_profit from public.transaction_items limit 1',
  '42501',
  'cashier cannot select transaction_items.subtotal_profit'
);

-- The owning cashier can read their own lines through the safe view.
select is(
  (select count(*) > 0 from public.transaction_items_cashier),
  true,
  'owning cashier reads transaction items through the safe view'
);

-- Admin can read cost/profit only through the guarded views.
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');

select is(
  (select cost_price from public.products_admin
   where id = 'aaaaaaaa-0001-4000-8000-000000000001'),
  40000.00::numeric,
  'admin reads cost_price through products_admin'
);

select is(
  (select count(*) > 0 from public.transaction_items_admin),
  true,
  'admin reads cost/profit through transaction_items_admin'
);

select is(
  (select total_cost from public.transactions_admin
   where idempotency_key = 'dddddddd-0001-4000-8000-000000000001'),
  40000.00::numeric,
  'admin reads transaction cost through transactions_admin'
);

select is(
  (select total_profit from public.transactions_admin
   where idempotency_key = 'dddddddd-0001-4000-8000-000000000001'),
  10000.00::numeric,
  'admin reads transaction profit through transactions_admin'
);

reset role;

select * from finish();
rollback;
