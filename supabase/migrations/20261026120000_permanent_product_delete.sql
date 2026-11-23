-- ============================================================================
-- 12 / Permanent product delete (archive screen only)
--
-- Archived products are normally kept forever so their sales snapshots stay
-- readable. Some rows are pure mistakes (wrong price, duplicate entry, test
-- data) and never reach a transaction; those may be purged for good.
--
-- `delete_product_permanently()` is the only supported hard delete:
--   * ADMIN only, and only for products that are already archived;
--   * refuses when any transaction line or transaction-linked stock movement
--     references the product (financial history stays immutable);
--   * removes the product's own stock ledger rows, then the product itself.
--     `product_images` follows the FK cascade; Storage objects are removed by
--     the application before this RPC runs (see src/lib/supabase/products.ts).
--
-- Error contract added here:
--   FR026 PRODUCT_HAS_HISTORY   product is referenced by a transaction
--   FR027 PRODUCT_NOT_ARCHIVED  archive the product first
-- Existing contract reused:
--   FR009 FORBIDDEN             caller is not an active ADMIN
--   FR013 PRODUCT_NOT_FOUND     unknown product id
-- ============================================================================

create or replace function public.delete_product_permanently(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_product public.products;
  v_has_history boolean;
begin
  -- --- Authentication / authorization ---------------------------------------
  if v_uid is null then
    raise exception using errcode = 'FR009', message = 'UNAUTHENTICATED';
  end if;

  select u.role
  into v_role
  from public.users u
  where u.id = v_uid
    and u.is_active;

  if v_role is null or v_role <> 'ADMIN' then
    raise exception using errcode = 'FR009', message = 'FORBIDDEN',
      detail = 'Only an active ADMIN may delete a product permanently.';
  end if;

  -- --- Row lock: keep the product from changing under us --------------------
  select *
  into v_product
  from public.products p
  where p.id = p_product_id
  for update;

  if not found then
    raise exception using errcode = 'FR013', message = 'PRODUCT_NOT_FOUND',
      detail = coalesce(p_product_id::text, 'null');
  end if;

  if not v_product.is_deleted then
    raise exception using errcode = 'FR027', message = 'PRODUCT_NOT_ARCHIVED',
      detail = format('%s must be archived before it can be purged.', v_product.name);
  end if;

  -- --- Financial history guard ---------------------------------------------
  select exists (
    select 1
    from public.transaction_items ti
    where ti.product_id = p_product_id
    union all
    select 1
    from public.stock_movements sm
    where sm.product_id = p_product_id
      and sm.transaction_id is not null
  )
  into v_has_history;

  if v_has_history then
    raise exception using errcode = 'FR026', message = 'PRODUCT_HAS_HISTORY',
      detail = format('%s is referenced by transaction history.', v_product.name);
  end if;

  -- --- Purge: the product's own adjustment ledger, then the product --------
  delete from public.stock_movements sm
  where sm.product_id = p_product_id;

  delete from public.products p
  where p.id = p_product_id;
end;
$$;

comment on function public.delete_product_permanently(uuid) is
  'ADMIN-only hard delete for archived products without transaction history; also clears the product''s own stock ledger rows.';

revoke all on function public.delete_product_permanently(uuid) from public;
revoke all on function public.delete_product_permanently(uuid) from anon, authenticated;

grant execute on function public.delete_product_permanently(uuid)
  to authenticated, service_role;

reset search_path;
