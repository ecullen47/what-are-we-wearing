// Labels and soft color tints for events.event_type values, shared by
// badges and placeholders across the app. Class names are written out in
// full so Tailwind picks them up.
const EVENT_TYPES: Record<string, { label: string; tint: string; tintText: string }> = {
  wedding: { label: 'Wedding', tint: 'bg-blush', tintText: 'text-blush-deep' },
  dinner: { label: 'Dinner', tint: 'bg-butter', tintText: 'text-butter-deep' },
  party: { label: 'Party', tint: 'bg-lilac', tintText: 'text-lilac-deep' },
  other: { label: 'Event', tint: 'bg-sky', tintText: 'text-sky-deep' },
}

function typeInfo(type: string | null | undefined) {
  return (type && EVENT_TYPES[type]) || EVENT_TYPES.other
}

export function eventTypeLabel(type: string | null | undefined): string {
  return typeInfo(type).label
}

// e.g. "bg-blush text-blush-deep" for weddings.
export function eventTypeTint(type: string | null | undefined): string {
  const t = typeInfo(type)
  return `${t.tint} ${t.tintText}`
}
