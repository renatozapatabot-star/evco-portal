/**
 * Cross-lead activity feed on /admin/leads.
 *
 * Server-rendered widget: the last 15 entries in lead_activities across
 * every lead. Each row links to the lead detail so a broker landing on
 * the pipeline in the morning can see "what happened since yesterday"
 * and decide where to spend the first hour.
 *
 * Why here (not on each lead's detail): this is the daily-standup view.
 * Per-lead timelines live on /admin/leads/[id] via LeadActivityTimeline.
 */

import Link from 'next/link'
import {
  ArrowRight,
  Check,
  ExternalLink,
  FileText,
  Mail,
  MailOpen,
  Phone,
  Settings,
  Users,
} from 'lucide-react'
import { GlassCard } from '@/components/aguila'
import {
  LEAD_ACTIVITY_KIND_LABELS,
  type LeadActivityKind,
} from '@/lib/leads/types'

interface ActivityWithFirm {
  id: string
  lead_id: string
  kind: LeadActivityKind
  summary: string
  actor_name: string | null
  occurred_at: string
  firm_name: string | null
}

interface Props {
  items: ActivityWithFirm[]
}

const KIND_ICON: Record<
  LeadActivityKind,
  { Icon: typeof Check; fg: string }
> = {
  stage_change: { Icon: ArrowRight, fg: 'var(--portal-status-green-fg)' },
  field_update: { Icon: Settings, fg: 'var(--portal-fg-3)' },
  note: { Icon: FileText, fg: 'var(--portal-fg-2)' },
  call: { Icon: Phone, fg: 'var(--portal-status-amber-fg)' },
  email_sent: { Icon: Mail, fg: 'var(--portal-fg-3)' },
  email_received: { Icon: MailOpen, fg: 'var(--portal-fg-3)' },
  meeting: { Icon: Users, fg: 'var(--portal-status-amber-fg)' },
  demo_sent: { Icon: ExternalLink, fg: 'var(--portal-status-green-fg)' },
  system: { Icon: Check, fg: 'var(--portal-fg-4)' },
}

function fmtWhen(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffHrs = diffMs / (1000 * 60 * 60)
    if (diffHrs < 1) return 'hace un momento'
    if (diffHrs < 24) {
      const h = Math.round(diffHrs)
      return `hace ${h} h`
    }
    if (diffHrs < 168) {
      const days = Math.round(diffHrs / 24)
      return `hace ${days} d`
    }
    return d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      timeZone: 'America/Chicago',
    })
  } catch {
    return iso
  }
}

export function RecentActivityFeed({ items }: Props) {
  if (items.length === 0) return null

  return (
    <GlassCard tier="hero" padding={20} style={{ marginBottom: 24 }}>
      <div
        className="portal-eyebrow"
        style={{
          fontSize: 'var(--portal-fs-label)',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--portal-fg-4)',
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span>Actividad reciente · últimas {items.length}</span>
        <span
          className="portal-num"
          style={{
            fontSize: 'var(--portal-fs-tiny)',
            color: 'var(--portal-fg-5)',
            letterSpacing: '0.12em',
          }}
        >
          ACROSS ALL LEADS
        </span>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {items.map((a) => {
          const meta = KIND_ICON[a.kind] ?? KIND_ICON.system
          const { Icon } = meta
          return (
            <Link
              key={a.id}
              href={`/admin/leads/${a.lead_id}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '22px 1fr auto',
                gap: 10,
                alignItems: 'center',
                padding: '8px 10px',
                borderRadius: 'var(--portal-r-3)',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'background 120ms ease',
              }}
              className="portal-hover-tint"
            >
              <Icon size={14} strokeWidth={2.2} color={meta.fg} />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 'var(--portal-fs-sm)',
                    color: 'var(--portal-fg-1)',
                    lineHeight: 1.35,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    style={{
                      color: 'var(--portal-fg-3)',
                      fontWeight: 600,
                      marginRight: 6,
                    }}
                  >
                    {a.firm_name ?? 'Firma sin nombre'}
                  </span>
                  ·{' '}
                  <span style={{ color: 'var(--portal-fg-2)' }}>
                    {a.summary}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 'var(--portal-fs-tiny)',
                    color: 'var(--portal-fg-5)',
                    marginTop: 1,
                  }}
                >
                  {LEAD_ACTIVITY_KIND_LABELS[a.kind] ?? a.kind}
                  {a.actor_name ? ` · ${a.actor_name}` : ''}
                </div>
              </div>
              <div
                style={{
                  fontSize: 'var(--portal-fs-tiny)',
                  color: 'var(--portal-fg-5)',
                  fontFamily: 'var(--portal-font-mono)',
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                }}
              >
                {fmtWhen(a.occurred_at)}
              </div>
            </Link>
          )
        })}
      </div>
    </GlassCard>
  )
}
