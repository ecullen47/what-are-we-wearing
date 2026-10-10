This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
