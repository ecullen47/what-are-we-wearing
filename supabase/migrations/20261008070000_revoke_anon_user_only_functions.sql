-- Supabase's default privileges grant EXECUTE on every new public function
-- directly to anon, so "revoke ... from public" alone doesn't make a
-- function logged-in-only. Revoke anon explicitly for the functions that
-- are meant for logged-in users:
--   - get_public_gallery: the gallery is for logged-in users only.
--   - get_my_attending_events: returned nothing for anon (auth.uid() is
--     null), but should never have been callable without a login.
revoke execute on function public.get_public_gallery(text, int, int) from anon;
revoke execute on function public.get_my_attending_events() from anon;
