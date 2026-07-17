import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="max-w-lg text-center">
        <p className="mb-3 text-sm tracking-[0.2em] text-terracotta uppercase">
          Outfit coordination, made easy
        </p>
        <h1 className="font-display text-5xl leading-tight text-stone sm:text-6xl">
          What Are We Wearing?
        </h1>
        <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-stone-muted">
          Create an event, share the invite link with your guests, and everyone
          can see the dress code, inspo, and what everyone else is planning to
          wear &mdash; no app or account needed for guests.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-full bg-terracotta px-8 py-3 text-base font-medium text-cream transition-colors hover:bg-terracotta-dark"
        >
          Create an Event
        </Link>
      </div>
    </div>
  )
}
