// Pulsing placeholders shown while a page loads, instead of bare "Loading...".
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-cream-dark ${className}`} />
}

export function EventPageSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12" aria-busy="true" aria-label="Loading event">
      <div className="flex gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-10 w-3/4" />
      <Skeleton className="mt-3 h-4 w-1/3" />
      <Skeleton className="mt-2 h-4 w-1/2" />
      <Skeleton className="mt-6 h-16 w-full rounded-lg" />
      <div className="mt-6 grid grid-cols-3 gap-2">
        <Skeleton className="aspect-square w-full rounded-lg" />
        <Skeleton className="aspect-square w-full rounded-lg" />
        <Skeleton className="aspect-square w-full rounded-lg" />
      </div>
      <Skeleton className="mt-8 h-48 w-full rounded-lg" />
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12" aria-busy="true" aria-label="Loading your events">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-40 rounded-full" />
      </div>
      <Skeleton className="mt-6 h-10 w-full" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="mt-4 flex gap-4 rounded-lg border border-stone-line bg-white p-3">
          <Skeleton className="h-20 w-20 shrink-0 rounded-md" />
          <div className="flex-1">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="mt-2 h-4 w-1/2" />
            <Skeleton className="mt-2 h-4 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function FormSkeleton() {
  return (
    <div className="mx-auto max-w-lg px-6 py-12" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-3 h-4 w-3/4" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="mt-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-2 h-10 w-full" />
        </div>
      ))}
    </div>
  )
}
