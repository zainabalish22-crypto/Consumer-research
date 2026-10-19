-- Phase 1 foundation: accounts, workspaces, projects, studies, versions,
-- media library, participant sessions, responses, consent records, audit log.
--
-- Security model
--   * RLS is enabled on every table.
--   * Researchers read/write their own workspace data through RLS policies.
--   * Participants (anon role) never touch tables directly. They call a small set
--     of SECURITY DEFINER functions that check a per-session resume token and
--     validate the shape of every write against the published study version.
--   * Published study versions are immutable (trigger-enforced).

-- ---------------------------------------------------------------------------
-- Utility
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.try_uuid(p text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Accounts and ownership
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 120),
  ui_locale text not null default 'en' check (ui_locale in ('en', 'ar')),
  default_retention_days integer
    check (default_retention_days is null or default_retention_days between 30 and 3650),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  is_personal boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members(user_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  description text check (description is null or char_length(description) <= 5000),
  objectives text check (objectives is null or char_length(objectives) <= 20000),
  research_questions text check (research_questions is null or char_length(research_questions) <= 20000),
  hypotheses text check (hypotheses is null or char_length(hypotheses) <= 20000),
  notes text check (notes is null or char_length(notes) <= 20000),
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_workspace_idx on public.projects(workspace_id);

-- ---------------------------------------------------------------------------
-- Studies and immutable versions
-- ---------------------------------------------------------------------------

create or replace function public.new_study_slug()
returns text
language sql
volatile
set search_path = ''
as $$
  select substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
$$;

create table public.studies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  slug text not null unique default public.new_study_slug()
    check (slug ~ '^[a-z0-9]{8,32}$'),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'closed')),
  draft_config jsonb not null check (jsonb_typeof(draft_config) = 'object'),
  current_version_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index studies_project_idx on public.studies(project_id);

create table public.study_versions (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  locked boolean not null default false,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default now(),
  unique (study_id, version_number)
);
create index study_versions_study_idx on public.study_versions(study_id);

alter table public.studies
  add constraint studies_current_version_fk
  foreign key (current_version_id) references public.study_versions(id) on delete set null;

-- Published versions can never change, except being locked (false -> true).
create or replace function public.study_versions_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.config is distinct from old.config
     or new.version_number is distinct from old.version_number
     or new.study_id is distinct from old.study_id
     or new.published_at is distinct from old.published_at
     or new.published_by is distinct from old.published_by then
    raise exception 'published study versions are immutable';
  end if;
  if old.locked and not new.locked then
    raise exception 'a locked version cannot be unlocked';
  end if;
  return new;
end;
$$;

create trigger study_versions_immutable
  before update on public.study_versions
  for each row execute function public.study_versions_immutable();

-- A study can only leave "draft" once it has a published version.
create or replace function public.studies_status_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'draft' and new.current_version_id is null then
    raise exception 'publish the study before changing its status';
  end if;
  if new.current_version_id is not null and not exists (
    select 1 from public.study_versions v
    where v.id = new.current_version_id and v.study_id = new.id
  ) then
    raise exception 'current version must belong to this study';
  end if;
  return new;
end;
$$;

create trigger studies_status_guard
  before insert or update on public.studies
  for each row execute function public.studies_status_guard();

-- ---------------------------------------------------------------------------
-- Media library
-- ---------------------------------------------------------------------------

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) <= 400),
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null check (mime_type in (
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/webm',
    'audio/mpeg', 'audio/mp4', 'audio/x-m4a'
  )),
  kind text not null check (kind in ('image', 'video', 'audio')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  folder text check (folder is null or char_length(folder) <= 120),
  tags text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (storage_path like workspace_id::text || '/%')
);
create index media_assets_workspace_idx on public.media_assets(workspace_id);

-- Storage paths that participants may read because a live study version uses them.
create table public.published_media (
  storage_path text not null,
  study_version_id uuid not null references public.study_versions(id) on delete cascade,
  primary key (storage_path, study_version_id)
);

-- ---------------------------------------------------------------------------
-- Participants and data
-- ---------------------------------------------------------------------------

create table public.participant_sessions (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  study_version_id uuid not null references public.study_versions(id) on delete cascade,
  resume_token_hash text not null,
  status text not null default 'in_progress' check (status in (
    'in_progress', 'completed', 'declined', 'withdrawn', 'screened_out', 'abandoned'
  )),
  is_test boolean not null default false,
  excluded boolean not null default false,
  exclusion_reason text check (exclusion_reason is null or char_length(exclusion_reason) <= 500),
  language text not null check (language in ('en', 'ar')),
  condition text,
  assigned_variables jsonb not null default '{}'::jsonb,
  recruitment_params jsonb not null default '{}'::jsonb
    check (pg_column_size(recruitment_params) <= 4096),
  device_class text check (device_class is null or device_class in ('mobile', 'tablet', 'desktop')),
  current_block_index integer not null default 0 check (current_block_index >= 0),
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  ended_at timestamptz
);
create index participant_sessions_study_idx on public.participant_sessions(study_id, is_test);
create index participant_sessions_version_idx on public.participant_sessions(study_version_id);

create table public.responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.participant_sessions(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  block_key text not null check (char_length(block_key) between 1 and 100),
  block_type text not null check (char_length(block_type) between 1 and 40),
  answers jsonb not null default '{}'::jsonb
    check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) <= 65536),
  entered_at timestamptz,
  submitted_at timestamptz not null default now(),
  unique (session_id, block_key)
);
create index responses_study_idx on public.responses(study_id);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.participant_sessions(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  block_key text not null,
  consent_version text not null,
  consent_text jsonb not null,
  decision text not null check (decision in ('given', 'declined')),
  decided_at timestamptz not null default now(),
  unique (session_id, block_key)
);
create index consent_records_study_idx on public.consent_records(study_id);

-- ---------------------------------------------------------------------------
-- Governance
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 80),
  entity_type text not null check (char_length(entity_type) between 1 and 40),
  entity_id uuid,
  details jsonb not null default '{}'::jsonb check (pg_column_size(details) <= 16384),
  created_at timestamptz not null default now()
);
create index audit_logs_workspace_idx on public.audit_logs(workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger workspaces_touch before update on public.workspaces
  for each row execute function public.touch_updated_at();
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger studies_touch before update on public.studies
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Access helpers (SECURITY DEFINER so policies don't recurse through RLS)
-- ---------------------------------------------------------------------------

create or replace function public.is_workspace_member(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_editor(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace and m.user_id = auth.uid()
      and m.role in ('owner', 'editor')
  );
$$;

create or replace function public.study_workspace(p_study uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.workspace_id from public.studies s
  join public.projects p on p.id = s.project_id
  where s.id = p_study;
$$;

create or replace function public.project_workspace(p_project uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select workspace_id from public.projects where id = p_project;
$$;

create or replace function public.can_read_study(p_study uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_workspace_member(public.study_workspace(p_study));
$$;

create or replace function public.can_edit_study(p_study uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_workspace_editor(public.study_workspace(p_study));
$$;

create or replace function public.is_published_media(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.published_media pm
    join public.study_versions v on v.id = pm.study_version_id
    join public.studies s on s.id = v.study_id
    where pm.storage_path = p_path and s.status in ('active', 'paused')
  );
$$;

-- ---------------------------------------------------------------------------
-- New user bootstrap: profile + personal workspace
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
begin
  insert into public.profiles (id, display_name, ui_locale)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)), 120),
    case when new.raw_user_meta_data->>'ui_locale' = 'ar' then 'ar' else 'en' end
  );
  insert into public.workspaces (name, is_personal, created_by)
  values ('Personal workspace', true, new.id)
  returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws, new.id, 'owner');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.studies enable row level security;
alter table public.study_versions enable row level security;
alter table public.media_assets enable row level security;
alter table public.published_media enable row level security;
alter table public.participant_sessions enable row level security;
alter table public.responses enable row level security;
alter table public.consent_records enable row level security;
alter table public.audit_logs enable row level security;

-- Participants use functions only; strip all direct table access from anon.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- profiles
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- workspaces
create policy workspaces_select_member on public.workspaces
  for select to authenticated using (public.is_workspace_member(id));
create policy workspaces_update_owner on public.workspaces
  for update to authenticated
  using (exists (select 1 from public.workspace_members m
                 where m.workspace_id = id and m.user_id = auth.uid() and m.role = 'owner'));

-- workspace_members (team management arrives in a later phase)
create policy workspace_members_select on public.workspace_members
  for select to authenticated using (public.is_workspace_member(workspace_id));

-- projects
create policy projects_select on public.projects
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy projects_insert on public.projects
  for insert to authenticated
  with check (public.is_workspace_editor(workspace_id) and created_by = auth.uid());
create policy projects_update on public.projects
  for update to authenticated
  using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));
create policy projects_delete on public.projects
  for delete to authenticated using (public.is_workspace_editor(workspace_id));

-- studies
create policy studies_select on public.studies
  for select to authenticated using (public.is_workspace_member(public.project_workspace(project_id)));
create policy studies_insert on public.studies
  for insert to authenticated
  with check (public.is_workspace_editor(public.project_workspace(project_id)) and created_by = auth.uid());
create policy studies_update on public.studies
  for update to authenticated
  using (public.is_workspace_editor(public.project_workspace(project_id)))
  with check (public.is_workspace_editor(public.project_workspace(project_id)));
create policy studies_delete on public.studies
  for delete to authenticated using (public.is_workspace_editor(public.project_workspace(project_id)));

-- Only these study columns are editable directly; versions/slug go through functions.
revoke insert, update on public.studies from authenticated;
grant insert (project_id, title, draft_config, created_by) on public.studies to authenticated;
grant update (title, draft_config, status, project_id) on public.studies to authenticated;

-- study_versions: read-only for researchers; created by publish_study()
create policy study_versions_select on public.study_versions
  for select to authenticated using (public.can_read_study(study_id));
revoke insert, update, delete on public.study_versions from authenticated;

-- media_assets
create policy media_select on public.media_assets
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy media_insert on public.media_assets
  for insert to authenticated
  with check (public.is_workspace_editor(workspace_id) and created_by = auth.uid());
create policy media_update on public.media_assets
  for update to authenticated
  using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));
create policy media_delete on public.media_assets
  for delete to authenticated using (public.is_workspace_editor(workspace_id));
revoke update on public.media_assets from authenticated;
grant update (file_name, folder, tags) on public.media_assets to authenticated;

-- published_media: no direct access
revoke all on public.published_media from authenticated;

-- participant data: researchers read; edit exclusion flags; delete
create policy sessions_select on public.participant_sessions
  for select to authenticated using (public.can_read_study(study_id));
create policy sessions_update on public.participant_sessions
  for update to authenticated
  using (public.can_edit_study(study_id)) with check (public.can_edit_study(study_id));
create policy sessions_delete on public.participant_sessions
  for delete to authenticated using (public.can_edit_study(study_id));
revoke insert, update on public.participant_sessions from authenticated;
grant update (excluded, exclusion_reason) on public.participant_sessions to authenticated;

create policy responses_select on public.responses
  for select to authenticated using (public.can_read_study(study_id));
create policy responses_delete on public.responses
  for delete to authenticated using (public.can_edit_study(study_id));
revoke insert, update on public.responses from authenticated;

create policy consent_select on public.consent_records
  for select to authenticated using (public.can_read_study(study_id));
create policy consent_delete on public.consent_records
  for delete to authenticated using (public.can_edit_study(study_id));
revoke insert, update on public.consent_records from authenticated;

-- audit_logs: append-only
create policy audit_select on public.audit_logs
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy audit_insert on public.audit_logs
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and actor_id = auth.uid());
revoke update, delete on public.audit_logs from authenticated;

-- ---------------------------------------------------------------------------
-- Researcher functions
-- ---------------------------------------------------------------------------

-- Publish the current draft as a new immutable version (or return the current
-- version unchanged when the draft has not changed).
create or replace function public.publish_study(p_study_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.studies;
  cur public.study_versions;
  next_num integer;
  new_id uuid;
  ws uuid;
begin
  if not public.can_edit_study(p_study_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into s from public.studies where id = p_study_id for update;
  if jsonb_typeof(s.draft_config->'blocks') <> 'array'
     or jsonb_array_length(s.draft_config->'blocks') = 0 then
    raise exception 'study has no blocks';
  end if;

  if s.current_version_id is not null then
    select * into cur from public.study_versions where id = s.current_version_id;
    if cur.config = s.draft_config then
      return jsonb_build_object('version_id', cur.id, 'version_number', cur.version_number, 'created', false);
    end if;
  end if;

  select coalesce(max(version_number), 0) + 1 into next_num
  from public.study_versions where study_id = p_study_id;

  insert into public.study_versions (study_id, version_number, config, published_by)
  values (p_study_id, next_num, s.draft_config, auth.uid())
  returning id into new_id;

  -- Media referenced anywhere in the config becomes readable by participants.
  ws := public.study_workspace(p_study_id);
  insert into public.published_media (storage_path, study_version_id)
  select distinct m.storage_path, new_id
  from jsonb_path_query(s.draft_config, 'strict $.**.assetId') as ref(v)
  join public.media_assets m
    on m.id = public.try_uuid(ref.v #>> '{}') and m.workspace_id = ws
  on conflict do nothing;

  update public.studies
  set current_version_id = new_id,
      status = case when status = 'draft' then 'active' else status end
  where id = p_study_id;

  insert into public.audit_logs (workspace_id, actor_id, action, entity_type, entity_id, details)
  values (ws, auth.uid(), 'study.published', 'study', p_study_id,
          jsonb_build_object('version_number', next_num, 'version_id', new_id));

  return jsonb_build_object('version_id', new_id, 'version_number', next_num, 'created', true);
end;
$$;

create or replace function public.lock_study_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid uuid;
begin
  select study_id into sid from public.study_versions where id = p_version_id;
  if sid is null or not public.can_edit_study(sid) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.study_versions set locked = true where id = p_version_id;
  insert into public.audit_logs (workspace_id, actor_id, action, entity_type, entity_id, details)
  values (public.study_workspace(sid), auth.uid(), 'version.locked', 'study_version', p_version_id, '{}'::jsonb);
end;
$$;

-- Duplicate a study (draft only; no versions or data are copied).
create or replace function public.duplicate_study(p_study_id uuid, p_title text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.studies;
  new_id uuid;
begin
  if not public.can_edit_study(p_study_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into s from public.studies where id = p_study_id;
  insert into public.studies (project_id, title, draft_config, created_by)
  values (s.project_id, left(p_title, 200), s.draft_config, auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;

-- Per-study counts for dashboards (excludes test sessions).
create or replace function public.study_session_counts(p_study_ids uuid[])
returns table (study_id uuid, started bigint, completed bigint, test bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.study_id,
         count(*) filter (where not s.is_test) as started,
         count(*) filter (where not s.is_test and s.status = 'completed') as completed,
         count(*) filter (where s.is_test) as test
  from public.participant_sessions s
  where s.study_id = any(p_study_ids)
  group by s.study_id;
$$;

-- ---------------------------------------------------------------------------
-- Participant functions (callable by anon). Every call after start needs the
-- session id plus the secret resume token returned by start_session().
-- ---------------------------------------------------------------------------

create or replace function public.hash_token(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

-- Public view of a study by slug. Only active studies expose their config,
-- except to researchers who can edit the study (for test sessions).
create or replace function public.get_public_study(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.studies;
  v public.study_versions;
  is_editor boolean;
begin
  select * into s from public.studies where slug = p_slug;
  if s.id is null then
    return jsonb_build_object('found', false);
  end if;
  is_editor := public.can_edit_study(s.id);
  if s.current_version_id is null or (s.status <> 'active' and not is_editor) then
    return jsonb_build_object('found', true, 'status', s.status, 'available', false);
  end if;
  select * into v from public.study_versions where id = s.current_version_id;
  return jsonb_build_object(
    'found', true,
    'status', s.status,
    'available', true,
    'can_test', is_editor,
    'version_id', v.id,
    'version_number', v.version_number,
    'config', v.config
  );
end;
$$;

create or replace function public.start_session(
  p_slug text,
  p_language text,
  p_is_test boolean default false,
  p_recruitment jsonb default '{}'::jsonb,
  p_device text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.studies;
  v public.study_versions;
  token text;
  sid uuid;
begin
  select * into s from public.studies where slug = p_slug;
  if s.id is null or s.current_version_id is null then
    raise exception 'study not available' using errcode = 'P0002';
  end if;
  if p_is_test then
    if not public.can_edit_study(s.id) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  elsif s.status <> 'active' then
    raise exception 'study not available' using errcode = 'P0002';
  end if;

  select * into v from public.study_versions where id = s.current_version_id;
  if not (v.config->'settings'->'languages') ? p_language then
    raise exception 'language not offered by this study' using errcode = '22023';
  end if;
  if p_recruitment is null or jsonb_typeof(p_recruitment) <> 'object' then
    p_recruitment := '{}'::jsonb;
  end if;

  token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.participant_sessions
    (study_id, study_version_id, resume_token_hash, is_test, language, recruitment_params, device_class)
  values
    (s.id, v.id, public.hash_token(token), coalesce(p_is_test, false), p_language, p_recruitment,
     case when p_device in ('mobile', 'tablet', 'desktop') then p_device else null end)
  returning id into sid;

  return jsonb_build_object(
    'session_id', sid,
    'resume_token', token,
    'version_id', v.id,
    'version_number', v.version_number,
    'config', v.config,
    'is_test', coalesce(p_is_test, false)
  );
end;
$$;

-- Internal: fetch a session after verifying its token.
create or replace function public.verified_session(p_session_id uuid, p_token text)
returns public.participant_sessions
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ps public.participant_sessions;
begin
  select * into ps from public.participant_sessions where id = p_session_id;
  if ps.id is null or p_token is null or ps.resume_token_hash <> public.hash_token(p_token) then
    raise exception 'invalid session' using errcode = '28000';
  end if;
  return ps;
end;
$$;

create or replace function public.load_session(p_session_id uuid, p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ps public.participant_sessions;
  v public.study_versions;
begin
  ps := public.verified_session(p_session_id, p_token);
  select * into v from public.study_versions where id = ps.study_version_id;
  return jsonb_build_object(
    'session_id', ps.id,
    'status', ps.status,
    'is_test', ps.is_test,
    'language', ps.language,
    'current_block_index', ps.current_block_index,
    'version_id', v.id,
    'version_number', v.version_number,
    'config', v.config,
    'responses', coalesce((
      select jsonb_object_agg(r.block_key, r.answers)
      from public.responses r where r.session_id = ps.id
    ), '{}'::jsonb)
  );
end;
$$;

-- Find a block in a version config by its id, with its 0-based position.
create or replace function public.config_block(p_config jsonb, p_block_id text, out block jsonb, out pos integer)
language sql
immutable
set search_path = ''
as $$
  select b, (i - 1)::integer
  from jsonb_array_elements(p_config->'blocks') with ordinality as t(b, i)
  where b->>'id' = p_block_id
  limit 1;
$$;

create or replace function public.submit_block(
  p_session_id uuid,
  p_token text,
  p_block_key text,
  p_answers jsonb,
  p_entered_at timestamptz
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ps public.participant_sessions;
  cfg jsonb;
  blk jsonb;
  pos integer;
  allowed text[];
  bad text;
  next_index integer;
begin
  ps := public.verified_session(p_session_id, p_token);
  if ps.status <> 'in_progress' then
    raise exception 'session is not in progress' using errcode = '55000';
  end if;
  select config into cfg from public.study_versions where id = ps.study_version_id;

  -- Block keys may carry a repetition suffix ("block#2") in later phases.
  select c.block, c.pos into blk, pos from public.config_block(cfg, split_part(p_block_key, '#', 1)) c;
  if blk is null then
    raise exception 'unknown block' using errcode = '22023';
  end if;
  -- Participants cannot skip ahead (e.g. past consent).
  if pos > ps.current_block_index then
    raise exception 'block not reached yet' using errcode = '55000';
  end if;
  if blk->>'type' = 'consent' then
    raise exception 'use record_consent for consent blocks' using errcode = '22023';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'answers must be an object' using errcode = '22023';
  end if;

  select coalesce(array_agg(q->>'variable'), '{}') into allowed
  from jsonb_array_elements(coalesce(blk->'questions', '[]'::jsonb)) as q;

  select k into bad from jsonb_object_keys(p_answers) as k where not (k = any(allowed)) limit 1;
  if bad is not null then
    raise exception 'unknown variable %', bad using errcode = '22023';
  end if;

  insert into public.responses (session_id, study_id, block_key, block_type, answers, entered_at)
  values (ps.id, ps.study_id, p_block_key, blk->>'type', p_answers, p_entered_at)
  on conflict (session_id, block_key) do update
    set answers = excluded.answers,
        entered_at = coalesce(public.responses.entered_at, excluded.entered_at),
        submitted_at = now();

  -- Linear flow in Phase 1; branching (Phase 2) will compute the next block here.
  next_index := greatest(ps.current_block_index, least(pos + 1, jsonb_array_length(cfg->'blocks') - 1));
  update public.participant_sessions
  set current_block_index = next_index,
      last_activity_at = now()
  where id = ps.id;
  return next_index;
end;
$$;

create or replace function public.record_consent(
  p_session_id uuid,
  p_token text,
  p_block_key text,
  p_decision text
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ps public.participant_sessions;
  cfg jsonb;
  blk jsonb;
  pos integer;
  next_index integer;
begin
  ps := public.verified_session(p_session_id, p_token);
  if ps.status <> 'in_progress' then
    raise exception 'session is not in progress' using errcode = '55000';
  end if;
  if p_decision not in ('given', 'declined') then
    raise exception 'invalid decision' using errcode = '22023';
  end if;
  select config into cfg from public.study_versions where id = ps.study_version_id;
  select c.block, c.pos into blk, pos from public.config_block(cfg, p_block_key) c;
  if blk is null or blk->>'type' <> 'consent' then
    raise exception 'unknown consent block' using errcode = '22023';
  end if;
  if pos > ps.current_block_index then
    raise exception 'block not reached yet' using errcode = '55000';
  end if;

  -- The consent text is snapshotted from the server-side config, never the client.
  insert into public.consent_records (session_id, study_id, block_key, consent_version, consent_text, decision)
  values (ps.id, ps.study_id, p_block_key, coalesce(blk->>'consentVersion', '1'), blk->'body', p_decision)
  on conflict (session_id, block_key) do update
    set decision = excluded.decision, decided_at = now();

  if p_decision = 'declined' then
    update public.participant_sessions
    set status = 'declined', ended_at = now(), last_activity_at = now()
    where id = ps.id;
    return ps.current_block_index;
  end if;
  next_index := greatest(ps.current_block_index, least(pos + 1, jsonb_array_length(cfg->'blocks') - 1));
  update public.participant_sessions
  set current_block_index = next_index, last_activity_at = now()
  where id = ps.id;
  return next_index;
end;
$$;

create or replace function public.complete_session(p_session_id uuid, p_token text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ps public.participant_sessions;
begin
  ps := public.verified_session(p_session_id, p_token);
  if ps.status = 'completed' then
    return;
  end if;
  if ps.status <> 'in_progress' then
    raise exception 'session is not in progress' using errcode = '55000';
  end if;
  if coalesce((select v.config->'blocks'->ps.current_block_index->>'type'
               from public.study_versions v where v.id = ps.study_version_id), '') <> 'end' then
    raise exception 'end block not reached yet' using errcode = '55000';
  end if;
  update public.participant_sessions
  set status = 'completed', ended_at = now(), last_activity_at = now()
  where id = ps.id;
end;
$$;

-- Withdrawal deletes the participant's answers; the session row remains with
-- status 'withdrawn' so counts stay honest.
create or replace function public.withdraw_session(p_session_id uuid, p_token text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ps public.participant_sessions;
begin
  ps := public.verified_session(p_session_id, p_token);
  delete from public.responses where session_id = ps.id;
  update public.participant_sessions
  set status = 'withdrawn', ended_at = now(), last_activity_at = now()
  where id = ps.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;

grant execute on function public.get_public_study(text) to anon, authenticated;
grant execute on function public.start_session(text, text, boolean, jsonb, text) to anon, authenticated;
grant execute on function public.load_session(uuid, text) to anon, authenticated;
grant execute on function public.submit_block(uuid, text, text, jsonb, timestamptz) to anon, authenticated;
grant execute on function public.record_consent(uuid, text, text, text) to anon, authenticated;
grant execute on function public.complete_session(uuid, text) to anon, authenticated;
grant execute on function public.withdraw_session(uuid, text) to anon, authenticated;
-- Used inside storage policies evaluated for anon participants.
grant execute on function public.is_published_media(text) to anon, authenticated;
grant execute on function public.try_uuid(text) to anon, authenticated;

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_editor(uuid) to authenticated;
grant execute on function public.study_workspace(uuid) to authenticated;
grant execute on function public.project_workspace(uuid) to authenticated;
grant execute on function public.can_read_study(uuid) to authenticated;
grant execute on function public.can_edit_study(uuid) to authenticated;
grant execute on function public.publish_study(uuid) to authenticated;
grant execute on function public.lock_study_version(uuid) to authenticated;
grant execute on function public.duplicate_study(uuid, text) to authenticated;
grant execute on function public.study_session_counts(uuid[]) to authenticated;
grant execute on function public.touch_updated_at() to authenticated;
grant execute on function public.new_study_slug() to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private "media" bucket, path = <workspace_id>/<file>
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 52428800, array[
  'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/mp4', 'audio/x-m4a'
])
on conflict (id) do nothing;

create policy media_objects_member_read on storage.objects
  for select to authenticated
  using (bucket_id = 'media'
         and public.is_workspace_member(public.try_uuid((storage.foldername(name))[1])));

create policy media_objects_published_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'media' and public.is_published_media(name));

create policy media_objects_editor_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media'
              and public.is_workspace_editor(public.try_uuid((storage.foldername(name))[1])));

create policy media_objects_editor_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'media'
         and public.is_workspace_editor(public.try_uuid((storage.foldername(name))[1])));
