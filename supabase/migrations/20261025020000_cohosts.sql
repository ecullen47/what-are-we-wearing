-- Co-hosts: people the host invites (with a private link) to help run an
-- event. They can do everything the host can except delete the event, add
-- parts to it, or manage the invite link. The owner stays events.host_id.

create table public.event_cohosts (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Copied from the account when they join, so hosts can see who it is.
  email text,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.event_cohosts enable row level security;

create index event_cohosts_user_id_idx on public.event_cohosts(user_id);

-- The private link's secret. Null means no link is active; making a new one
-- stops the old one working.
alter table public.events add column cohost_invite_token uuid unique;

-- Owner or co-host of an event. Security definer so the events and
-- event_cohosts policies can use it without recursing into each other.
-- Anon may call it (it's false for them) because policies on tables anon
-- reads call it too.
create function public.is_event_host(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from events where id = p_event_id and host_id = auth.uid())
      or exists (select 1 from event_cohosts where event_id = p_event_id and user_id = auth.uid());
$$;

revoke all on function public.is_event_host(uuid) from public;
grant execute on function public.is_event_host(uuid) to anon, authenticated;

-- Policies: host_id = auth.uid() becomes is_event_host(...) everywhere
-- except deleting the event, which stays with the owner.

drop policy "events_select_own" on public.events;
create policy "events_select_own" on public.events
  for select to authenticated using (public.is_event_host(id));

drop policy "Hosts can update their own events" on public.events;
create policy "Hosts can update their own events" on public.events
  for update to authenticated using (public.is_event_host(id)) with check (public.is_event_host(id));

-- Co-hosts can edit the event but never take it over.
create function public.lock_event_owner() returns trigger language plpgsql as $$
begin
  if new.host_id is distinct from old.host_id then
    raise exception 'An event''s owner can''t be changed';
  end if;
  return new;
end;
$$;

create trigger events_lock_owner
  before update of host_id on public.events
  for each row execute function public.lock_event_owner();

drop policy "outfit_posts_select_own_event" on public.outfit_posts;
create policy "outfit_posts_select_own_event" on public.outfit_posts
  for select to authenticated using (public.is_event_host(event_id));

drop policy "outfit_posts_delete_own_event" on public.outfit_posts;
create policy "outfit_posts_delete_own_event" on public.outfit_posts
  for delete to authenticated using (public.is_event_host(event_id));

-- Hosts and co-hosts don't also "attend" their own events.
drop policy "event_attendance_insert_own" on public.event_attendance;
create policy "event_attendance_insert_own" on public.event_attendance
  for insert to authenticated
  with check (user_id = auth.uid() and not public.is_event_host(event_id));

drop policy "inspo_write_own_event" on storage.objects;
create policy "inspo_write_own_event" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'event-inspo'
    and (storage.foldername(name))[1] in (select id::text from public.events where public.is_event_host(id))
  );

drop policy "inspo_delete_own_event" on storage.objects;
create policy "inspo_delete_own_event" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'event-inspo'
    and (storage.foldername(name))[1] in (select id::text from public.events where public.is_event_host(id))
  );

drop policy "inspo_select_own_event" on storage.objects;
create policy "inspo_select_own_event" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'event-inspo'
    and (storage.foldername(name))[1] in (select id::text from public.events where public.is_event_host(id))
  );

drop policy "outfit_photo_select_own_event" on storage.objects;
create policy "outfit_photo_select_own_event" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'outfit-posts'
    and (storage.foldername(name))[1] in (select id::text from public.events where public.is_event_host(id))
  );

-- Who co-hosts: visible to the owner and co-hosts. The owner can remove
-- anyone; a co-host can remove themselves. Joining only happens through
-- accept_cohost_invite.
create policy "event_cohosts_select" on public.event_cohosts
  for select to authenticated using (public.is_event_host(event_id));

create policy "event_cohosts_delete" on public.event_cohosts
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.events e where e.id = event_id and e.host_id = auth.uid())
  );

-- Invite links ---------------------------------------------------------------

-- Owner only: makes a fresh link (the old one stops working) and returns it.
create function public.create_cohost_invite(p_event_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_token uuid := gen_random_uuid();
begin
  update events set cohost_invite_token = v_token
  where id = p_event_id and host_id = auth.uid();
  if not found then
    raise exception 'Only the event''s host can invite co-hosts';
  end if;
  return v_token;
end;
$$;

-- Owner only: turns the link off.
create function public.revoke_cohost_invite(p_event_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update events set cohost_invite_token = null
  where id = p_event_id and host_id = auth.uid();
  if not found then
    raise exception 'Only the event''s host can manage co-host invites';
  end if;
end;
$$;

-- What the link is for, shown before joining (and before logging in).
create function public.get_cohost_invite(p_token uuid)
returns table (event_name text, event_date date, host_display_name text)
language sql stable security definer set search_path = public as $$
  select name, event_date, host_display_name from events where cohost_invite_token = p_token;
$$;

-- Joins the signed-in user as a co-host and returns the event's invite code.
create function public.accept_cohost_invite(p_token uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_event events%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Log in to join as a co-host';
  end if;
  select * into v_event from events where cohost_invite_token = p_token;
  if v_event.id is null then
    raise exception 'This co-host link has expired. Ask the host for a new one.';
  end if;
  if v_event.host_id <> auth.uid() then
    insert into event_cohosts (event_id, user_id, email)
    values (v_event.id, auth.uid(), (select email from auth.users where id = auth.uid()))
    on conflict do nothing;
  end if;
  return v_event.invite_code;
end;
$$;

revoke all on function public.create_cohost_invite(uuid) from public, anon;
revoke all on function public.revoke_cohost_invite(uuid) from public, anon;
revoke all on function public.accept_cohost_invite(uuid) from public, anon;
grant execute on function public.create_cohost_invite(uuid) to authenticated;
grant execute on function public.revoke_cohost_invite(uuid) to authenticated;
grant execute on function public.accept_cohost_invite(uuid) to authenticated;
revoke all on function public.get_cohost_invite(uuid) from public;
grant execute on function public.get_cohost_invite(uuid) to anon, authenticated;
