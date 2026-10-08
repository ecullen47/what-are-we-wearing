'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// For guests who were texted just a code: jump straight to the event, no
// login needed. The event page itself handles codes that don't exist.
export default function InviteCodeBox() {
  const router = useRouter()
  const [code, setCode] = useState('')

  const go = () => {
    const cleaned = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (cleaned) router.push(`/event/${cleaned}`)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        go()
      }}
      className="flex w-full max-w-sm gap-2"
    >
      <label htmlFor="invite-code" className="sr-only">
        Invite code
      </label>
      <input
        id="invite-code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Got an invite code?"
        autoCapitalize="characters"
        autoComplete="off"
        className="min-w-0 flex-1 rounded-full border border-stone-line bg-white px-5 py-2.5 text-sm tracking-wide text-stone uppercase placeholder:tracking-normal placeholder:text-stone-muted placeholder:normal-case focus:border-terracotta focus:outline-none"
      />
      <button
        type="submit"
        className="shrink-0 rounded-full border border-terracotta px-5 py-2.5 text-sm font-medium text-terracotta transition-colors hover:bg-terracotta-light"
      >
        Go
      </button>
    </form>
  )
}
