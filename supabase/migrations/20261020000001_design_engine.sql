-- Phase 2: experimental design engine, behavioural events, cross-study exclusion,
-- screening and unique completion codes.
--
-- Assignment happens here, inside start_session, so a participant can never
-- choose their own condition. Balanced methods use atomic per-study counters
-- ("permuted blocks"), so balance holds even with many simultaneous starts.

-- ---------------------------------------------------------------------------
-- Session columns
-- ---------------------------------------------------------------------------

alter table public.participant_sessions
  add column ordinal integer,
  add column block_orders jsonb not null default '{}'::jsonb,
  add column consent_given boolean not null default false,
  add column completion_code text check (completion_code is null or char_length(completion_code) <= 40),
  add column screen_reason text check (screen_reason is null or char_length(screen_reason) <= 40);

create index participant_sessions_condition_idx
  on public.participant_sessions(study_id, condition) where not is_test;

comment on column public.participant_sessions.current_block_index is
  'Index into the participant''s resolved step list (after ordering and repetition).';

-- ---------------------------------------------------------------------------
-- Assignment helpers
-- ---------------------------------------------------------------------------

create table public.assignment_counters (
  study_id uuid not null references public.studies(id) on delete cascade,
  key text not null check (char_length(key) <= 120),
  n bigint not null default 0,
  primary key (study_id, key)
);
alter table public.assignment_counters enable row level security;
revoke all on public.assignment_counters from anon, authenticated;

-- Atomically returns 0, 1, 2, ... for each call with the same (study, key).
create or replace function public.next_counter(p_study uuid, p_key text)
returns bigint
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.assignment_counters as c (study_id, key, n) values (p_study, p_key, 1)
  on conflict (study_id, key) do update set n = c.n + 1
  returning c.n - 1;
$$;

-- Deterministic shuffle: the same seed always gives the same order.
create or replace function public.seeded_order(p_items text[], p_seed text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(x order by md5(p_seed || ':' || x), x), '{}')
  from unnest(p_items) as x;
$$;

-- Row k of a balanced (Williams) Latin square of size n, as 0-based indices.
-- Even n: n rows. Odd n: 2n rows (each row plus its reverse) for first-order carry-over balance.
create or replace function public.latin_row(n integer, k bigint)
returns integer[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  rows_total integer := case when n % 2 = 0 then n else 2 * n end;
  r integer := (k % rows_total)::integer;
  base integer[] := '{}';
  res integer[] := '{}';
  j integer;
begin
  for j in 0..n - 1 loop
    base := base || (case when j = 0 then 0 when j % 2 = 1 then (j + 1) / 2 else n - j / 2 end);
  end loop;
  for j in 1..n loop
    res := res || ((base[j] + (r % n)) % n);
  end loop;
  if r >= n then
    select array_agg(x order by o desc) into res from unnest(res) with ordinality as t(x, o);
  end if;
  return res;
end;
$$;

-- The k-th permutation of 0..n-1 in lexicographic order (cycles through all n!).
create or replace function public.nth_permutation(n integer, k bigint)
returns integer[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  pool integer[] := array(select generate_series(0, n - 1));
  res integer[] := '{}';
  fact bigint := 1;
  kk bigint;
  i integer;
  f bigint;
  idx integer;
begin
  for i in 2..n loop fact := fact * i; end loop;
  kk := k % fact;
  for i in reverse n..1 loop
    f := fact / i;
    fact := f;
    idx := (kk / f)::integer;
    kk := kk % f;
    res := res || pool[idx + 1];
    pool := pool[1:idx] || pool[idx + 2:i];
  end loop;
  return res;
end;
$$;

-- Order level values using a method and a counter key.
create or replace function public.assign_order(
  p_study uuid, p_values text[], p_method text, p_key text, p_is_test boolean
)
returns text[]
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n integer := coalesce(array_length(p_values, 1), 0);
  k bigint;
  perm integer[];
begin
  if n < 2 or p_method = 'fixed' then
    return p_values;
  end if;
  if p_is_test or p_method = 'random' or p_method not in ('latin', 'permutation') then
    return public.seeded_order(p_values, gen_random_uuid()::text);
  end if;
  k := public.next_counter(p_study, p_key);
  perm := case when p_method = 'latin' then public.latin_row(n, k) else public.nth_permutation(n, k) end;
  return array(select p_values[p + 1] from unnest(perm) with ordinality as t(p, o) order by o);
end;
$$;

-- Assign condition, factors and block orders for a new session.
create or replace function public.assign_design(
  p_study uuid, p_config jsonb, p_is_test boolean, p_overrides jsonb,
  out o_condition text, out o_factors jsonb, out o_groups jsonb
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  d jsonb := coalesce(p_config->'design', '{}'::jsonb);
  conds jsonb := coalesce(d->'conditions', '[]'::jsonb);
  pool text[];
  avail text[];
  positions text[];
  k bigint;
  bsize integer;
  f jsonb;
  g jsonb;
  var text;
  kind text;
  method text;
  vals text[];
  targets text[];
  ord text[];
  chosen text;
  ckey text;
  n integer;
  mapping jsonb;
  i integer;
begin
  o_factors := '{}'::jsonb;
  o_groups := '{}'::jsonb;
  p_overrides := coalesce(p_overrides, '{}'::jsonb);

  -- Condition ---------------------------------------------------------------
  if jsonb_array_length(conds) >= 2 then
    if p_is_test and exists (select 1 from jsonb_array_elements(conds) x where x->>'id' = p_overrides->>'condition') then
      o_condition := p_overrides->>'condition';
    else
      -- Conditions whose quota (completed, non-test sessions) is not yet reached.
      select array_agg(x->>'id' order by o) into avail
      from jsonb_array_elements(conds) with ordinality as t(x, o)
      where x->>'quota' is null
         or (select count(*) from public.participant_sessions s
             where s.study_id = p_study and not s.is_test and s.status = 'completed'
               and s.condition = x->>'id') < (x->>'quota')::integer;
      if avail is null then
        raise exception 'study is full' using errcode = 'P0001';
      end if;
      -- Pool with each condition repeated by its weight.
      select array_agg(x->>'id' order by o, gs) into pool
      from jsonb_array_elements(conds) with ordinality as t(x, o),
           generate_series(1, greatest(coalesce((x->>'weight')::integer, 1), 1)) as gs;

      if p_is_test or coalesce(d->>'assignment', 'balanced') = 'random' then
        select p into o_condition from unnest(pool) as p where p = any(avail) order by random() limit 1;
      else
        -- Permuted blocks: each block of size sum(weights) contains every condition by weight.
        k := public.next_counter(p_study, 'condition');
        bsize := array_length(pool, 1);
        positions := public.seeded_order(
          array(select gi::text from generate_series(1, bsize) as gi),
          p_study::text || ':condition:' || (k / bsize)::text
        );
        o_condition := pool[positions[(k % bsize) + 1]::integer];
        if not (o_condition = any(avail)) then
          -- Chosen condition is full: use the open condition with the fewest sessions.
          select a into o_condition from unnest(avail) as a
          order by (select count(*) from public.participant_sessions s
                    where s.study_id = p_study and not s.is_test and s.condition = a), random()
          limit 1;
        end if;
      end if;
    end if;
  end if;

  -- Factors -------------------------------------------------------------------
  for f in select x from jsonb_array_elements(coalesce(d->'factors', '[]'::jsonb)) as x loop
    var := f->>'variable';
    kind := f->>'kind';
    method := f->>'method';
    if p_is_test and (p_overrides->'factors') ? var then
      o_factors := o_factors || jsonb_build_object(var, p_overrides->'factors'->var);
      continue;
    end if;
    vals := array(select l->>'value' from jsonb_array_elements(f->'levels') with ordinality as t(l, o) order by o);
    n := coalesce(array_length(vals, 1), 0);
    if n = 0 then continue; end if;
    ckey := 'factor:' || (f->>'id')
      || case when coalesce((f->>'balanceWithinCondition')::boolean, true) and o_condition is not null
              then ':' || o_condition else '' end;

    if kind = 'pick' then
      if method = 'fixed' then
        chosen := coalesce(f->>'fixedValue', vals[1]);
      elsif method = 'balanced' and not p_is_test then
        k := public.next_counter(p_study, ckey);
        ord := public.seeded_order(vals, p_study::text || ':' || ckey || ':' || (k / n)::text);
        chosen := ord[(k % n) + 1];
      else
        chosen := vals[1 + floor(random() * n)::integer];
      end if;
      o_factors := o_factors || jsonb_build_object(var, chosen);
    else
      ord := public.assign_order(p_study, vals, method, ckey, p_is_test);
      if kind = 'order' then
        o_factors := o_factors || jsonb_build_object(var, to_jsonb(ord));
      else
        targets := array(select t->>'value' from jsonb_array_elements(f->'targets') with ordinality as x(t, o) order by o);
        mapping := '{}'::jsonb;
        for i in 1..least(coalesce(array_length(targets, 1), 0), n) loop
          mapping := mapping || jsonb_build_object(targets[i], ord[i]);
        end loop;
        o_factors := o_factors || jsonb_build_object(var, mapping);
      end if;
    end if;
  end loop;

  -- Block order groups ----------------------------------------------------------
  for g in select x from jsonb_array_elements(coalesce(d->'orderGroups', '[]'::jsonb)) as x loop
    vals := array(
      select b->>'id' from jsonb_array_elements(p_config->'blocks') with ordinality as t(b, o)
      where b->>'orderGroup' = g->>'id' order by o
    );
    if coalesce(array_length(vals, 1), 0) < 2 then continue; end if;
    ord := public.assign_order(p_study, vals, g->>'method', 'group:' || (g->>'id'), p_is_test);
    o_groups := o_groups || jsonb_build_object(g->>'id', to_jsonb(ord));
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Behavioural events
-- ---------------------------------------------------------------------------

create table public.events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.participant_sessions(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  client_event_id uuid,
  type text not null check (type ~ '^[a-z_]{2,40}$'),
  block_key text check (block_key is null or char_length(block_key) <= 100),
  client_at timestamptz,
  created_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 2048),
  unique (session_id, client_event_id)
);
create index events_study_idx on public.events(study_id, session_id, id);
alter table public.events enable row level security;
revoke all on public.events from anon;
create policy events_select on public.events
  for select to authenticated using (public.can_read_study(study_id));
create policy events_delete on public.events
  for delete to authenticated using (public.can_edit_study(study_id));
revoke insert, update on public.events from authenticated;

create or replace function public.server_event(p_session uuid, p_study uuid, p_type text, p_block text, p_data jsonb default '{}'::jsonb)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.events (session_id, study_id, type, block_key, client_at, data)
  values (p_session, p_study, p_type, p_block, now(), coalesce(p_data, '{}'::jsonb));
$$;

-- ---------------------------------------------------------------------------
-- Cross-study exclusion lists (salted hashes only; identifiers are never stored)
-- ---------------------------------------------------------------------------

create table public.exclusion_lists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9-]{3,40}$'),
  salt text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, key)
);
create table public.exclusion_hashes (
  list_id uuid not null references public.exclusion_lists(id) on delete cascade,
  hash text not null,
  study_id uuid references public.studies(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (list_id, hash)
);
alter table public.exclusion_lists enable row level security;
alter table public.exclusion_hashes enable row level security;
revoke all on public.exclusion_lists from anon, authenticated;
revoke all on public.exclusion_hashes from anon, authenticated;
-- Researchers can see list names and sizes, never salts or hashes.
grant select (id, workspace_id, key, created_at) on public.exclusion_lists to authenticated;
create policy exclusion_lists_select on public.exclusion_lists
  for select to authenticated using (public.is_workspace_member(workspace_id));

create or replace function public.exclusion_list_sizes()
returns table (key text, entries bigint, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select l.key, (select count(*) from public.exclusion_hashes h where h.list_id = l.id), l.created_at
  from public.exclusion_lists l
  where public.is_workspace_member(l.workspace_id)
  order by l.key;
$$;

-- ---------------------------------------------------------------------------
-- Participant functions (replacing the Phase 1 versions)
-- ---------------------------------------------------------------------------

drop function public.start_session(text, text, boolean, jsonb, text);
drop function public.submit_block(uuid, text, text, jsonb, timestamptz);
drop function public.record_consent(uuid, text, text, text);
drop function public.complete_session(uuid, text);

create or replace function public.start_session(
  p_slug text,
  p_language text,
  p_is_test boolean default false,
  p_recruitment jsonb default '{}'::jsonb,
  p_device text default null,
  p_overrides jsonb default '{}'::jsonb
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
  a record;
  ord integer;
begin
  -- Lock the study row so concurrent starts are serialised (quotas, counters).
  select * into s from public.studies where slug = p_slug for update;
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

  select * into a from public.assign_design(s.id, v.config, coalesce(p_is_test, false),
    case when p_is_test then p_overrides else '{}'::jsonb end);
  if not coalesce(p_is_test, false) then
    ord := public.next_counter(s.id, 'session')::integer;
  end if;

  token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.participant_sessions
    (study_id, study_version_id, resume_token_hash, is_test, language, recruitment_params, device_class,
     condition, assigned_variables, block_orders, ordinal)
  values
    (s.id, v.id, public.hash_token(token), coalesce(p_is_test, false), p_language, p_recruitment,
     case when p_device in ('mobile', 'tablet', 'desktop') then p_device else null end,
     a.o_condition, a.o_factors, a.o_groups, ord)
  returning id into sid;

  perform public.server_event(sid, s.id, 'session_start', null,
    jsonb_build_object('version', v.version_number, 'language', p_language));

  return jsonb_build_object(
    'session_id', sid,
    'resume_token', token,
    'version_id', v.id,
    'version_number', v.version_number,
    'config', v.config,
    'is_test', coalesce(p_is_test, false),
    'assignment', jsonb_build_object('condition', a.o_condition, 'factors', a.o_factors, 'groups', a.o_groups),
    'params', p_recruitment
  );
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
    'consent_given', ps.consent_given,
    'completion_code', ps.completion_code,
    'version_id', v.id,
    'version_number', v.version_number,
    'config', v.config,
    'assignment', jsonb_build_object('condition', ps.condition, 'factors', ps.assigned_variables, 'groups', ps.block_orders),
    'params', ps.recruitment_params,
    'responses', coalesce((
      select jsonb_object_agg(r.block_key, r.answers)
      from public.responses r where r.session_id = ps.id
    ), '{}'::jsonb)
  );
end;
$$;

-- Blocks placed after the first consent block need consent first.
create or replace function public.requires_consent(p_config jsonb, p_pos integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (
    select 1 from jsonb_array_elements(p_config->'blocks') with ordinality as t(b, i)
    where b->>'type' = 'consent' and (i - 1) < p_pos
  );
$$;

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

create or replace function public.record_consent(
  p_session_id uuid,
  p_token text,
  p_block_key text,
  p_decision text,
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
  if p_next_index is null or p_next_index < 0 or p_next_index > 5000 then
    raise exception 'invalid next step' using errcode = '22023';
  end if;

  -- The consent text is snapshotted from the server-side config, never the client.
  insert into public.consent_records (session_id, study_id, block_key, consent_version, consent_text, decision)
  values (ps.id, ps.study_id, p_block_key, coalesce(blk->>'consentVersion', '1'), blk->'body', p_decision)
  on conflict (session_id, block_key) do update
    set decision = excluded.decision, decided_at = now();

  perform public.server_event(ps.id, ps.study_id,
    case when p_decision = 'given' then 'consent_given' else 'consent_declined' end, p_block_key);

  if p_decision = 'declined' then
    update public.participant_sessions
    set status = 'declined', ended_at = now(), last_activity_at = now()
    where id = ps.id;
    return ps.current_block_index;
  end if;
  update public.participant_sessions
  set consent_given = true,
      current_block_index = greatest(current_block_index, p_next_index),
      last_activity_at = now()
  where id = ps.id;
  return greatest(ps.current_block_index, p_next_index);
end;
$$;

create or replace function public.screen_out_session(p_session_id uuid, p_token text, p_reason text)
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
  if ps.status <> 'in_progress' then
    raise exception 'session is not in progress' using errcode = '55000';
  end if;
  update public.participant_sessions
  set status = 'screened_out', screen_reason = left(coalesce(p_reason, 'ineligible'), 40),
      ended_at = now(), last_activity_at = now()
  where id = ps.id;
  perform public.server_event(ps.id, ps.study_id, 'screened_out', null, jsonb_build_object('reason', left(p_reason, 40)));
end;
$$;

create or replace function public.complete_session(p_session_id uuid, p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ps public.participant_sessions;
  cfg jsonb;
  code text;
begin
  ps := public.verified_session(p_session_id, p_token);
  if ps.status = 'completed' then
    return jsonb_build_object('completion_code', ps.completion_code);
  end if;
  if ps.status <> 'in_progress' then
    raise exception 'session is not in progress' using errcode = '55000';
  end if;
  select config into cfg from public.study_versions where id = ps.study_version_id;
  if not ps.consent_given and exists (
    select 1 from jsonb_array_elements(cfg->'blocks') b where b->>'type' = 'consent'
  ) then
    raise exception 'end block not reached yet: consent required' using errcode = '55000';
  end if;
  if exists (select 1 from jsonb_array_elements(cfg->'blocks') b
             where b->>'type' = 'end' and coalesce((b->>'uniqueCode')::boolean, false)) then
    code := upper(substr(md5(ps.id::text || gen_random_uuid()::text), 1, 10));
  end if;
  update public.participant_sessions
  set status = 'completed', completion_code = code, ended_at = now(), last_activity_at = now()
  where id = ps.id;
  perform public.server_event(ps.id, ps.study_id, 'session_complete', null);
  return jsonb_build_object('completion_code', code);
end;
$$;

-- Withdrawal deletes answers and behavioural events; the session row stays as 'withdrawn'.
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
  delete from public.events where session_id = ps.id;
  update public.participant_sessions
  set status = 'withdrawn', ended_at = now(), last_activity_at = now()
  where id = ps.id;
  perform public.server_event(ps.id, ps.study_id, 'session_withdrawn', null);
end;
$$;

-- Batched client events. Idempotent: resending the same client_event_id is a no-op.
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
    'audio_play', 'audio_pause', 'audio_progress', 'audio_complete', 'page_hidden', 'page_visible'
  )
  on conflict (session_id, client_event_id) do nothing;
  get diagnostics inserted = row_count;
  update public.participant_sessions set last_activity_at = now() where id = ps.id;
  return inserted;
end;
$$;

-- Cross-study exclusion check. Returns true when the participant is excluded.
create or replace function public.check_exclusion(
  p_session_id uuid, p_token text, p_block_key text, p_identifier text
)
returns boolean
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
  ws uuid;
  norm text;
  lst public.exclusion_lists;
  excluded boolean := false;
  list_key text;
begin
  ps := public.verified_session(p_session_id, p_token);
  if ps.status <> 'in_progress' then
    raise exception 'session is not in progress' using errcode = '55000';
  end if;
  select config into cfg from public.study_versions where id = ps.study_version_id;
  select c.block, c.pos into blk, pos from public.config_block(cfg, p_block_key) c;
  if blk is null or blk->>'type' <> 'exclusion_check' then
    raise exception 'unknown block' using errcode = '22023';
  end if;
  norm := lower(btrim(coalesce(p_identifier, '')));
  if char_length(norm) < 3 or char_length(norm) > 254 then
    raise exception 'invalid identifier' using errcode = '22023';
  end if;
  ws := public.study_workspace(ps.study_id);

  for list_key in select jsonb_array_elements_text(coalesce(blk->'excludeLists', '[]'::jsonb)) loop
    select * into lst from public.exclusion_lists where workspace_id = ws and key = list_key;
    if lst.id is not null and exists (
      select 1 from public.exclusion_hashes h
      where h.list_id = lst.id and h.hash = encode(sha256(convert_to(lst.salt || ':' || norm, 'UTF8')), 'hex')
    ) then
      excluded := true;
    end if;
  end loop;

  -- Test sessions never write to exclusion lists.
  if not excluded and not ps.is_test and blk->>'recordList' is not null then
    insert into public.exclusion_lists (workspace_id, key, salt)
    values (ws, blk->>'recordList', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
    on conflict (workspace_id, key) do nothing;
    select * into lst from public.exclusion_lists where workspace_id = ws and key = blk->>'recordList';
    insert into public.exclusion_hashes (list_id, hash, study_id)
    values (lst.id, encode(sha256(convert_to(lst.salt || ':' || norm, 'UTF8')), 'hex'), ps.study_id)
    on conflict do nothing;
  end if;

  if excluded then
    update public.participant_sessions
    set status = 'screened_out', screen_reason = 'repeat_participant', ended_at = now(), last_activity_at = now()
    where id = ps.id;
    perform public.server_event(ps.id, ps.study_id, 'screened_out', p_block_key, '{"reason":"repeat_participant"}'::jsonb);
  end if;
  return excluded;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges. Supabase grants EXECUTE on new functions to anon and
-- authenticated by default, so internal helpers are revoked explicitly.
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;
revoke execute on function public.next_counter(uuid, text) from authenticated;
revoke execute on function public.assign_order(uuid, text[], text, text, boolean) from authenticated;
revoke execute on function public.assign_design(uuid, jsonb, boolean, jsonb) from authenticated;
revoke execute on function public.server_event(uuid, uuid, text, text, jsonb) from authenticated;
revoke execute on function public.verified_session(uuid, text) from authenticated;

grant execute on function public.get_public_study(text) to anon, authenticated;
grant execute on function public.start_session(text, text, boolean, jsonb, text, jsonb) to anon, authenticated;
grant execute on function public.load_session(uuid, text) to anon, authenticated;
grant execute on function public.submit_block(uuid, text, text, jsonb, timestamptz, integer) to anon, authenticated;
grant execute on function public.record_consent(uuid, text, text, text, integer) to anon, authenticated;
grant execute on function public.screen_out_session(uuid, text, text) to anon, authenticated;
grant execute on function public.complete_session(uuid, text) to anon, authenticated;
grant execute on function public.withdraw_session(uuid, text) to anon, authenticated;
grant execute on function public.log_events(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.check_exclusion(uuid, text, text, text) to anon, authenticated;
grant execute on function public.is_published_media(text) to anon, authenticated;
grant execute on function public.try_uuid(text) to anon, authenticated;
grant execute on function public.exclusion_list_sizes() to authenticated;
