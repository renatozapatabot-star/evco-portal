'use client'

import Link from 'next/link'
import { ACCENT_SILVER, ACCENT_SILVER_DIM, TEXT_MUTED, TEXT_PRIMARY } from '@/lib/design-system'
import { TileShell } from './tile-shell'
import type { AtencionItem } from '@/app/api/eagle/overview/route'

const KIND_DOT: Record<AtencionItem['kind'], string> = {
  mve_critical: '#EF4444',
  audit_suggestion: ACCENT_SILVER,
  dormant: ACCENT_SILVER_DIM,
}

export function TopAtencionesTile({ items }: { items: AtencionItem[] }) {
  return (
    <TileShell title="Top 5 atenciones" subtitle={`${items.length}`}>
      {items.length === 0 ? (
        <div style={{ color: TEXT_MUTED, fontSize: 13 }}>Sin atenciones pendientes.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((it) => (
            <Link
              key={it.id}
              href={it.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 4px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                textDecoration: 'none',
              }}
            >
              <span
                aria-hidden
                style={{ width: 6, height: 6, borderRadius: 999, background: KIND_DOT[it.kind], flexShrink: 0 }}
              />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 12, color: TEXT_PRIMARY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {it.label}
                </div>
                <div style={{ fontSize: 11, color: TEXT_MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {it.detail}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </TileShell>
  )
}
