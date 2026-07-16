import Link from 'next/link'

export default function Home() {
  return (
    <div style={{ padding: '2rem', maxWidth: '500px', margin: '0 auto' }}>
      <h1>What Are We Wearing?</h1>
      <p>
        Create an event, share the invite link with your guests, and everyone
        can see the dress code, inspo, and what everyone else is planning to
        wear &mdash; no app or account needed for guests.
      </p>
      <Link
        href="/login"
        style={{
          display: 'inline-block',
          marginTop: '1rem',
          padding: '0.75rem 1.5rem',
          background: '#000',
          color: '#fff',
          borderRadius: '0.375rem',
          textDecoration: 'none',
        }}
      >
        Create an Event
      </Link>
    </div>
  )
}
