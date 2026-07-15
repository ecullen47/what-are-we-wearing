const GUEST_NAME_KEY = 'waww:guestName'

export function getGuestName(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(GUEST_NAME_KEY)
}

export function setGuestName(name: string): void {
  window.localStorage.setItem(GUEST_NAME_KEY, name)
}
