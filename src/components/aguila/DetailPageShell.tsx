'use client'

/**
 * DetailPageShell — unified chrome for every [id] detail route.
 *
 * Wraps <PageShell> and adds breadcrumb + title formatter + optional tabs
 * + optional sidebar (2-col). Title is auto-formatted via `titleKind`:
 *   - 'pedimento'  → formatPedimento() + mono tracking-tight
 *   - 'fraccion'   → formatFraccion() + mono tracking-tight
 *   - 'id'         → raw id in mono (no formatting)
 *   - 'plain'      → sans-serif display title
 *
 * /embarques/[id], /pedimentos/[id], /expedientes/[id] all compose from
 * this — a quality bump in the shell cascades to every detail page.
 *
 * PortalDetailHero (the 64px pedimento theater) is NOT replaced; pages
 * that need the theater render <PortalDetailHero/> inside children.
 */

import Link from 'next/link'
import type { ReactNode } from 'react'

import { formatFraccion } from '@/lib/format/fraccion'
import { formatPedimento } from '@/lib/format/pedimento'
import { AguilaBreadcrumb } from './AguilaBreadcrumb'
import type { AguilaBreadcrumbItem } from './AguilaBreadcrumb'
import { PageShell } from './PageShell'

export type DetailTitleKind = 'pedimento' | 'fraccion' | 'id' | 'plain'

export interface DetailPageShellTab {
  key: string
  label: ReactNode
  href: string
  active?: boolean
}

export interface DetailPageShellProps {
  /** Breadcrumb trail — last item is the current page. */
  breadcrumb: AguilaBreadcrumbItem[]
  /** Page title — format depends on `titleKind`. */
  title: string
  titleKind?: DetailTitleKind
  subtitle?: string
  /** Status slot — typically a <StatusBadge/>. */
  status?: ReactNode
  /** Additional pills/badges next to status (e.g. <SemaforoPill/>). */
  badges?: ReactNode
  /** Right-aligned action buttons in the header. */
  actions?: ReactNode
  /** Tab navigation below the title — active tab highlighted. */
  tabs?: DetailPageShellTab[]
  /** Main content. */
  children: ReactNode
  /** Right-column metadata panel — 2-col layout on ≥1024px. */
  sidebar?: ReactNode
  /** Maximum content width. Defaults to 1400. */
  maxWidth?: number
}

function formatTitle(title: string, kind: DetailTitleKind | undefined): string {
  if (kind === 'pedimento') {
    const formatted = formatPedimento(title, '')
    return formatted ?? title
  }
  if (kind === 'fraccion') {
    return formatFraccion(title) ?? title
  }
  return title
}

const MONO_KINDS: ReadonlySet<DetailTitleKind> = new Set(['pedimento', 'fraccion', 'id'])

export function DetailPageShell({
  breadcrumb,
  title,
  titleKind = 'plain',
  subtitle,
  status,
  badges,
  actions,
  tabs,
  children,
  sidebar,
  maxWidth = 1400,
}: DetailPageShellProps) {
  const formatted = formatTitle(title, titleKind)
  const isMono = MONO_KINDS.has(titleKind)

  return (
    <PageShell
      title={formatted}
      subtitle={subtitle}
      liveTimestamp={false}
      maxWidth={maxWidth}
      brandHeader={
        <div style={{ marginBottom: 16 }}>
          <AguilaBreadcrumb items={breadcrumb} />
        </div>
      }
      badges={
        (status || badges || actions) ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            {status}
            {badges}
            {actions ? (
              <div style={{ display: 'flex', gap: 8, marginLeft: 4 }}>
                {actions}
              </div>
            ) : null}
          </div>
        ) : undefined
      }
    >
      {/* Title restyle override: mono + tight tracking for pedimento/fraccion/id.
          PageShell already renders the <h1>; we inject a style block that
          targets its first child header when mono is expected. Non-mono
          kinds ('plain') inherit PageShell's default. */}
      {isMono ? (
        <style precedence="default">{`
          .aguila-detail-mono-title h1 {
            font-family: var(--portal-font-mono, 'Geist Mono', monospace);
            font-variant-numeric: tabular-nums;
            letter-spacing: -0.01em;
          }
        `}</style>
      ) : null}
      <div className={isMono ? 'aguila-detail-mono-title' : undefined} />

      {tabs && tabs.length > 0 ? (
        <nav
          aria-label="Secciones"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0,
            marginBottom: 'var(--aguila-gap-section, 32px)',
            borderBottom: '1px solid var(--portal-line-1)',
          }}
        >
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={tab.active ? 'page' : undefined}
              style={{
                padding: '10px 16px',
                fontSize: 'var(--aguila-fs-body, 13px)',
                fontWeight: tab.active ? 600 : 500,
                color: tab.active ? 'var(--portal-fg-1)' : 'var(--portal-fg-4)',
                borderBottom: tab.active
                  ? '2px solid var(--portal-gold-500)'
                  : '2px solid transparent',
                marginBottom: -1,
                textDecoration: 'none',
                transition: 'color var(--portal-dur-1) var(--portal-ease-out)',
              }}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      ) : null}

      {sidebar ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 320px)',
            gap: 'var(--aguila-gap-section, 32px)',
          }}
          className="aguila-detail-grid"
        >
          <div style={{ minWidth: 0 }}>{children}</div>
          <aside style={{ minWidth: 0 }}>{sidebar}</aside>
          <style precedence="default">{`
            @media (max-width: 1023px) {
              .aguila-detail-grid {
                grid-template-columns: minmax(0, 1fr) !important;
              }
            }
          `}</style>
        </div>
      ) : (
        children
      )}
    </PageShell>
  )
}
