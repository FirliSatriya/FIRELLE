-- ============================================================================
-- 07 / Harden EXECUTE privileges on project functions
--
-- Supabase's default privileges grant EXECUTE to anon/authenticated on newly
-- created public functions. `REVOKE ... FROM public` in 20261022120600 did not
-- remove those explicit anon grants, so this migration closes them.
--
-- Business RPCs remain available to authenticated/service_role. Trigger
-- helpers are owner-only. `rls_auto_enable` is Supabase-managed and untouched.
-- ============================================================================

revoke execute on function public.current_role() from anon;
revoke execute on function public.next_invoice_number(date) from anon;
revoke execute on function public.create_transaction(
  uuid, jsonb, public.payment_method, numeric, uuid, numeric, text
) from anon;
revoke execute on function public.void_transaction(uuid, text) from anon;
revoke execute on function public.adjust_stock(
  uuid, numeric, public.adjust_reason, text
) from anon;

revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.set_updated_at() from anon, authenticated;
revoke execute on function public.prevent_auto_cashflow_mutation()
  from anon, authenticated;
