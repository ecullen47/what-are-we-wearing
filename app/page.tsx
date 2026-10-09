import Link from 'next/link'
import InviteCodeBox from '@/components/InviteCodeBox'

// Soft tint for each step number / feature card, so the page has color
// without getting loud. Full class names so Tailwind picks them up.
const STEP_TINTS = ['bg-blush text-blush-deep', 'bg-butter text-butter-deep', 'bg-sage text-sage-deep']
const FEATURE_TINTS = [
  'bg-blush/50 border-blush-deep/15',
  'bg-butter/60 border-butter-deep/15',
  'bg-sage/60 border-sage-deep/15',
  'bg-sky/60 border-sky-deep/15',
]
const FEATURE_TITLE_TINTS = ['text-blush-deep', 'text-butter-deep', 'text-sage-deep', 'text-sky-deep']

const STEPS = [
  {
    title: 'Set the vibe',
    body: 'Add the dress code, a few inspo photos, and the colors to wear (and the ones to skip, like the bridesmaids’ dusty rose).',
  },
  {
    title: 'Share one link',
    body: 'Text it, email it, put it on the invite. Guests open it in their browser. No app, no account, no password to forget.',
  },
  {
    title: 'Coordinate',
    body: 'Guests post what they’re planning, tag their colors, and ask for votes when they can’t decide. Everyone shows up looking great on purpose.',
  },
]

const FEATURES = [
  {
    title: 'Color clash warnings',
    body: 'Guests tag their outfit colors and get a gentle heads-up if they pick an off-limit one, plus a “colors so far” tally so two people don’t show up in the same emerald.',
  },
  {
    title: '“Help me choose” polls',
    body: 'Torn between two looks? Post both and let the group vote. Results stay hidden until you vote, so nobody just follows the crowd.',
  },
  {
    title: 'An event gallery',
    body: 'Every inspo photo and outfit in one place. Filter by color, tap to see it full size, and get ideas from what everyone else is wearing.',
  },
  {
    title: 'Private to your guests',
    body: 'Each event lives behind its own invite link. Nothing is public, and nothing from your event shows up anywhere else.',
  },
]

const FAQ = [
  {
    q: 'Do my guests need an account?',
    a: 'Nope. They just open your link and type their name when they post. Only hosts sign up, so they can create and manage events.',
  },
  {
    q: 'Who can see the photos?',
    a: 'Only people with your event’s invite link. Events never appear in search engines or anywhere public. You can also hide the invite code on the page so guests can’t pass it around.',
  },
  {
    q: 'What if someone picks a color I asked guests to avoid?',
    a: 'They get a clear heads-up before posting. It won’t stop them (maybe they’re asking if it’s okay), but nobody can say they didn’t know.',
  },
  {
    q: 'Can I change things after I’ve shared the link?',
    a: 'Anytime. Edit the details, dress code, colors, or inspo photos and guests see the changes the next time they open the page. Same link, nothing to resend.',
  },
]

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Soft color washes behind the hero */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-blush opacity-70 blur-3xl" />
          <div className="absolute -top-16 right-[-6rem] h-72 w-72 rounded-full bg-butter opacity-70 blur-3xl" />
          <div className="absolute bottom-[-8rem] left-1/3 h-72 w-72 rounded-full bg-sage opacity-60 blur-3xl" />
        </div>
      <div className="relative mx-auto max-w-3xl px-6 pt-20 pb-16 text-center sm:pt-28">
        <p className="mb-3 text-sm tracking-[0.2em] text-terracotta uppercase">Outfit coordination for any occasion</p>
        <h1 className="font-display text-5xl leading-tight text-stone sm:text-7xl">What Are We Wearing?</h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-stone-muted">
          Because &ldquo;what are you wearing?&rdquo; shouldn&apos;t take forty texts. Set the dress code, share one
          link, and see what everyone&apos;s planning before anyone shows up in the same dress.
        </p>
        <div className="mt-9 flex flex-col items-center gap-4">
          <Link
            href="/login"
            className="rounded-full bg-terracotta px-8 py-3 text-base font-medium text-cream shadow-sm transition-colors hover:bg-terracotta-dark"
          >
            Create an Event
          </Link>
          <InviteCodeBox />
          <p className="text-xs text-stone-muted">Guests never need an account.</p>
        </div>
      </div>
      </section>

      {/* How it works */}
      <section className="border-y border-stone-line/70 bg-linear-to-br from-blush/40 via-cream to-sky/50">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-center font-display text-3xl text-stone sm:text-4xl">How it works</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="text-center sm:text-left">
                <span
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full font-display text-lg ${STEP_TINTS[i]}`}
                >
                  {i + 1}
                </span>
                <h3 className="mt-4 font-display text-xl text-stone">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center font-display text-3xl text-stone sm:text-4xl">
          Fewer group texts. Better outfits.
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f, i) => (
            <div key={f.title} className={`rounded-xl border p-6 ${FEATURE_TINTS[i]}`}>
              <h3 className={`font-display text-xl ${FEATURE_TITLE_TINTS[i]}`}>{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-muted">{f.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-stone-muted">
          Made for weddings, rehearsal dinners, birthdays, galas, and every &ldquo;is this too much?&rdquo; in
          between.
        </p>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-2xl px-6 pb-8">
        <h2 className="text-center font-display text-3xl text-stone sm:text-4xl">Questions, answered</h2>
        <div className="mt-8 divide-y divide-stone-line rounded-xl border border-stone-line bg-white">
          {FAQ.map((item) => (
            <details key={item.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-stone">
                {item.q}
                <span className="text-xl leading-none text-terracotta transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-stone-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-3xl px-6 pt-16">
        <div className="rounded-2xl border border-stone-line/70 bg-linear-to-br from-butter via-blush to-lilac px-6 py-12 text-center">
          <h2 className="font-display text-3xl text-stone sm:text-4xl">Your next event deserves a dress rehearsal.</h2>
          <Link
            href="/login"
            className="mt-8 inline-block rounded-full bg-terracotta px-8 py-3 text-base font-medium text-cream shadow-sm transition-colors hover:bg-terracotta-dark"
          >
            Create an Event
          </Link>
        </div>
      </section>
    </div>
  )
}
