# What Are We Wearing — mobile app

The guest side of the web app as an [Expo](https://expo.dev) app (SDK 58, Expo Router). It talks to the same Supabase project through the same invite-code database functions, so phone and web guests see each other's posts, likes and votes live.

What guests can do:

- Open an event by invite code; events opened before are listed on the home screen.
- See the dress code, inspo photos, color guidance and everyone's outfits.
- Post an outfit (photo from the library or camera, caption, colors), with the same off-limit and already-worn color warnings as the web.
- Like outfits, vote on polls, and delete their own posts. A poll's author can pick the option they're wearing, which closes the poll.

Not on mobile yet: creating polls, editing a post, and everything for hosts (accounts, creating and managing events). Those stay on the website.

## Setup

`mobile/.env.local` holds the same public Supabase values as the web app's `.env.local`:

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

Then, from `mobile/`:

```bash
npm install
npx expo start      # scan the QR code with Expo Go, or press w for the web preview
```

The web preview is also in `.claude/launch.json` as `mobile-web` (port 8081).

## How it's put together

- `src/app/` — screens: home (`index.tsx`), the event feed (`event/[code]/index.tsx`) and the post form (`event/[code]/post.tsx`, a modal).
- `src/lib/` — Supabase calls (`api.ts`), the guest token and remembered names (`guestIdentity.ts`), live updates on the web's Realtime channel (`eventLive.ts`) and photo resizing and upload (`uploadImage.ts`).
- `src/lib/shared.ts` re-exports the web's `lib/palette`, `lib/formatDate` and `lib/eventTypes` instead of copying them; `metro.config.js` watches `../lib` so changes there reload the app.
- Guests have no account. A random token stored on the phone (expo-sqlite's `localStorage`) marks their posts, votes and likes as theirs, just like the browser's on the web.

## Checks

```bash
npm run typecheck
npm run lint
```

CI runs both on every pull request. The web app's lint and typecheck skip this folder.

## Before an App Store build

The app icon, Android adaptive icon and splash image in `assets/` are still Expo's defaults and need replacing with the app's own artwork.
