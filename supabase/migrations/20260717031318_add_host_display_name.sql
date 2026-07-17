-- A plain display name the host enters at event creation, shown to
-- guests as "Hosted by ___". Nullable so existing events (created
-- before this field existed) just don't render that line, rather than
-- backfilling a guessed value. Deliberately NOT the host's email or
-- user id, which the guest-facing RPC has always excluded on purpose.
alter table public.events add column host_display_name text;

-- get_event_by_code's return columns are changing, and CREATE OR REPLACE
-- can't alter an existing function's return type — must drop first.
drop function if exists public.get_event_by_code(text);

create or replace function public.get_event_by_code(p_code text)
returns table (
  id uuid, name text, event_date date, location text, event_type text,
  dress_code_text text, invite_code text, host_display_name text,
  inspo_image_urls text[], required_colors text[], suggested_colors text[], off_limit_colors text[]
) language sql security definer set search_path = public as $$
  select id, name, event_date, location, event_type, dress_code_text, invite_code, host_display_name,
         inspo_image_urls, required_colors, suggested_colors, off_limit_colors
  from events where invite_code = p_code;
$$;

revoke all on function public.get_event_by_code(text) from public;
grant execute on function public.get_event_by_code(text) to anon, authenticated;
