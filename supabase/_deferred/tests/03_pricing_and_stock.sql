-- ============================================================================
-- 03 / Server-side prices, archived products, stock adjustment rules
-- ============================================================================
begin;

create extension if not exists pgtap;
select no_plan();

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cashier@firelle.test', '', now(),
   '{}'::jsonb, '{"full_name":"Kasir Satu"}'::jsonb, now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin@firelle.test', '', now(),
   '{}'::jsonb, '{"full_name":"Admin Toko"}'::jsonb, now(), now())
on conflict (id) do nothing;

update public.users set role = 'CASHIER' where id = '11111111-1111-4111-8111-111111111111';
update public.users set role = 'ADMIN'   where id = '22222222-2222-4222-8222-222222222222';

insert into public.clients (id, name, is_walk_in)
values ('cccccccc-0001-4000-8000-000000000001', 'Pelanggan Uji', false)
on conflict (id) do nothing;

insert into public.products (
  id, sku, name, unit, cost_price, selling_price, stock, min_stock
)
values
  ('aaaaaaaa-0001-4000-8000-000000000001', 'TST-001', 'Pashmina Uji',
   'Pcs', 40000.00, 50000.00, 3.000, 1.000),
  ('aaaaaaaa-0002-4000-8000-000000000002', 'TST-002', 'Produk Arsip',
   'Pcs', 10000.00, 20000.00, 5.000, 1.000)
on conflict (id) do nothing;

update public.products
set is_deleted = true, deleted_at = now()
where id = 'aaaaaaaa-0002-4000-8000-000000000002';

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

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');

-- ----------------------------------------------------------------------------
-- Stale client price is rejected, current price is accepted
-- ----------------------------------------------------------------------------
select throws_ok(
  $$
    select public.create_transaction(
      'cccccccc-0001-4000-8000-000000000001'::uuid,
      '[{"product_id":"aaaaaaaa-0001-4000-8000-000000000001","qty":1,"unit_price":40000}]'::jsonb,
      'CASH'::public.payment_method, 50000,
      'dddddddd-0001-4000-8000-000000000001'::uuid
    )
  $$,
  'FR003',
  'PRICE_CHANGED',
  'client-supplied unit_price must match the current DB price'
);

select lives_ok(
  $$
    select public.create_transaction(
      'cccccccc-0001-4000-8000-000000000001'::uuid,
      '[{"product_id":"aaaaaaaa-0001-4000-8000-000000000001","qty":1,"unit_price":50000}]'::jsonb,
      'CASH'::public.payment_method, 50000,
      'dddddddd-0002-4000-8000-000000000002'::uuid
    )
  $$,
  'matching unit_price is accepted'
);

-- ----------------------------------------------------------------------------
-- Archived products cannot be sold
-- ----------------------------------------------------------------------------
select throws_ok(
  $$
    select public.create_transaction(
      'cccccccc-0001-4000-8000-000000000001'::uuid,
      '[{"product_id":"aaaaaaaa-0002-4000-8000-000000000002","qty":1}]'::jsonb,
      'CASH'::public.payment_method, 20000,
      'dddddddd-0003-4000-8000-000000000003'::uuid
    )
  $$,
  'FR002',
  'PRODUCT_ARCHIVED',
  'archived products cannot be sold'
);

-- ----------------------------------------------------------------------------
-- Cashier cannot adjust stock
-- ----------------------------------------------------------------------------
select throws_ok(
  $$
    select public.adjust_stock(
      'aaaaaaaa-0001-4000-8000-000000000001'::uuid,
      'add', 1, 'RESTOCK'::public.adjust_reason, 'test'
    )
  $$,
  'FR009',
  'FORBIDDEN',
  'cashier cannot adjust stock'
);

-- ----------------------------------------------------------------------------
-- Admin adjustment rules
-- ----------------------------------------------------------------------------
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');

select throws_ok(
  $$
    select public.adjust_stock(
      'aaaaaaaa-0001-4000-8000-000000000001'::uuid,
      'deduct', 999, 'DAMAGED'::public.adjust_reason, 'too much'
    )
  $$,
  'FR001',
  'INSUFFICIENT_STOCK',
  'cannot deduct more than available stock'
);

select throws_ok(
  $$
    select public.adjust_stock(
      'aaaaaaaa-0001-4000-8000-000000000001'::uuid,
      'add', 0, 'RESTOCK'::public.adjust_reason, null
    )
  $$,
  'FR007',
  'INVALID_QUANTITY',
  'adjustment quantity must be positive'
);

select throws_ok(
  $$
    select public.adjust_stock(
      'aaaaaaaa-0001-4000-8000-000000000001'::uuid,
      'sideways', 1, 'RESTOCK'::public.adjust_reason, null
    )
  $$,
  'FR010',
  'INVALID_ADJUSTMENT',
  'direction must be add or deduct'
);

select throws_ok(
  $$
    select public.adjust_stock(
      'aaaaaaaa-0001-4000-8000-000000000001'::uuid,
      'add', 1, null, null
    )
  $$,
  'FR010',
  'INVALID_ADJUSTMENT',
  'adjustment reason is required'
);

select lives_ok(
  $$
    select public.adjust_stock(
      'aaaaaaaa-0001-4000-8000-000000000001'::uuid,
      'add', 2, 'RESTOCK'::public.adjust_reason, 'Restok supplier'
    )
  $$,
  'admin can add stock with a reason'
);

select is(
  (select stock from public.products where id = 'aaaaaaaa-0001-4000-8000-000000000001'),
  4.000::numeric,
  'stock is 4 after selling 1 and restocking 2'
);

select is(
  (select type from public.stock_movements
   where product_id = 'aaaaaaaa-0001-4000-8000-000000000001'
     and type = 'ADJUSTMENT_IN'
   order by created_at desc limit 1),
  'ADJUSTMENT_IN'::public.stock_movement_type,
  'ADJUSTMENT_IN movement written'
);

reset role;

select * from finish();
rollback;
