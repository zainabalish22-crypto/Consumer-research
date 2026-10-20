-- Phase 5: researchers can save any study as a template in their workspace and
-- start new studies from it. A template is a copy of a study configuration;
-- library items it uses stay in the workspace library and are referenced by id.

create table public.study_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 2000),
  config jsonb not null check (jsonb_typeof(config) = 'object' and pg_column_size(config) <= 2000000),
  source_study_id uuid references public.studies(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index study_templates_ws_idx on public.study_templates(workspace_id);

alter table public.study_templates enable row level security;
revoke all on public.study_templates from anon;
create policy study_templates_select on public.study_templates for select to authenticated using (public.is_workspace_member(workspace_id));
create policy study_templates_insert on public.study_templates for insert to authenticated with check (public.is_workspace_editor(workspace_id));
create policy study_templates_update on public.study_templates for update to authenticated
  using (public.is_workspace_editor(workspace_id)) with check (public.is_workspace_editor(workspace_id));
create policy study_templates_delete on public.study_templates for delete to authenticated using (public.is_workspace_editor(workspace_id));
create trigger study_templates_touch before update on public.study_templates for each row execute function public.touch_updated_at();
