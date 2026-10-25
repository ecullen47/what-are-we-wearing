'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'

type CoHost = { user_id: string; email: string | null }

// The co-host list, plus the invite link's token (only the owner and
// co-hosts can read it).
async function fetchCoHosts(eventId: string) {
  const [{ data: people }, { data: event }] = await Promise.all([
    supabase.from('event_cohosts').select('user_id, email').eq('event_id', eventId).order('created_at'),
    supabase.from('events').select('cohost_invite_token').eq('id', eventId).maybeSingle(),
  ])
  return {
    people: (people as CoHost[] | null) ?? [],
    token: (event as { cohost_invite_token: string | null } | null)?.cohost_invite_token ?? null,
  }
}

// Co-hosts help run an event. The owner shares a private link to add
// them, can make a new link (the old one stops working) or turn it off,
// and can remove anyone. A co-host sees who else is helping and can leave.
export default function CoHosts({
  eventId,
  eventCode,
  isOwner,
  userId,
}: {
  eventId: string
  eventCode: string
  isOwner: boolean
  userId: string
}) {
  const router = useRouter()
  const [cohosts, setCohosts] = useState<CoHost[]>([])
  const [link, setLink] = useState<string | null>(null)
  const [hasLink, setHasLink] = useState(false)
  const [busy, setBusy] = useState(false)

  const show = useCallback(
    ({ people, token }: Awaited<ReturnType<typeof fetchCoHosts>>) => {
      setCohosts(people)
      setHasLink(!!token)
      setLink(token && isOwner ? `${window.location.origin}/cohost/${token}` : null)
    },
    [isOwner]
  )
  const load = async () => show(await fetchCoHosts(eventId))

  useEffect(() => {
    let cancelled = false
    fetchCoHosts(eventId).then((data) => {
      if (!cancelled) show(data)
    })
    return () => {
      cancelled = true
    }
  }, [eventId, show])

  const makeLink = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('create_cohost_invite', { p_event_id: eventId })
    setBusy(false)
    if (error) return toast(`Couldn't make a link: ${error.message}`)
    await load()
    toast(hasLink ? 'New link made. The old one no longer works.' : 'Link ready. Copy it and send it to your co-host.')
  }

  const turnOff = async () => {
    setBusy(true)
    await supabase.rpc('revoke_cohost_invite', { p_event_id: eventId })
    setBusy(false)
    await load()
    toast('Co-host link turned off')
  }

  const copy = async () => {
    if (!link) return
    await navigator.clipboard.writeText(link)
    toast('Co-host link copied')
  }

  const remove = async (person: CoHost) => {
    const leaving = person.user_id === userId
    const question = leaving
      ? 'Stop co-hosting this event? You’ll need a new link from the host to come back.'
      : `Remove ${person.email ?? 'this co-host'}? They won’t be able to edit the event any more.`
    if (!window.confirm(question)) return
    const { error } = await supabase.from('event_cohosts').delete().eq('event_id', eventId).eq('user_id', person.user_id)
    if (error) return toast(`Couldn't remove: ${error.message}`)
    if (leaving) {
      router.push(`/event/${eventCode}`)
      return
    }
    await load()
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-muted">
        Co-hosts can edit the event, pin updates and remove posts.{' '}
        {isOwner ? 'Only you can delete the event or invite co-hosts.' : 'Only the host can delete the event.'}
      </p>

      {cohosts.length > 0 ? (
        <ul className="divide-y divide-stone-line rounded-lg border border-stone-line bg-white">
          {cohosts.map((person) => (
            <li key={person.user_id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="truncate text-stone">
                {person.email ?? 'Co-host'}
                {person.user_id === userId && <span className="text-stone-muted"> (you)</span>}
              </span>
              {(isOwner || person.user_id === userId) && (
                <button onClick={() => remove(person)} className="shrink-0 text-stone-muted hover:text-terracotta">
                  {person.user_id === userId ? 'Leave' : 'Remove'}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        isOwner && <p className="text-sm text-stone">No co-hosts yet.</p>
      )}

      {isOwner && (
        <div className="rounded-lg border border-stone-line bg-cream-dark/40 p-4">
          {link ? (
            <>
              <p className="text-sm font-medium text-stone">Co-host link</p>
              <p className="mt-1 text-xs text-stone-muted">
                Anyone with this link can join as a co-host after logging in. Send it privately.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  readOnly
                  value={link}
                  onFocus={(e) => e.target.select()}
                  aria-label="Co-host link"
                  className="min-w-0 flex-1 rounded-md border border-stone-line bg-white px-3 py-1.5 text-xs text-stone"
                />
                <button
                  onClick={copy}
                  className="rounded-full bg-terracotta px-4 py-1.5 text-sm font-medium text-cream hover:bg-terracotta-dark"
                >
                  Copy
                </button>
              </div>
              <div className="mt-2 flex gap-4 text-xs">
                <button onClick={makeLink} disabled={busy} className="text-terracotta hover:underline disabled:opacity-50">
                  Make a new link
                </button>
                <button onClick={turnOff} disabled={busy} className="text-stone-muted hover:text-terracotta disabled:opacity-50">
                  Turn off link
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={makeLink}
              disabled={busy}
              className="rounded-full border border-terracotta px-4 py-1.5 text-sm font-medium text-terracotta hover:bg-terracotta-light disabled:opacity-50"
            >
              {busy ? 'Making link...' : 'Invite a co-host'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
