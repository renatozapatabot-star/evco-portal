'use client'

import { useMemo } from 'react'
import { fmtId, fmtDate, fmtUSD } from '@/lib/format-utils'
import { supplierStory } from '@/lib/data-stories'
import { countryFlag } from '@/lib/carrier-names'
import Link from 'next/link'

const T = {
  surface: 'var(--bg-card)',
  surfaceHover: '#F5F4F0',
  surfaceActive: '#EEEDE8',
  border: 'var(--border)',
  text: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  gold: 'var(--gold)',
  green: 'var(--success)',
  mono: 'var(--font-jetbrains-mono)',
} as const

interface TraficoRow {
  trafico: string
  proveedores?: string | null
  pais_procedencia?: string | null
  importe_total?: number | null
  fecha_llegada?: string | null
  estatus?: string | null
  descripcion_mercancia?: string | null
  company_id?: string | null
  pedimento?: string | null
  regimen?: string | null
  fecha_cruce?: string | null
  [k: string]: unknown
}

export interface SupplierAgg {
  name: string
  country: string | null
  traficoCount: number
  totalValue: number
  lastDate: string | null
  avgValue: number
  traficos: TraficoRow[]
  docCompliance: number
  avgDeliveryDays: number
  tmecRate: number
  riskLevel: 'low' | 'medium' | 'high' | 'watch'
  firstDate: string | null
}

export function SupplierDetail({ supplier: s }: { supplier: SupplierAgg }) {
  const descFreq = useMemo(() => {
    const map = new Map<string, number>()
    s.traficos.forEach(t => {
      const desc = (t.descripcion_mercancia ?? '').trim()
      if (desc) map.set(desc, (map.get(desc) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [s])

  return (
    <div style={{
      background: T.surfaceActive, borderBottom: `1px solid ${T.border}`,
      padding: '20px 16px 20px 48px',
    }}>
      {/* Stats row */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Embarques', value: String(s.traficoCount) },
          { label: 'Valor total', value: s.totalValue > 0 ? fmtUSD(s.totalValue) : '\u2014' },
          { label: 'Promedio por embarque', value: s.avgValue > 0 ? fmtUSD(s.avgValue) : '\u2014' },
          { label: 'País', value: s.country ? `${countryFlag(s.country)} ${s.country}` : '\uD83C\uDF10 Desconocido' },
          { label: 'Primer embarque', value: s.traficos.length > 0 ? fmtDate(s.traficos[s.traficos.length - 1].fecha_llegada) : '\u2014' },
          { label: 'Último embarque', value: s.lastDate ? fmtDate(s.lastDate) : '\u2014' },
        ].map(stat => (
          <div key={stat.label}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textMuted, marginBottom: 4 }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: T.mono, color: T.text }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Supplier narrative */}
      <p style={{
        fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
        fontStyle: 'italic', maxWidth: 600, margin: '0 0 16px',
      }}>
        {supplierStory({
          name: s.name.substring(0, 30),
          traficoCount: s.traficoCount,
          totalValue: s.totalValue,
          tmecRate: s.tmecRate,
          avgDeliveryDays: s.avgDeliveryDays,
        })}
      </p>

      {/* Common descriptions */}
      {descFreq.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textMuted, marginBottom: 8 }}>
            Mercancías frecuentes
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {descFreq.map(([desc, count]) => (
              <span key={desc} style={{
                fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 6,
                background: 'rgba(9,9,11,0.75)', border: `1px solid ${T.border}`,
                color: T.textSecondary, maxWidth: 280,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {desc} <span style={{ color: T.textMuted, fontFamily: T.mono }}>({count})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Traficos list */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textMuted, marginBottom: 8 }}>
          Embarques ({s.traficos.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {s.traficos.slice(0, 20).map(t => {
            const isCruzado = (t.estatus ?? '').toLowerCase().includes('cruz')
            return (
              <Link
                key={t.trafico}
                href={`/embarques/${encodeURIComponent(t.trafico)}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 100px 1fr 100px',
                  padding: '8px 12px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${T.border}`,
                  textDecoration: 'none', alignItems: 'center',
                  gap: 8, transition: 'background 100ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = T.surfaceHover)}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
              >
                <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: T.gold }}>
                  {fmtId(t.trafico)}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999,
                  background: isCruzado ? 'rgba(45,133,64,0.15)' : 'rgba(196,127,23,0.15)',
                  color: isCruzado ? T.green : '#C47F17',
                  border: `1px solid ${isCruzado ? 'rgba(45,133,64,0.25)' : 'rgba(196,127,23,0.25)'}`,
                  textAlign: 'center',
                }}>
                  {isCruzado ? 'Cruzado' : 'En Proceso'}
                </span>
                <span style={{ fontSize: 12, color: T.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.descripcion_mercancia ?? '\u2014'}
                </span>
                <span style={{ fontFamily: T.mono, fontSize: 12, color: T.text, textAlign: 'right' }}>
                  {t.importe_total && Number(t.importe_total) > 0 ? fmtUSD(Number(t.importe_total)) : '\u2014'}
                </span>
              </Link>
            )
          })}
          {s.traficos.length > 20 && (
            <div style={{ fontSize: 12, color: T.textMuted, padding: '8px 12px' }}>
              +{s.traficos.length - 20} traficos mas
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
