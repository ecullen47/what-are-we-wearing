-- Dashboard "Attending" cards now show an event-type badge and a cover photo
-- (the event's first inspo image, else its most recent outfit photo).
-- The return columns change, so the function is dropped and recreated.
drop function if exists public.get_my_attending_events();

create function public.get_my_attending_events()
returns table (
  event_id uuid, name text, event_date date, location text, invite_code text, joined_at timestamptz,
  event_type text, cover_url text
) language sql stable security definer set search_path = public as $$
  select e.id, e.name, e.event_date, e.location, e.invite_code, ea.joined_at,
         e.event_type,
         coalesce(
           e.inspo_image_urls[1],
           (select op.image_url from outfit_posts op where op.event_id = e.id order by op.created_at desc limit 1)
         )
  from event_attendance ea
  join events e on e.id = ea.event_id
  where ea.user_id = auth.uid()
  order by ea.joined_at desc;
$$;

-- Recreating the function re-applies Supabase's default EXECUTE grant to
-- anon, so revoke it again: this is for logged-in users only.
revoke all on function public.get_my_attending_events() from public;
revoke execute on function public.get_my_attending_events() from anon;
grant execute on function public.get_my_attending_events() to authenticated;
