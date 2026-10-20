-- Phase 4: online shop. Product fields for the shop (original price and
-- researcher-created ratings/reviews) and the shop's behavioural event types.

alter table public.products
  add column original_price numeric(14, 3) check (original_price is null or original_price >= 0),
  add column rating numeric(2, 1) check (rating is null or (rating >= 0 and rating <= 5)),
  add column rating_count integer check (rating_count is null or rating_count >= 0),
  add column reviews jsonb not null default '[]'::jsonb check (jsonb_typeof(reviews) = 'array');

comment on column public.products.reviews is
  'Researcher-created review stimuli shown in the online shop; not real customer reviews.';

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
    'shop_page', 'shop_search', 'shop_filter', 'shop_sort', 'checkout_start', 'scroll_depth', 'popup_close', 'ad_click'
  )
  on conflict (session_id, client_event_id) do nothing;
  get diagnostics inserted = row_count;
  update public.participant_sessions set last_activity_at = now() where id = ps.id;
  return inserted;
end;
$$;
