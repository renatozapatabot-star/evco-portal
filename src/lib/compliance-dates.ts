// Single source of truth for compliance deadlines
export const MVE_DEADLINE = new Date('2026-03-31T23:59:59-06:00')

export const daysUntilMVE = (): number =>
  Math.max(0, Math.ceil((MVE_DEADLINE.getTime() - Date.now()) / 86400000))

export const mveIsUrgent = (): boolean => daysUntilMVE() <= 7
export const mveIsCritical = (): boolean => daysUntilMVE() <= 3
