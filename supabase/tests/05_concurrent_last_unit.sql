-- ============================================================================
-- 05 / Concurrent last-unit sale
--
-- Two independent sessions call create_transaction() for the last unit of the
-- same product. PostgreSQL row locking must serialize them: exactly one sale
-- succeeds and the other fails with FR001 INSUFFICIENT_STOCK.
--
-- Requires the dblink extension and a local Supabase database. The test uses
-- dedicated IDs and resets the product stock at the start, so it is repeatable.
-- Successful sales leave audit rows on purpose; transactions cannot be deleted.
-- ============================================================================
set search_path = public, extensions;
create schema if not exists extensions;

create extension if not exists pgtap;
create extension if not exists dblink with schema extensions;

select no_plan();

-- Resolve a dblink connection string that works from inside the DB server.
-- First try TCP on the server's own port, then the local socket.
create temp table dblink_cfg (connstr text);

do $do$
declare
  v_connstr text;
begin
  v_connstr := format(
    'host=127.0.0.1 port=%s dbname=%s user=postgres password=postgres',
    current_setting('port'),
    current_database()
  );

  begin
    perform dblink_connect('probe', v_connstr);
    perform dblink_disconnect('probe');
  exception when others then
    v_connstr := format('dbname=%s', current_database());
    perform dblink_connect('probe', v_connstr);
    perform dblink_disconnect('probe');
  end;

  insert into dblink_cfg values (v_connstr);
end;
$do$;

-- ----------------------------------------------------------------------------
-- Committed fixtures for the two sessions
-- ----------------------------------------------------------------------------
select dblink_connect('setup', (select connstr from dblink_cfg));

select dblink_exec('setup', $setup$
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  values
    ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
     'authenticated', 'authenticated', 'admin@firelle.test', '', now(),
     '{}'::jsonb, '{"full_name":"Admin Concurrency"}'::jsonb, now(), now()),
    ('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000',
     'authenticated', 'authenticated', 'cashier2@firelle.test', '', now(),
     '{}'::jsonb, '{"full_name":"Kasir Concurrency"}'::jsonb, now(), now())
  on conflict (id) do nothing;

  insert into public.users (id, full_name, email, role, is_active)
  values ('22222222-2222-4222-8222-222222222222', 'Admin Concurrency',
          'admin@firelle.test', 'ADMIN', true)
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        role = 'ADMIN',
        is_active = true;

  insert into public.users (id, full_name, email, role, is_active)
  values ('33333333-3333-4333-8333-333333333333', 'Kasir Concurrency',
          'cashier2@firelle.test', 'CASHIER', true)
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        role = 'CASHIER',
        is_active = true;

  insert into public.clients (id, name, is_active, is_walk_in)
  values ('c1c1c1c1-9999-4000-8000-000000000099', 'Concurrency Client', true, false)
  on conflict (id) do update
    set name = excluded.name,
        is_active = true,
        is_walk_in = false;

  insert into public.products (
    id, sku, name, unit, cost_price, selling_price, stock, min_stock,
    is_deleted, deleted_at
  )
  values (
    'a1b2c3d4-9999-4000-8000-000000000099', 'CONC-001', 'Concurrency Product',
    'Pcs', 10000.00, 20000.00, 1.000, 0.000, false, null
  )
  on conflict (id) do update
    set sku = excluded.sku,
        name = excluded.name,
        unit = excluded.unit,
        cost_price = excluded.cost_price,
        selling_price = excluded.selling_price,
        stock = 1.000,
        min_stock = excluded.min_stock,
        is_deleted = false,
        deleted_at = null;
$setup$);

select dblink_disconnect('setup');

-- ----------------------------------------------------------------------------
-- Two authenticated sessions, both calling create_transaction()
-- ----------------------------------------------------------------------------
select dblink_connect('c1', (select connstr from dblink_cfg));
select dblink_connect('c2', (select connstr from dblink_cfg));

select *
from dblink('c1', $auth$
  select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false)
$auth$) as t(v text);
select dblink_exec('c1', 'set role authenticated');

select *
from dblink('c2', $auth$
  select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false)
$auth$) as t(v text);
select dblink_exec('c2', 'set role authenticated');

create temp table dblink_keys as
select gen_random_uuid() as k1, gen_random_uuid() as k2;

create or replace function pg_temp.dblink_result(p_conn text)
returns text
language plpgsql
as $$
begin
  perform 1 from dblink_get_result(p_conn) as t(x int);
  return 'OK';
exception when others then
  return sqlstate || ':' || sqlerrm;
end;
$$;

-- Send both before collecting either so the two sessions overlap.
select dblink_send_query('c1', format($sql$
  select 1
  from public.create_transaction(
    %L::uuid,
    %L::jsonb,
    'CASH'::public.payment_method,
    20000,
    %L::uuid
  )
$sql$,
  'c1c1c1c1-9999-4000-8000-000000000099',
  '[{"product_id":"a1b2c3d4-9999-4000-8000-000000000099","qty":1}]',
  k1
))
from dblink_keys;

select dblink_send_query('c2', format($sql$
  select 1
  from public.create_transaction(
    %L::uuid,
    %L::jsonb,
    'CASH'::public.payment_method,
    20000,
    %L::uuid
  )
$sql$,
  'c1c1c1c1-9999-4000-8000-000000000099',
  '[{"product_id":"a1b2c3d4-9999-4000-8000-000000000099","qty":1}]',
  k2
))
from dblink_keys;

create temp table dblink_results as
select pg_temp.dblink_result('c1') as r1,
       pg_temp.dblink_result('c2') as r2;

select is(
  (select (r1 = 'OK')::int + (r2 = 'OK')::int from dblink_results),
  1,
  'exactly one concurrent last-unit sale succeeds'
);

select is(
  (select (r1 like 'FR001:%')::int + (r2 like 'FR001:%')::int
   from dblink_results),
  1,
  'the losing sale fails with FR001 INSUFFICIENT_STOCK'
);

select is(
  (select stock from public.products
   where id = 'a1b2c3d4-9999-4000-8000-000000000099'),
  0.000::numeric,
  'stock never goes negative'
);

select dblink_disconnect('c1');
select dblink_disconnect('c2');

select * from finish();
