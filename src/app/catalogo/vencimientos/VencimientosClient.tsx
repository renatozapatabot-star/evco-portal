'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { FallbackLink, SectionHeader } from '@/components/aguila'
import {
  BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW,
  TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY,
} from '@/lib/design-system'
import type {
  ExpirySeverity, PermitKind, VencimientoRow,
} from '@/lib/catalogo/vencimientos'

interface Props {
  rows: VencimientoRow[]
}

const PERMIT_LABEL: Record<PermitKind, string> = {
  nom: 'NOM',
  sedue: 'SEDUE',
  semarnat: 'SEMARNAT',
}

const SEVERITY_STYLE: Record<ExpirySeverity, { bg: string; fg: string; label: string }> = {
  red: { bg: 'rgba(239,68,68,0.14)', fg: '#FCA5A5', label: '≤30 días' },
  amber: { bg: 'rgba(251,191,36,0.14)', fg: '#FDE68A', label: '31–60 días' },
  plum: { bg: 'rgba(126,34,206,0.14)', fg: '#C4B5FD', label: '61–90 días' },
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Chicago',
    })
  } catch {
    return iso
  }
}

export function VencimientosClient({ rows }: Props) {
  const [kindFilter, setKindFilter] = useState<'all' | PermitKind>('all')
  const [severityFilter, setSeverityFilter] = useState<'all' | ExpirySeverity>('all')

  const counts = useMemo(() => {
    const c = { red: 0, amber: 0, plum: 0, total: rows.length }
    for (const r of rows) c[r.severity]++
    return c
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (kindFilter !== 'all' && r.permit_kind !== kindFilter) return false
      if (severityFilter !== 'all' && r.severity !== severityFilter) return false
      return true
    })
  }, [rows, kindFilter, severityFilter])

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20 }}>
      <SectionHeader title="Vencimientos próximos · 90 días" count={counts.total} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 16 }}>
        {(['red', 'amber', 'plum'] as ExpirySeverity[]).map((s) => {
          const st = SEVERITY_STYLE[s]
          return (
            <button
              key={s}
              onClick={() => setSeverityFilter((prev) => (prev === s ? 'all' : s))}
              style={{
                textAlign: 'left',
                padding: 16,
                borderRadius: 16,
                background: BG_CARD,
                border: `1px solid ${severityFilter === s ? st.fg : BORDER}`,
                backdropFilter: `blur(${GLASS_BLUR})`,
                boxShadow: GLASS_SHADOW,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: TEXT_MUTED, fontWeight: 700 }}>
                {st.label}
              </div>
              <div style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: 28, fontWeight: 800,
                color: counts[s] > 0 ? st.fg : TEXT_MUTED,
                marginTop: 8, lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {counts[s]}
              </div>
              <div style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 4 }}>
                permisos
              </div>
            </button>
          )
        })}
      </div>

      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20, padding: 12,
        background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 12,
        backdropFilter: `blur(${GLASS_BLUR})`,
      }}>
        <span style={{ fontSize: 11, color: TEXT_MUTED, alignSelf: 'center', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Tipo:
        </span>
        {(['all', 'nom', 'sedue', 'semarnat'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKindFilter(k)}
            style={{
              padding: '6px 12px',
              borderRadius: 10,
              border: `1px solid ${kindFilter === k ? '#C0C5CE' : BORDER}`,
              background: kindFilter === k ? 'rgba(192,197,206,0.14)' : 'transparent',
              color: kindFilter === k ? TEXT_PRIMARY : TEXT_SECONDARY,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {k === 'all' ? 'Todos' : PERMIT_LABEL[k as PermitKind]}
          </button>
        ))}
      </div>

      <div style={{
        marginTop: 16, background: BG_CARD, border: `1px solid ${BORDER}`,
        borderRadius: 16, overflow: 'hidden',
        backdropFilter: `blur(${GLASS_BLUR})`, boxShadow: GLASS_SHADOW,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '100px minmax(0, 2fr) 90px 120px 120px 110px',
          gap: 12, padding: '12px 16px',
          borderBottom: `1px solid ${BORDER}`,
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: TEXT_MUTED,
        }}>
          <div>Tipo</div>
          <div>Producto</div>
          <div>Fracción</div>
          <div>Número</div>
          <div>Vence</div>
          <div style={{ textAlign: 'right' }}>Restantes</div>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: TEXT_MUTED, fontSize: 13 }}>
            Sin permisos en el rango seleccionado.
          </div>
        ) : (
          filtered.map((r) => {
            const st = SEVERITY_STYLE[r.severity]
            return (
              <Link
                key={`${r.producto_id}-${r.permit_kind}`}
                href={`/catalogo?q=${encodeURIComponent(r.cve_producto ?? r.descripcion ?? '')}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '100px minmax(0, 2fr) 90px 120px 120px 110px',
                  gap: 12, padding: '12px 16px',
                  borderBottom: `1px solid ${BORDER}`,
                  color: TEXT_PRIMARY, textDecoration: 'none',
                  fontSize: 13, alignItems: 'center',
                }}
              >
                <div>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 20,
                    background: 'rgba(192,197,206,0.12)', color: TEXT_PRIMARY,
                    fontSize: 11, fontWeight: 700,
                  }}>
                    {PERMIT_LABEL[r.permit_kind]}
                  </span>
                </div>
                <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: TEXT_SECONDARY }}>
                  {r.descripcion ?? r.cve_producto ?? '—'}
                </div>
                <div style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: 12, color: TEXT_SECONDARY }}>
                  {r.fraccion ?? '—'}
                </div>
                <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>
                  {r.permit_value}
                </div>
                <div style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: 12, color: TEXT_SECONDARY }}>
                  {fmtDate(r.expiry_date)}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                    background: st.bg, color: st.fg,
                    fontSize: 11, fontWeight: 700,
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {r.days_until < 0 ? `${Math.abs(r.days_until)}d vencido` : `${r.days_until}d`}
                  </span>
                </div>
              </Link>
            )
          })
        )}
      </div>

      <FallbackLink
        href="https://trafico1web.globalpc.net/catalogos/productos"
        label="Catálogo"
        isIncomplete={rows.length === 0}
        message="Sin permisos capturados en ZAPATA AI — consulta el catálogo de GlobalPC."
      />
    </div>
  )
}
