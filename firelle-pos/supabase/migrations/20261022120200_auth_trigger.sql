-- ============================================================================
-- 03 / auth.users -> public.users profile trigger
-- The first user ever becomes ADMIN; everyone else defaults to CASHIER.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role := 'CASHIER';
  v_user_count integer;
  v_full_name text;
begin
  -- Count existing profiles (not auth.users): in a multi-row insert the AFTER
  -- triggers see all new auth rows, but profile inserts from earlier trigger
  -- calls are visible here. First profile => ADMIN, later profiles => CASHIER.
  perform pg_advisory_xact_lock(hashtext('firelle.first_user')::bigint);

  select count(*) into v_user_count from public.users;

  if v_user_count = 0 then
    v_role := 'ADMIN';
  end if;

  v_full_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'User'
  );

  insert into public.users (id, full_name, email, role)
  values (new.id, v_full_name, new.email, v_role)
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates the public.users profile for a new auth user. The first-ever profile becomes ADMIN; later profiles default to CASHIER.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
