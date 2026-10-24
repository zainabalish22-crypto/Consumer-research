-- Phase 6: extensions. Social-feed event types, team workspaces (invitations),
-- and the optional AI assistant settings.

-- ---------------------------------------------------------------------------
-- Social feed: like / save / hide and per-post viewing time
-- ---------------------------------------------------------------------------

create or replace function public.log_events(p_session_id uuid, p_token text, p_events jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ps public.participant_sessions;
  inserted integer;
begin
  ps := public.verified_session(p_session_id, p_token);
  if ps.status = 'withdrawn' then
    return 0;
  end if;
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 100 then
    raise exception 'invalid events' using errcode = '22023';
  end if;
  insert into public.events (session_id, study_id, client_event_id, type, block_key, client_at, data)
  select ps.id, ps.study_id, public.try_uuid(e->>'id'), e->>'type', left(e->>'block', 100),
         case when (e->>'at') ~ '^\d{4}-\d{2}-\d{2}T' then (e->>'at')::timestamptz else null end,
         case when jsonb_typeof(e->'data') = 'object' and pg_column_size(e->'data') <= 2048 then e->'data' else '{}'::jsonb end
  from jsonb_array_elements(p_events) as e
  where (e->>'type') in (
    'block_enter', 'block_leave', 'image_view', 'media_visible',
    'video_play', 'video_pause', 'video_seek', 'video_progress', 'video_complete',
    'audio_play', 'audio_pause', 'audio_progress', 'audio_complete', 'page_hidden', 'page_visible',
    'ad_impression', 'env_enter', 'env_leave', 'store_approach', 'store_pass', 'store_enter', 'store_leave',
    'product_view', 'product_detail', 'bag_add', 'bag_remove', 'checkout', 'consideration', 'choice_select',
    'shop_page', 'shop_search', 'shop_filter', 'shop_sort', 'checkout_start', 'scroll_depth', 'popup_close', 'ad_click',
    'feed_like', 'feed_unlike', 'feed_save', 'feed_unsave', 'feed_hide', 'feed_unhide', 'post_visible'
  )
  on conflict (session_id, client_event_id) do nothing;
  get diagnostics inserted = row_count;
  update public.participant_sessions set last_activity_at = now() where id = ps.id;
  return inserted;
end;
$$;

-- ---------------------------------------------------------------------------
-- Team workspaces. A user keeps their personal workspace and can create team
-- workspaces, invite colleagues by email (owner / editor / viewer), and switch
-- between workspaces. Invitations are accepted in the app by the invited
-- address (no email is sent, so no mail server is needed).
-- ---------------------------------------------------------------------------

-- Team workspaces must survive their creator's account deletion.
alter table public.workspaces alter column created_by drop not null;
alter table public.workspaces drop constraint workspaces_created_by_fkey;
alter table public.workspaces
  add constraint workspaces_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

create or replace function public.is_workspace_owner(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;


create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) between 3 and 320 and email like '%_@_%'),
  role text not null check (role in ('editor', 'viewer')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);
alter table public.workspace_invitations enable row level security;
revoke all on public.workspace_invitations from anon;
-- Owners see their workspace's invitations; invitees see their own. Writes go through functions.
create policy workspace_invitations_select on public.workspace_invitations
  for select to authenticated
  using (
    public.is_workspace_owner(workspace_id)
    or email = lower(coalesce(auth.jwt()->>'email', ''))
  );


create or replace function public.create_team_workspace(p_name text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ws uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 120 then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  if (select count(*) from public.workspace_members where user_id = auth.uid()) >= 20 then
    raise exception 'too many workspaces' using errcode = '54000';
  end if;
  insert into public.workspaces (name, is_personal, created_by) values (trim(p_name), false, auth.uid()) returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, auth.uid(), 'owner');
  return ws;
end;
$$;

create or replace function public.invite_to_workspace(p_workspace uuid, p_email text, p_role text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  inv uuid;
  addr text := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_workspace_owner(p_workspace) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if (select is_personal from public.workspaces where id = p_workspace) then
    raise exception 'personal workspaces cannot be shared' using errcode = '22023';
  end if;
  if p_role not in ('editor', 'viewer') or addr !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid invitation' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.workspace_members m join auth.users u on u.id = m.user_id
    where m.workspace_id = p_workspace and lower(u.email) = addr
  ) then
    raise exception 'already a member' using errcode = '23505';
  end if;
  if (select count(*) from public.workspace_invitations where workspace_id = p_workspace) >= 50 then
    raise exception 'too many invitations' using errcode = '54000';
  end if;
  insert into public.workspace_invitations (workspace_id, email, role, invited_by)
  values (p_workspace, addr, p_role, auth.uid())
  on conflict (workspace_id, email) do update set role = excluded.role, invited_by = excluded.invited_by, created_at = now()
  returning id into inv;
  return inv;
end;
$$;

create or replace function public.respond_to_invitation(p_invitation uuid, p_accept boolean)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  inv public.workspace_invitations;
begin
  select * into inv from public.workspace_invitations where id = p_invitation;
  if inv.id is null or inv.email <> lower(coalesce(auth.jwt()->>'email', '')) then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;
  if p_accept then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (inv.workspace_id, auth.uid(), inv.role)
    on conflict (workspace_id, user_id) do nothing;
  end if;
  delete from public.workspace_invitations where id = inv.id;
  return inv.workspace_id;
end;
$$;

create or replace function public.cancel_invitation(p_invitation uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  delete from public.workspace_invitations i
  where i.id = p_invitation and public.is_workspace_owner(i.workspace_id);
end;
$$;

-- Members (with names and emails) of a workspace the caller belongs to.
create or replace function public.workspace_member_list(p_workspace uuid)
returns table (user_id uuid, role text, display_name text, email text, joined_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, m.role, p.display_name, u.email::text, m.created_at
  from public.workspace_members m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.workspace_id = p_workspace and public.is_workspace_member(p_workspace)
  order by m.created_at;
$$;

-- Change a member's role (owners only). A workspace always keeps at least one owner.
create or replace function public.set_member_role(p_workspace uuid, p_user uuid, p_role text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_workspace_owner(p_workspace) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'editor', 'viewer') then
    raise exception 'invalid role' using errcode = '22023';
  end if;
  if p_role <> 'owner' and (select role from public.workspace_members where workspace_id = p_workspace and user_id = p_user) = 'owner'
     and (select count(*) from public.workspace_members where workspace_id = p_workspace and role = 'owner') <= 1 then
    raise exception 'a workspace needs an owner' using errcode = '22023';
  end if;
  update public.workspace_members set role = p_role where workspace_id = p_workspace and user_id = p_user;
end;
$$;

-- Owners remove members; anyone may leave a team workspace. The last owner cannot leave.
create or replace function public.remove_member(p_workspace uuid, p_user uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r text;
begin
  if (select is_personal from public.workspaces where id = p_workspace) then
    raise exception 'personal workspaces cannot be shared' using errcode = '22023';
  end if;
  if p_user <> auth.uid() and not public.is_workspace_owner(p_workspace) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select role into r from public.workspace_members where workspace_id = p_workspace and user_id = p_user;
  if r = 'owner' and (select count(*) from public.workspace_members where workspace_id = p_workspace and role = 'owner') <= 1 then
    raise exception 'a workspace needs an owner' using errcode = '22023';
  end if;
  delete from public.workspace_members where workspace_id = p_workspace and user_id = p_user;
end;
$$;

-- Account deletion: delete the personal workspace, leave team workspaces.
-- A team workspace whose only owner leaves passes to its longest-standing member;
-- a team workspace with no other members is deleted.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  w record;
  heir uuid;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  for w in
    select ws.id, ws.is_personal, m.role from public.workspaces ws
    join public.workspace_members m on m.workspace_id = ws.id and m.user_id = uid
  loop
    if w.is_personal or not exists (select 1 from public.workspace_members where workspace_id = w.id and user_id <> uid) then
      delete from public.workspaces where id = w.id;
    else
      if w.role = 'owner' and not exists (select 1 from public.workspace_members where workspace_id = w.id and user_id <> uid and role = 'owner') then
        select user_id into heir from public.workspace_members where workspace_id = w.id and user_id <> uid order by created_at limit 1;
        update public.workspace_members set role = 'owner' where workspace_id = w.id and user_id = heir;
      end if;
      delete from public.workspace_members where workspace_id = w.id and user_id = uid;
    end if;
  end loop;
  delete from public.workspace_invitations where email = lower(coalesce(auth.jwt()->>'email', ''));
  delete from auth.users where id = uid;
end;
$$;

-- Supabase grants EXECUTE on new functions by default; keep them for signed-in users only.
revoke execute on function public.is_workspace_owner(uuid) from public, anon;
revoke execute on function public.create_team_workspace(text) from public, anon;
revoke execute on function public.invite_to_workspace(uuid, text, text) from public, anon;
revoke execute on function public.respond_to_invitation(uuid, boolean) from public, anon;
revoke execute on function public.cancel_invitation(uuid) from public, anon;
revoke execute on function public.workspace_member_list(uuid) from public, anon;
revoke execute on function public.set_member_role(uuid, uuid, text) from public, anon;
revoke execute on function public.remove_member(uuid, uuid) from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.is_workspace_owner(uuid) to authenticated;
grant execute on function public.create_team_workspace(text) to authenticated;
grant execute on function public.invite_to_workspace(uuid, text, text) to authenticated;
grant execute on function public.respond_to_invitation(uuid, boolean) to authenticated;
grant execute on function public.cancel_invitation(uuid) to authenticated;
grant execute on function public.workspace_member_list(uuid) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Optional AI assistant: per-user request log for the hosted instance's
-- daily limit. Only the request kind and token counts are stored, never the
-- text that was sent or returned.
-- ---------------------------------------------------------------------------

create table public.ai_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (char_length(kind) <= 40),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  created_at timestamptz not null default now()
);
create index ai_requests_user_day_idx on public.ai_requests(user_id, created_at);
alter table public.ai_requests enable row level security;
revoke all on public.ai_requests from anon;
create policy ai_requests_select_own on public.ai_requests for select to authenticated using (user_id = auth.uid());
create policy ai_requests_insert_own on public.ai_requests for insert to authenticated with check (user_id = auth.uid());
