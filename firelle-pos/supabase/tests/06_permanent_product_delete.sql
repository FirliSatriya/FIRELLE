-- ============================================================================
-- 06 / Permanent delete for archived products
--
-- Covers `delete_product_permanently()`:
--   * ADMIN only (FR009)
--   * archived first (FR027)
--   * no transaction history (FR026)
--   * successful purge removes the product, its own ledger and gallery rows
--   * unknown id (FR013)
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
values ('cccccccc-0006-4000-8000-000000000001', 'Pelanggan Hapus', false, true)
on conflict (id) do nothing;

insert into public.products (
  id, sku, name, unit, cost_price, selling_price, stock, min_stock
)
values
  -- Still active: must be archived before a purge.
  ('aaaaaaaa-0006-4000-8000-000000000001', 'TST-601', 'Produk Masih Aktif',
   'Pcs', 10000.00, 20000.00, 5.000, 1.000),
  -- Sold once, then archived: financial history keeps it alive.
  ('aaaaaaaa-0006-4000-8000-000000000002', 'TST-602', 'Produk Terjual',
   'Pcs', 10000.00, 20000.00, 5.000, 1.000),
  -- Archived but never sold: purging is allowed.
  ('aaaaaaaa-0006-4000-8000-000000000003', 'TST-603', 'Produk Salah Input',
   'Pcs', 10000.00, 20000.00, 5.000, 1.000)
on conflict (id) do nothing;

-- The purgeable product owns a stock adjustment and one gallery row.
insert into public.stock_movements (
  id, product_id, type, qty_change, stock_after, reason, created_by
)
values (
  'eeeeeeee-0006-4000-8000-000000000001',
  'aaaaaaaa-0006-4000-8000-000000000003',
  'ADJUSTMENT_IN', 1.000, 6.000, 'RESTOCK'::public.adjust_reason,
  '22222222-2222-4222-8222-222222222222'
)
on conflict (id) do nothing;

insert into public.product_images (
  id, product_id, storage_path, position, is_primary
)
values (
  'ffffffff-0006-4000-8000-000000000001',
  'aaaaaaaa-0006-4000-8000-000000000003',
  'aaaaaaaa-0006-4000-8000-000000000003/test.jpg', 0, true
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
-- Cashier sells one unit, then the product is archived
-- ----------------------------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');

select lives_ok(
  $$
    select public.create_transaction(
      'cccccccc-0006-4000-8000-000000000001'::uuid,
      '[{"product_id":"aaaaaaaa-0006-4000-8000-000000000002","qty":1}]'::jsonb,
      'CASH'::public.payment_method,
      20000,
      'dddddddd-0006-4000-8000-000000000001'::uuid
    )
  $$,
  'cashier sells the product that will keep its history'
);

-- A cashier may never purge, even an archived product.
select throws_ok(
  $$
    select public.delete_product_permanently(
      'aaaaaaaa-0006-4000-8000-000000000003'::uuid
    )
  $$,
  'FR009',
  'FORBIDDEN',
  'cashier cannot delete a product permanently'
);

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');

update public.products
set is_deleted = true, deleted_at = now()
where id in (
  'aaaaaaaa-0006-4000-8000-000000000002',
  'aaaaaaaa-0006-4000-8000-000000000003'
);

-- ----------------------------------------------------------------------------
-- Guards
-- ----------------------------------------------------------------------------
select throws_ok(
  $$
    select public.delete_product_permanently(
      'aaaaaaaa-0006-4000-8000-000000000001'::uuid
    )
  $$,
  'FR027',
  'PRODUCT_NOT_ARCHIVED',
  'an active product cannot be purged'
);

select throws_ok(
  $$
    select public.delete_product_permanently(
      'aaaaaaaa-0006-4000-8000-000000000002'::uuid
    )
  $$,
  'FR026',
  'PRODUCT_HAS_HISTORY',
  'a product with sales history cannot be purged'
);

-- ----------------------------------------------------------------------------
-- Successful purge
-- ----------------------------------------------------------------------------
select lives_ok(
  $$
    select public.delete_product_permanently(
      'aaaaaaaa-0006-4000-8000-000000000003'::uuid
    )
  $$,
  'admin purges an archived product without transaction history'
);

select is(
  (select count(*) from public.products
   where id = 'aaaaaaaa-0006-4000-8000-000000000003'),
  0::bigint,
  'purged product row is gone'
);

select is(
  (select count(*) from public.stock_movements
   where product_id = 'aaaaaaaa-0006-4000-8000-000000000003'),
  0::bigint,
  'own stock ledger rows are purged with the product'
);

select is(
  (select count(*) from public.product_images
   where product_id = 'aaaaaaaa-0006-4000-8000-000000000003'),
  0::bigint,
  'gallery rows cascade with the product'
);

select is(
  (select count(*) from public.products
   where id = 'aaaaaaaa-0006-4000-8000-000000000002'),
  1::bigint,
  'the sold product survives the refused purge'
);

select throws_ok(
  $$
    select public.delete_product_permanently(
      'aaaaaaaa-0006-4000-8000-000000000003'::uuid
    )
  $$,
  'FR013',
  'PRODUCT_NOT_FOUND',
  'purging the same product twice fails cleanly'
);

reset role;

select * from finish();
rollback;
