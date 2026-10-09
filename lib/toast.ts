// Fire-and-forget toast messages. The <Toaster /> in the root layout listens
// for this event, so any client component can call toast() without wiring
// up a context provider.
export const TOAST_EVENT = 'waww:toast'

export function toast(message: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<string>(TOAST_EVENT, { detail: message }))
}
