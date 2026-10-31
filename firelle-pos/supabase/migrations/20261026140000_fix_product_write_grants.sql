-- ============================================================================
-- 15 / Fix: product & gallery writes rejected with 42501 for ADMIN
--
-- Root cause
-- ----------
-- 20261022120600_rls_views.sql gives `authenticated` INSERT/UPDATE on
-- public.products, but deliberately withholds SELECT on `cost_price` on the
-- base table (column-level GRANT). An INSERT/UPDATE ... RETURNING * therefore
-- fails with 42501 ("permission denied for table products") because the
-- RETURNING clause reads a column the caller cannot SELECT — even though the
-- write itself is authorized by the products_insert_admin /
-- products_update_admin policies and current_role() = 'ADMIN'.
--
-- The application triggered exactly that path:
--   * createProduct()  -> insert(...).select("*")
--   * updateProduct()  -> update(...) followed by a full re-read
-- which is what surfaced as "Akses ditolak. Hanya akun dengan peran ADMIN...".
--
-- The base-table column privileges are NOT loosened here: keeping cost_price
-- unreadable by `authenticated` is the point of the products_admin view. The
-- client was switched to select only the cost-free columns instead (see
-- src/lib/supabase/products.ts).
--
-- This migration therefore re-asserts, idempotently and explicitly, the
-- privileges + policies both write paths depend on, and recreates
-- current_role() so a stale definition cannot shadow the is_active check.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Products: column privileges (cost_price stays hidden)
-- ----------------------------------------------------------------------------
grant select (
  id, sku, barcode, name, unit, selling_price, stock, min_stock,
  is_deleted, deleted_at, created_at, updated_at
) on table public.products to authenticated;

grant insert, update on table public.products to authenticated;

-- Security-invoker views re-check the caller's privileges on the base table.
revoke all on table public.products_admin, public.products_cashier
  from anon, authenticated;
grant select on table public.products_admin, public.products_cashier
  to authenticated, service_role;

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

-- ----------------------------------------------------------------------------
-- 2. Product gallery
-- ----------------------------------------------------------------------------
revoke all on table public.product_images from anon, authenticated;
grant select, insert, update, delete on table public.product_images
  to authenticated;
grant all on table public.product_images to service_role;

drop policy if exists product_images_select_scope on public.product_images;
create policy product_images_select_scope on public.product_images
  for select to authenticated
  using (
    public.current_role() is not null
    and (
      public.current_role() = 'ADMIN'
      or exists (
        select 1 from public.products p
        where p.id = product_id
          and not p.is_deleted
      )
    )
  );

drop policy if exists product_images_insert_admin on public.product_images;
create policy product_images_insert_admin on public.product_images
  for insert to authenticated
  with check (public.current_role() = 'ADMIN');

drop policy if exists product_images_update_admin on public.product_images;
create policy product_images_update_admin on public.product_images
  for update to authenticated
  using (public.current_role() = 'ADMIN')
  with check (public.current_role() = 'ADMIN');

drop policy if exists product_images_delete_admin on public.product_images;
create policy product_images_delete_admin on public.product_images
  for delete to authenticated
  using (public.current_role() = 'ADMIN');

-- ----------------------------------------------------------------------------
-- 3. Storage bucket object policies
-- ----------------------------------------------------------------------------
drop policy if exists product_images_storage_read on storage.objects;
create policy product_images_storage_read on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images');

drop policy if exists product_images_storage_insert_admin on storage.objects;
create policy product_images_storage_insert_admin on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and public.current_role() = 'ADMIN'
  );

drop policy if exists product_images_storage_update_admin on storage.objects;
create policy product_images_storage_update_admin on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-images'
    and public.current_role() = 'ADMIN'
  )
  with check (
    bucket_id = 'product-images'
    and public.current_role() = 'ADMIN'
  );

drop policy if exists product_images_storage_delete_admin on storage.objects;
create policy product_images_storage_delete_admin on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and public.current_role() = 'ADMIN'
  );

-- ----------------------------------------------------------------------------
-- 4. current_role()
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

reset search_path;
