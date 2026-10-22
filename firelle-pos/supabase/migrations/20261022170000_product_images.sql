-- ============================================================================
-- 11 / Product image gallery + Storage bucket
--
-- Adds a multi-image gallery per product:
--   * public.product_images keeps the ordered gallery plus one primary image;
--   * one Storage bucket 'product-images' holds the uploaded files;
--   * ADMIN owns every write, both roles may read.
--
-- Files live in Storage; product_images only stores the object path plus the
-- resolved public URL. Deleting a row does not touch the object, so the
-- application removes the file first (see src/lib/supabase/product-images.ts).
--
-- Error contract added here:
--   FR025 TOO_MANY_PRODUCT_IMAGES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table
-- ----------------------------------------------------------------------------
create table if not exists public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  storage_path text not null check (length(btrim(storage_path)) > 0),
  alt_text     text,
  position     integer not null default 0 check (position >= 0),
  is_primary   boolean not null default false,
  created_by   uuid references public.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint product_images_storage_path_key unique (storage_path)
);

-- At most one primary image per product.
create unique index if not exists product_images_primary_key
  on public.product_images (product_id)
  where is_primary;

create index if not exists product_images_product_position_idx
  on public.product_images (product_id, position, created_at);

drop trigger if exists product_images_set_updated_at on public.product_images;
create trigger product_images_set_updated_at
  before update on public.product_images
  for each row execute function public.set_updated_at();

comment on table public.product_images is
  'Ordered product photo gallery. is_primary marks the thumbnail used in lists.';

-- A product may hold a bounded gallery; enforced in the DB so every writer
-- (API, RPC, service_role) shares the same ceiling.
create or replace function public.enforce_product_image_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.product_images pi
  where pi.product_id = new.product_id;

  if v_count >= 8 then
    raise exception using errcode = 'FR025',
      message = 'TOO_MANY_PRODUCT_IMAGES',
      detail = 'A product may hold at most 8 images.';
  end if;

  return new;
end;
$$;

drop trigger if exists product_images_enforce_limit on public.product_images;
create trigger product_images_enforce_limit
  before insert on public.product_images
  for each row execute function public.enforce_product_image_limit();

revoke all on function public.enforce_product_image_limit() from public;
revoke all on function public.enforce_product_image_limit() from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. RLS
-- ----------------------------------------------------------------------------
alter table public.product_images enable row level security;

-- Gallery rows follow product visibility: ADMIN sees everything, CASHIER sees
-- active products only. Cost is not part of this table.
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
-- 3. Privileges
-- ----------------------------------------------------------------------------
revoke all on table public.product_images from anon, authenticated;

grant select, insert, update, delete on table public.product_images
  to authenticated;
grant all on table public.product_images to service_role;

-- Cashier-safe gallery view: image rows for active products, no product cost.
create or replace view public.product_images_cashier
with (security_invoker = true)
as
select
  pi.id,
  pi.product_id,
  pi.storage_path,
  pi.alt_text,
  pi.position,
  pi.is_primary,
  pi.created_at,
  pi.updated_at
from public.product_images pi;

comment on view public.product_images_cashier is
  'Product gallery rows without created_by, mirroring products_cashier visibility.';

revoke all on table public.product_images_cashier from anon, authenticated;
grant select on table public.product_images_cashier
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Storage bucket + object policies
--
-- 5 MB image uploads, public read so <img src> works without signed URLs.
-- Writes are restricted to ADMIN through current_role().
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MiB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

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

reset search_path;