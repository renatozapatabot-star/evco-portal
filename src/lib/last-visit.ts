export function getLastVisit(): Date {
  if (typeof window === 'undefined') return new Date(Date.now() - 86400000)
  const stored = localStorage.getItem('cruz-last-visit')
  return stored ? new Date(stored) : new Date(Date.now() - 86400000)
}

export function updateLastVisit(): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('cruz-last-visit', new Date().toISOString())
}
