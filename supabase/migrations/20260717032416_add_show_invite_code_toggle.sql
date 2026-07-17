-- Lets the host control whether the invite code (and a copy/share
-- button) is shown to everyone on the guest-facing event page, vs.
-- only being available to the host from the dashboard. Defaults to
-- visible, matching current behavior for existing events.
alter table public.events
  add column show_invite_code_to_guests boolean not null default true;

drop function if exists public.get_event_by_code(text);

create or replace function public.get_event_by_code(p_code text)
returns table (
  id uuid, name text, event_date date, location text, event_type text,
  dress_code_text text, invite_code text, host_display_name text,
  show_invite_code_to_guests boolean,
  inspo_image_urls text[], required_colors text[], suggested_colors text[], off_limit_colors text[]
) language sql security definer set search_path = public as $$
  select id, name, event_date, location, event_type, dress_code_text, invite_code, host_display_name,
         show_invite_code_to_guests,
         inspo_image_urls, required_colors, suggested_colors, off_limit_colors
  from events where invite_code = p_code;
$$;

revoke all on function public.get_event_by_code(text) from public;
grant execute on function public.get_event_by_code(text) to anon, authenticated;
