'use client'

import { auditRowToTimelineItem, type AuditRow } from '@/lib/cockpit/audit-format'

/**
 * Two ambient-life primitives that sit at the top of operator + admin
 * cockpits, sourced from the same audit_log feed every cockpit
 * already reads. Presentational only — no new queries.
 *
 * Per the design handoff (chat1.md, screen-dashboard.jsx):
 *
 * `<PortalCockpitMomento>` — sticky "EN ESTE MOMENTO" pulse strip
 * showing the latest event. Sweeps emerald hairline across the top
 * (cruzMomentoSweep keyframe). Reads as: "the system is alive, and
 * something just happened."
 *
 * `<PortalCockpitActivity>` — rolling activity ticker with up to 8
 * recent events, fading into the row in sequence. Each row's
 * timestamp is mono fg-5; subject is fg-3 (or fg-1 + green for the
 * freshest one).
 *
 * Both components accept a normalized shape so callers can source
 * from audit_log, operational_decisions, or any future feed. They
 * return null on empty input — the cockpit reads as calm rather than
 * rendering an empty pill.
 */

export interface PortalSignalItem {
  id: string | number
  what: string
  ts: string // ISO-8601
}

export function auditRowToSignal(row: AuditRow): PortalSignalItem {
  const t = auditRowToTimelineItem(row)
  // TimelineItem.timestamp is `string | Date`; normalize to ISO string.
  const ts = t.timestamp instanceof Date ? t.timestamp.toISOString() : t.timestamp
  return { id: t.id, what: t.title, ts }
}

export function PortalCockpitMomento({
  items,
  rows,
}: {
  items?: PortalSignalItem[]
  /** Backward-compat: pass an AuditRow[] directly. */
  rows?: AuditRow[]
}) {
  const list = items ?? (rows ?? []).map(auditRowToSignal)
  const latest = list[0]
  if (!latest) return null
  const ts = relativeTime(latest.ts)

  return (
    <div className="portal-momento" role="status" aria-live="polite">
      <span className="portal-momento__label">
        <span className="portal-pulse" aria-hidden />
        En este momento
      </span>
      <span className="portal-momento__what">{latest.what}</span>
      <span className="portal-momento__meta">{ts}</span>
    </div>
  )
}

export function PortalCockpitActivity({
  items,
  rows,
  limit = 6,
}: {
  items?: PortalSignalItem[]
  rows?: AuditRow[]
  limit?: number
}) {
  const list = items ?? (rows ?? []).map(auditRowToSignal)
  const trimmed = list.slice(0, limit).map((it, i) => ({
    key: it.id,
    what: it.what,
    ts: relativeTime(it.ts),
    fresh: i === 0,
  }))
  if (trimmed.length === 0) return null

  return (
    <div className="portal-activity" role="status" aria-live="polite" aria-label="Actividad en vivo">
      <span className="portal-activity__label">
        <span className="portal-activity__dot" aria-hidden />
        En vivo
      </span>
      <span className="portal-activity__stream">
        {trimmed.map((it, i) => (
          <span
            key={it.key}
            className={`portal-activity__item${it.fresh ? ' portal-activity__item--fresh' : ''}`}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <span className="ts">{it.ts}</span>
            <span className="sep" aria-hidden />
            <span className="what">{it.what}</span>
          </span>
        ))}
      </span>
    </div>
  )
}

function relativeTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  const sec = Math.max(0, Math.floor(diffMs / 1000))
  if (sec < 60) return 'AHORA'
  const min = Math.floor(sec / 60)
  if (min < 60) return `HACE ${min} MIN`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `HACE ${hr} H`
  const day = Math.floor(hr / 24)
  return `HACE ${day} D`
}
