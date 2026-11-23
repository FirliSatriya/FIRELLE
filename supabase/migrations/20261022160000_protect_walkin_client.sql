-- ============================================================================
-- 10 / Protect the seeded walk-in client
--
-- The walk-in client is the fallback used by create_transaction() when
-- client_id is NULL. It must stay active and cannot be renamed, archived or
-- deleted by application users.
--
-- Added error:
--   FR024 WALK_IN_CLIENT_PROTECTED
-- ============================================================================

create or replace function public.prevent_walk_in_client_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_walk_in then
      raise exception using errcode = 'FR024',
        message = 'WALK_IN_CLIENT_PROTECTED',
        detail = 'The walk-in client cannot be deleted.';
    end if;
    return old;
  end if;

  -- Applies to edits of the walk-in row and to attempts to convert another
  -- client into the walk-in row.
  if old.is_walk_in or new.is_walk_in then
    raise exception using errcode = 'FR024',
      message = 'WALK_IN_CLIENT_PROTECTED',
      detail = 'The walk-in client cannot be edited or deactivated.';
  end if;

  return new;
end;
$$;

drop trigger if exists clients_prevent_walk_in_mutation on public.clients;
create trigger clients_prevent_walk_in_mutation
  before update or delete on public.clients
  for each row execute function public.prevent_walk_in_client_mutation();

revoke all on function public.prevent_walk_in_client_mutation() from public;
revoke all on function public.prevent_walk_in_client_mutation() from anon, authenticated;
