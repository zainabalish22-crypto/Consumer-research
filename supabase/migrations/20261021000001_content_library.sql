-- Phase 3: content library (brands, products, offers, stores, ads) and
-- shopping-environment support in the participant functions.
--
-- Library objects are workspace-private. Studies reference them by id; at
-- publish time the app copies the referenced objects into the immutable
-- version config, so editing the library never changes a running study.

create or replace function public.library_code_ok(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$ select p ~ '^[A-Za-z0-9_]{1,20}$' $$;

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null check (public.library_code_ok(code)),
  name jsonb not null default '{}'::jsonb check (jsonb_typeof(name) = 'object'),
  logo jsonb check (logo is null or jsonb_typeof(logo) = 'object'),
  colors jsonb not null default '{}'::jsonb check (jsonb_typeof(colors) = 'object'),
  fictional boolean not null default true,
  folder text check (folder is null or char_length(folder) <= 120),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, code)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  code text not null check (public.library_code_ok(code)),
  name jsonb not null default '{}'::jsonb check (jsonb_typeof(name) = 'object'),
  description jsonb not null default '{}'::jsonb check (jsonb_typeof(description) = 'object'),
  images jsonb not null default '[]'::jsonb check (jsonb_typeof(images) = 'array'),
  base_price numeric(14, 3) not null default 0 check (base_price >= 0),
  currency text not null default 'BHD' check (currency ~ '^[A-Z]{3}$'),
  category text not null default '' check (char_length(category) <= 80),
  attributes jsonb not null default '[]'::jsonb check (jsonb_typeof(attributes) = 'array'),
  folder text check (folder is null or char_length(folder) <= 120),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, code)
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null check (public.library_code_ok(code)),
  name jsonb not null default '{}'::jsonb check (jsonb_typeof(name) = 'object'),
  kind text not null check (kind in ('none', 'percentage', 'fixed_amount', 'buy_x_get_y', 'bundle', 'free_shipping')),
  params jsonb not null default '{}'::jsonb check (jsonb_typeof(params) = 'object'),
  display_text jsonb not null default '{}'::jsonb check (jsonb_typeof(display_text) = 'object'),
  folder text check (folder is null or char_length(folder) <= 120),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, code)
);

create table public.ads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  code text not null check (public.library_code_ok(code)),
  name jsonb not null default '{}'::jsonb check (jsonb_typeof(name) = 'object'),
  versions jsonb not null default '[]'::jsonb check (jsonb_typeof(versions) = 'array'),
  disclosure jsonb not null default '{}'::jsonb check (jsonb_typeof(disclosure) = 'object'),
  folder text check (folder is null or char_length(folder) <= 120),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, code)
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  code text not null check (public.library_code_ok(code)),
  name jsonb not null default '{}'::jsonb check (jsonb_typeof(name) = 'object'),
  facade jsonb not null default '{}'::jsonb check (jsonb_typeof(facade) = 'object'),
  facade_ad_id uuid references public.ads(id) on delete set null,
  product_ids uuid[] not null default '{}',
  in_store_ad_ids uuid[] not null default '{}',
  folder text check (folder is null or char_length(folder) <= 120),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, code),
  check (cardinality(product_ids) <= 200 and cardinality(in_store_ad_ids) <= 20)
);

create index brands_ws_idx on public.brands(workspace_id);
create index products_ws_idx on public.products(workspace_id);
create index offers_ws_idx on public.offers(workspace_id);
create index ads_ws_idx on public.ads(workspace_id);
create index stores_ws_idx on public.stores(workspace_id);

-- RLS: workspace members read, editors write. Same policy set for every library table.
do $$
declare
  t text;
begin
  foreach t in array array['brands', 'products', 'offers', 'ads', 'stores'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_workspace_editor(workspace_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_workspace_editor(workspace_id)) with check (public.is_workspace_editor(workspace_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_workspace_editor(workspace_id))', t || '_delete', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_touch', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Participant functions: environment blocks store their answer under the
-- block's variable prefix; new behavioural event types.
-- ---------------------------------------------------------------------------

create or replace function public.submit_block(
  p_session_id uuid,
  p_token text,
  p_block_key text,
  p_answers jsonb,
  p_entered_at timestamptz,
  p_next_index integer
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
begin
  ps := public.verified_session(p_session_id, p_token);
  if ps.status <> 'in_progress' then
    raise exception 'session is not in progress' using errcode = '55000';
  end if;
  select config into cfg from public.study_versions where id = ps.study_version_id;

  select c.block, c.pos into blk, pos from public.config_block(cfg, split_part(p_block_key, '#', 1)) c;
  if blk is null then
    raise exception 'unknown block' using errcode = '22023';
  end if;
  if blk->>'type' = 'consent' then
    raise exception 'use record_consent for consent blocks' using errcode = '22023';
  end if;
  if not ps.consent_given and public.requires_consent(cfg, pos) then
    raise exception 'block not reached yet: consent required' using errcode = '55000';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'answers must be an object' using errcode = '22023';
  end if;
  if p_next_index is null or p_next_index < 0 or p_next_index > 5000 then
    raise exception 'invalid next step' using errcode = '22023';
  end if;

  select coalesce(array_agg(q->>'variable'), '{}') into allowed
  from jsonb_array_elements(coalesce(blk->'questions', '[]'::jsonb)) as q;
  if blk ? 'variable' then
    allowed := allowed || (blk->>'variable');
  end if;
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

  update public.participant_sessions
  set current_block_index = greatest(current_block_index, p_next_index),
      last_activity_at = now()
  where id = ps.id;
  return greatest(ps.current_block_index, p_next_index);
end;
$$;

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
    'product_view', 'product_detail', 'bag_add', 'bag_remove', 'checkout', 'consideration', 'choice_select'
  )
  on conflict (session_id, client_event_id) do nothing;
  get diagnostics inserted = row_count;
  update public.participant_sessions set last_activity_at = now() where id = ps.id;
  return inserted;
end;
$$;

-- Supabase grants EXECUTE on new functions by default; keep helpers private.
revoke execute on function public.library_code_ok(text) from public, anon;
