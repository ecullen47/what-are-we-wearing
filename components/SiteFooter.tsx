import Link from 'next/link'

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-stone-line/70">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-stone-muted sm:flex-row">
        <p>
          <span className="font-display text-sm text-stone">What Are We Wearing?</span>{' '}
          &mdash; so nobody shows up
          in the same dress.
        </p>
        <nav className="flex gap-4">
          <Link href="/" className="hover:text-terracotta">
            Home
          </Link>
          <Link href="/login" className="hover:text-terracotta">
            Host an event
          </Link>
        </nav>
      </div>
    </footer>
  )
}
