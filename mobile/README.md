# What Are We Wearing — mobile app

The guest side of the web app as an [Expo](https://expo.dev) app (SDK 58, Expo Router). It talks to the same Supabase project through the same invite-code database functions, so phone and web guests see each other's posts, likes and votes live.

What guests can do:

- Open an event by invite code; events opened before are listed on the home screen (press and hold one to remove it).
- See the dress code, inspo photos, color guidance and everyone's outfits.
- Post an outfit (photo from the library or camera, caption, colors), with the same off-limit and already-worn color warnings as the web.
- Post a poll of 2–3 outfit photos for others to vote on, with an optional question and closing time.
- Like outfits, vote on polls, and edit or delete their own posts. A poll's author can pick the option they're wearing, which closes the poll.

Everything for hosts (accounts, creating and managing events) stays on the website.

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

- `src/app/` — screens: home (`index.tsx`), the event feed (`event/[code]/index.tsx`), the post form for outfits and polls (`event/[code]/post.tsx`) and editing your own post (`event/[code]/edit.tsx`). The last two open as modals.
- `src/lib/` — Supabase calls (`api.ts`), the guest token and remembered names (`guestIdentity.ts`), live updates on the web's Realtime channel (`eventLive.ts`) and photo resizing and upload (`uploadImage.ts`).
- `src/lib/shared.ts` re-exports the web's `lib/palette`, `lib/formatDate`, `lib/eventTypes` and `lib/pollDeadline` instead of copying them; `metro.config.js` watches `../lib` so changes there reload the app.
- Guests have no account. A random token stored on the phone (expo-sqlite's `localStorage`) marks their posts, votes and likes as theirs, just like the browser's on the web.

## Checks

```bash
npm run typecheck
npm run lint
```

CI runs both on every pull request. The web app's lint and typecheck skip this folder.

## Icons

`assets/images/` holds the app icon, the Android adaptive icon layers (foreground, background, monochrome), the splash image and the web favicon. All are the web's hanger mark from `app/icon.svg` in terracotta and cream. The iOS icon has no transparency, as the App Store requires.
