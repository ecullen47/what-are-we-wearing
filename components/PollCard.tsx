'use client'

import { formatDeadline } from '@/lib/formatDate'

export type PollOption = {
  id: string
  image_url: string
  position: number
  // null until the viewer has voted (or posted the poll); the server
  // withholds counts so results can't be peeked at.
  votes: number | null
}

export default function PollCard({
  displayName,
  caption,
  options,
  myVote,
  totalVotes,
  closesAt,
  isMine,
  busy,
  onVote,
  onPickWinner,
}: {
  displayName: string
  caption: string | null
  options: PollOption[]
  myVote: string | null
  totalVotes: number | null
  // When voting ends and the top option wins automatically.
  closesAt: string | null
  isMine: boolean
  busy: boolean
  onVote: (optionId: string) => void
  onPickWinner: (optionId: string) => void
}) {
  const showResults = totalVotes !== null
  const leading = showResults ? Math.max(...options.map((o) => o.votes ?? 0)) : 0

  return (
    <div>
      <p className="text-sm text-stone">
        <strong>{displayName}</strong> <span className="text-stone-muted">can&apos;t decide</span>
        {caption && <span className="text-stone"> — {caption}</span>}
      </p>

      <div className={`mt-2 grid gap-2 ${options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {options.map((o, i) => {
          const votes = o.votes ?? 0
          const pct = showResults && totalVotes ? Math.round((votes / totalVotes) * 100) : 0
          const isMyVote = myVote === o.id
          const isLeading = showResults && votes > 0 && votes === leading
          return (
            <div key={o.id} className="flex flex-col">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={o.image_url}
                  alt={`${displayName}'s option ${i + 1}`}
                  className={`aspect-[3/4] w-full rounded-lg object-cover ${
                    isMyVote ? 'ring-2 ring-terracotta ring-offset-2 ring-offset-cream' : ''
                  }`}
                />
                <span className="absolute top-1.5 left-1.5 rounded-full bg-cream/90 px-2 py-0.5 text-[10px] font-medium text-stone">
                  {i + 1}
                </span>
              </div>

              {showResults && (
                <div className="mt-1.5">
                  <div className="h-1.5 overflow-hidden rounded-full bg-stone-line">
                    <div
                      className={`h-full rounded-full ${isLeading ? 'bg-terracotta' : 'bg-stone-muted'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-[11px] text-stone-muted">
                    {pct}% &middot; {votes} vote{votes === 1 ? '' : 's'}
                    {isMyVote && <span className="font-medium text-terracotta"> &middot; yours</span>}
                  </p>
                </div>
              )}

              {isMine ? (
                <button
                  onClick={() => onPickWinner(o.id)}
                  disabled={busy}
                  className="mt-1.5 rounded-full border border-terracotta px-2 py-1 text-[11px] font-medium text-terracotta transition-colors hover:bg-terracotta-light disabled:opacity-50"
                >
                  Wear this one
                </button>
              ) : (
                <button
                  onClick={() => onVote(o.id)}
                  disabled={busy || isMyVote}
                  className={`mt-1.5 rounded-full px-2 py-1 text-[11px] font-medium transition-colors ${
                    isMyVote
                      ? 'bg-terracotta text-cream'
                      : 'border border-terracotta text-terracotta hover:bg-terracotta-light disabled:opacity-60'
                  }`}
                >
                  {isMyVote ? 'Your vote' : myVote ? 'Switch vote' : 'Vote'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-2 text-xs text-stone-muted">
        {showResults
          ? `${totalVotes} vote${totalVotes === 1 ? '' : 's'}${isMine ? ' · pick the one you’re wearing to close the poll' : ''}`
          : 'Vote to see results.'}
      </p>
      {closesAt && (
        <p className="mt-1 flex items-center gap-1 text-xs text-stone-muted">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
            <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 4.75V8l2.25 1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>
            Voting closes {formatDeadline(closesAt)}.{' '}
            {isMine ? 'If you haven’t picked by then, the top vote wins.' : 'Then the top vote wins.'}
          </span>
        </p>
      )}
    </div>
  )
}
