import {
  FileText,
  FileCheck2,
  FileDown,
  Landmark,
  AlertTriangle,
  Receipt,
  Workflow,
  BookOpen,
  Link as LinkIcon,
} from 'lucide-react'
import Link from 'next/link'
import { fmtDateTime } from '@/lib/format-utils'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_BRIGHT,
  ACCENT_SILVER_DIM,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '@/lib/design-system'
import { groupByDay, type TraceEvent, type TraceEventKind } from '@/lib/trace/compose'

const ICONS: Record<TraceEventKind, typeof FileText> = {
  workflow: Workflow,
  document: FileText,
  classification: BookOpen,
  pedimento_export: FileDown,
  anexo24_export: FileCheck2,
  pece_payment: Landmark,
  mve_alert: AlertTriangle,
  quickbooks_export: Receipt,
}

export function TraceTimeline({ events }: { events: TraceEvent[] }) {
  if (events.length === 0) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: 'center',
          color: TEXT_MUTED,
          fontSize: 13,
          border: `1px dashed ${ACCENT_SILVER_DIM}44`,
          borderRadius: 20,
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <LinkIcon size={20} style={{ opacity: 0.4, marginBottom: 8 }} />
        <div>Sin eventos registrados todavía.</div>
      </div>
    )
  }

  const groups = groupByDay(events)

  return (
    <div style={{ position: 'relative' }}>
      {groups.map((g) => (
        <section key={g.dayKey} style={{ marginBottom: 24 }}>
          <header
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 2,
              padding: '6px 0',
              background: 'rgba(10,10,12,0.85)',
              backdropFilter: 'blur(8px)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: ACCENT_SILVER_DIM,
              borderBottom: `1px solid rgba(192,197,206,0.12)`,
              marginBottom: 12,
            }}
          >
            {g.day}
          </header>

          <ol
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              position: 'relative',
            }}
          >
            {/* Vertical hairline connector */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: 11,
                top: 8,
                bottom: 8,
                width: 1,
                background: `linear-gradient(to bottom, ${ACCENT_SILVER_DIM}33, ${ACCENT_SILVER_DIM}11)`,
              }}
            />

            {g.events.map((ev) => {
              const Icon = ICONS[ev.kind] ?? FileText
              const row = (
                <li
                  key={ev.id}
                  style={{
                    position: 'relative',
                    display: 'grid',
                    gridTemplateColumns: '24px 1fr auto',
                    columnGap: 12,
                    alignItems: 'start',
                    padding: '8px 0',
                    minHeight: 60,
                  }}
                >
                  {/* Dot */}
                  <span
                    aria-hidden
                    style={{
                      gridColumn: 1,
                      marginTop: 6,
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: ACCENT_SILVER,
                      boxShadow: `0 0 0 3px rgba(192,197,206,0.12)`,
                      justifySelf: 'center',
                    }}
                  />

                  <div style={{ gridColumn: 2, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        color: TEXT_PRIMARY,
                      }}
                    >
                      <Icon size={14} color={ACCENT_SILVER_BRIGHT} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ev.title}
                      </span>
                    </div>
                    {ev.subtitle && (
                      <div
                        style={{
                          fontSize: 12,
                          color: TEXT_MUTED,
                          marginTop: 2,
                        }}
                      >
                        {ev.subtitle}
                      </div>
                    )}
                    {ev.actor && (
                      <div
                        style={{
                          fontSize: 11,
                          color: ACCENT_SILVER_DIM,
                          marginTop: 2,
                        }}
                      >
                        {ev.actor}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      gridColumn: 3,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: ACCENT_SILVER_DIM,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span>{fmtDateTime(ev.at)}</span>
                    {ev.link && (
                      <Link
                        href={ev.link}
                        style={{
                          color: ACCENT_SILVER,
                          textDecoration: 'none',
                          minHeight: 44,
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        Ver
                      </Link>
                    )}
                  </div>
                </li>
              )
              return row
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}
