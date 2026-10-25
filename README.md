# What Are We Wearing?

Hosts set a dress code, inspo photos and color rules for an event; guests open it with an invite code (no account needed), post what they plan to wear, vote on each other's "can't decide" polls and steer clear of clashes. Built with Next.js (App Router) and Supabase, hosted on Vercel. A guest mobile app lives in `mobile/`.

Sharing an event:

- Invite links get a preview image with the event's name, date, dress code, colors and first inspo photo (`app/event/[code]/opengraph-image.tsx`).
- Hosts can print a 5×7 invite card with a QR code from the event page (`/event/<CODE>/card`).

## Linking guests to an event

Other platforms (invite and RSVP tools) can send guests straight to an event:

```
https://what-are-we-wearing-nu.vercel.app/event/<INVITE_CODE>?name=<Guest Name>#post
```

- `name` (optional) prefills the guest's name in the post form (URL-encode it, max 100 characters). It's only a suggestion that the guest can change. If they've already used a name for this event on that device, that name is kept instead. The parameter is removed from the address bar once read.
- `#post` (optional) scrolls straight to "Post Your Outfit".

Guests don't need an account. Names are remembered per event, with the last name used offered as the default for new events.

## Linking hosts to create an event

Platforms can also send a host to a create page that's already filled in:

```
https://what-are-we-wearing-nu.vercel.app/create-event?name=Maya's%2030th&date=2026-11-14&location=Brooklyn&type=party&dress=Cocktail&host=Maya
```

All parameters are optional and URL-encoded. The host reviews everything before saving.

| Param | Fills in | Notes |
| --- | --- | --- |
| `name` | Event name | max 200 chars |
| `date` | Date | `YYYY-MM-DD` or a full ISO timestamp; invalid dates are left blank |
| `location` | Location | max 200 chars |
| `type` | Event type | `wedding`, `dinner`, `party`, `other`; common types like `birthday` or `brunch` are mapped, anything else becomes `other` |
| `dress` | Dress code | max 200 chars |
| `host` | Host's display name | max 100 chars |

Hosts who aren't logged in are sent to log in or sign up first, then brought back to the filled-in page.

## Running the tests

There's no local Supabase, so tests run against the real project as a dedicated **test host account** (a normal account used only for tests). Each run creates its own events named "WAWW automated test" and deletes them afterwards. Leftovers from a crashed run are swept up on the next run.

Add the test account to `.env.local`, next to the Supabase keys:

```
TEST_HOST_EMAIL=...
TEST_HOST_PASSWORD=...
```

- `npm test` runs the database tests (`tests/db`): guest posts, edits and deletes, likes, polls (hidden results, voting, deadlines, auto-close) and permissions.
- `npm run test:e2e` runs the browser tests (`e2e`) with Playwright. It reuses the dev server on port 3000 if one is running. First time only: `npx playwright install chromium`.

GitHub Actions (`.github/workflows/ci.yml`) runs lint, both test suites and a production build on every pull request and push to `main`. It needs these repository secrets: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `TEST_HOST_EMAIL`, `TEST_HOST_PASSWORD`.

## Mobile app

`mobile/` is an Expo app for guests, on the same Supabase backend. See [mobile/README.md](mobile/README.md).

## Development

```bash
npm install
npm run dev
```

Then open http://localhost:3000. `.env.local` needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (plus the test account above to run the tests). Database changes go in `supabase/migrations` and are applied with `npx supabase db push`.
