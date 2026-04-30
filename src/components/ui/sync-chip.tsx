/**
 * SyncChip — quiet header sync indicator (2026-04-25).
 *
 * Replaces the loud <FreshnessBanner> on the six V1 surfaces. Renders
 * a single-line inline chip:  "Sincronizado hace N min" / "hace N hr"
 * / "ahora". `null`-safe — returns null when no timestamp is available
 * so callers can drop it in the header without conditional plumbing.
 */

export interface SyncChipProps {
  /** ISO timestamp of the last successful sync; null hides the chip. */
  lastSyncIso: string | null | undefined
  className?: string
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diffMs = Date.now() - t
  if (diffMs < 0) return 'ahora'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `Sincronizado hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Sincronizado hace ${hours} hr`
  const days = Math.floor(hours / 24)
  return `Sincronizado hace ${days} d`
}

export function SyncChip({ lastSyncIso, className }: SyncChipProps) {
  if (!lastSyncIso) return null
  const label = formatRelative(lastSyncIso)
  if (!label) return null

  const cls = [
    'inline-flex items-center gap-1.5',
    'text-[11px] font-medium',
    'text-[var(--text-muted)]',
    'font-mono [font-variant-numeric:tabular-nums]',
    className ?? '',
  ].filter(Boolean).join(' ')

  return (
    <span className={cls}>
      <span
        aria-hidden
        className="w-1.5 h-1.5 rounded-full bg-[#22c55e] opacity-80"
      />
      {label}
    </span>
  )
}
