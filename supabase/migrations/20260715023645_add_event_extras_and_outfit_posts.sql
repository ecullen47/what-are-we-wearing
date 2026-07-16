-- Event inspo/color guidance columns
alter table public.events
  add column inspo_image_urls text[] not null default '{}',
  add column required_colors  text[] not null default '{}',
  add column suggested_colors text[] not null default '{}',
  add column off_limit_colors text[] not null default '{}';

-- Replace the existing public SELECT policy on events, which is unscoped
-- (qual = true, despite its name) and would let anyone with the anon key
-- enumerate every event. Guests should only reach event data through the
-- get_event_by_code / get_outfit_posts_by_code RPCs below; hosts keep
-- direct SELECT access to their own events for the setup page.
drop policy if exists "Anyone can view events with the right invite code" on public.events;

create policy events_select_own on public.events
  for select to authenticated
  using (host_id = auth.uid());

-- Outfit posts
create table public.outfit_posts (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 100),
  image_url    text not null,
  caption      text check (char_length(caption) <= 500),
  created_at   timestamptz not null default now()
);

create index outfit_posts_event_id_created_at_idx
  on public.outfit_posts (event_id, created_at desc);

-- RLS enabled with no policies: direct table access is denied for everyone.
-- All guest reads/writes go through the security-definer RPCs below, and
-- hosts don't need direct access to other hosts' outfit posts either.
alter table public.outfit_posts enable row level security;

-- Guest-facing RPCs (security definer: resolve invite_code -> event_id
-- server-side so guests never see/guess event ids or host_id directly)
create or replace function public.get_event_by_code(p_code text)
returns table (
  id uuid, name text, event_date date, location text, event_type text,
  dress_code_text text, invite_code text,
  inspo_image_urls text[], required_colors text[], suggested_colors text[], off_limit_colors text[]
) language sql security definer set search_path = public as $$
  select id, name, event_date, location, event_type, dress_code_text, invite_code,
         inspo_image_urls, required_colors, suggested_colors, off_limit_colors
  from events where invite_code = p_code;
$$;

create or replace function public.get_outfit_posts_by_code(p_code text)
returns table (id uuid, display_name text, image_url text, caption text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select op.id, op.display_name, op.image_url, op.caption, op.created_at
  from outfit_posts op join events e on e.id = op.event_id
  where e.invite_code = p_code order by op.created_at desc;
$$;

create or replace function public.insert_outfit_post(
  p_code text, p_display_name text, p_image_url text, p_caption text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_event_id uuid;
  v_id uuid;
begin
  select id into v_event_id from events where invite_code = p_code;
  if v_event_id is null then
    raise exception 'Event not found';
  end if;

  insert into outfit_posts (event_id, display_name, image_url, caption)
  values (v_event_id, p_display_name, p_image_url, p_caption)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.get_event_by_code(text) from public;
revoke all on function public.get_outfit_posts_by_code(text) from public;
revoke all on function public.insert_outfit_post(text, text, text, text) from public;

grant execute on function public.get_event_by_code(text) to anon, authenticated;
grant execute on function public.get_outfit_posts_by_code(text) to anon, authenticated;
grant execute on function public.insert_outfit_post(text, text, text, text) to anon, authenticated;

-- Storage: host-only inspo images, open guest outfit-photo uploads
insert into storage.buckets (id, name, public)
values ('event-inspo', 'event-inspo', true),
       ('outfit-posts', 'outfit-posts', true);

create policy inspo_select_public on storage.objects
  for select using (bucket_id = 'event-inspo');

create policy inspo_write_own_event on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'event-inspo'
    and (storage.foldername(name))[1] in (
      select id::text from public.events where host_id = auth.uid()
    )
  );

create policy outfit_photo_select_public on storage.objects
  for select using (bucket_id = 'outfit-posts');

create policy outfit_photo_insert_public on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'outfit-posts');
