-- Researchers can delete their own account and everything in their personal
-- workspace. Media files are removed from storage by the client first
-- (Storage objects are not cascaded by Postgres).

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  -- Workspaces the user created (personal ones) and all their contents.
  delete from public.workspaces where created_by = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
