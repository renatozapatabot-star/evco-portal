'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FallbackLink, SectionHeader } from '@/components/aguila'
import {
  BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW,
  TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY,
} from '@/lib/design-system'

export interface CarrierRow {
  id: string
  name: string
  carrier_type: 'mx' | 'transfer' | 'foreign'
  rfc: string | null
  sct_permit: string | null
  dot_number: string | null
  mc_number: string | null
  scac_code: string | null
  calificacion: number | null
  tipos_trailer: string[] | null
  area_servicio: string | null
  active: boolean
}

interface HistoryData {
  carrier: { id: string; name: string; carrier_type: string; calificacion: number | null; active: boolean }
  traficos_90d: number
  cruzados_90d: number
  on_time_rate: number | null
  recent: Array<{
    trafico: string
    company_id: string | null
    estatus: string | null
    fecha_cruce: string | null
    updated_at: string | null
  }>
}

const TYPE_TABS = [
  { key: 'mx', label: 'Mexicanos' },
  { key: 'transfer', label: 'Transfer' },
  { key: 'foreign', label: 'Extranjeros' },
] as const

function StarRating({ value }: { value: number | null }) {
  const v = value ?? 0
  return (
    <span style={{ color: v > 0 ? '#FDE68A' : 'rgba(255,255,255,0.2)', fontSize: 12, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
      {'★'.repeat(v)}{'☆'.repeat(5 - v)}
    </span>
  )
}

function fmtPct(n: number | null): string {
  if (n == null) return '—'
  return `${Math.round(n * 100)}%`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', timeZone: 'America/Chicago' })
  } catch {
    return '—'
  }
}

export function TransportistasClient({ initialRows }: { initialRows: CarrierRow[] }) {
  const [rows] = useState<CarrierRow[]>(initialRows)
  const [tab, setTab] = useState<'mx' | 'transfer' | 'foreign'>('mx')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryData | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (r.carrier_type !== tab) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        (r.rfc ?? '').toLowerCase().includes(q) ||
        (r.dot_number ?? '').toLowerCase().includes(q) ||
        (r.mc_number ?? '').toLowerCase().includes(q) ||
        (r.scac_code ?? '').toLowerCase().includes(q)
      )
    })
  }, [rows, tab, query])

  const counts = useMemo(() => ({
    mx: rows.filter((r) => r.carrier_type === 'mx' && r.active).length,
    transfer: rows.filter((r) => r.carrier_type === 'transfer' && r.active).length,
    foreign: rows.filter((r) => r.carrier_type === 'foreign' && r.active).length,
  }), [rows])

  const selectCarrier = useCallback(async (id: string) => {
    setSelectedId(id)
    setHistoryLoading(true)
    setHistory(null)
    try {
      const res = await fetch(`/api/carriers/${id}/history`)
      const json = await res.json()
      if (res.ok) setHistory(json.data as HistoryData)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    setSelectedId(null)
    setHistory(null)
  }, [tab])

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: 20 }}>
      <SectionHeader title="Transportistas" count={filtered.length} />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16, marginBottom: 12 }}>
        {TYPE_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px',
              minHeight: 40,
              borderRadius: 10,
              border: `1px solid ${tab === t.key ? '#C0C5CE' : BORDER}`,
              background: tab === t.key ? 'rgba(192,197,206,0.14)' : 'transparent',
              color: tab === t.key ? TEXT_PRIMARY : TEXT_SECONDARY,
              fontSize: 'var(--aguila-fs-body)', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {t.label}
            <span style={{
              marginLeft: 8, padding: '1px 8px', borderRadius: 999,
              background: 'rgba(255,255,255,0.08)', fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: 'var(--aguila-fs-meta)', color: TEXT_SECONDARY,
            }}>
              {counts[t.key]}
            </span>
          </button>
        ))}
        <input
          type="search"
          placeholder="Buscar por nombre, RFC, DOT, MC…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            flex: '1 1 280px', minWidth: 200,
            padding: '10px 14px', fontSize: 'var(--aguila-fs-body)',
            borderRadius: 10, border: `1px solid ${BORDER}`,
            background: 'rgba(255,255,255,0.04)', color: TEXT_PRIMARY,
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 16 }}>
        <div style={{
          background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 16,
          overflow: 'hidden', backdropFilter: `blur(${GLASS_BLUR})`, boxShadow: GLASS_SHADOW,
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 2fr) 100px 100px 90px 60px',
            gap: 12, padding: '12px 16px',
            borderBottom: `1px solid ${BORDER}`,
            fontSize: 'var(--aguila-fs-label)', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: TEXT_MUTED,
          }}>
            <div>Nombre</div>
            <div>{tab === 'foreign' ? 'DOT / MC' : 'RFC / SCT'}</div>
            <div>Trailers</div>
            <div>Rating</div>
            <div style={{ textAlign: 'right' }}>—</div>
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)' }}>
              Sin transportistas que coincidan.
            </div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => void selectCarrier(c.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 2fr) 100px 100px 90px 60px',
                  gap: 12, padding: '12px 16px',
                  borderBottom: `1px solid ${BORDER}`,
                  background: selectedId === c.id ? 'rgba(192,197,206,0.08)' : 'transparent',
                  border: 'none',
                  borderLeft: selectedId === c.id ? '2px solid #C0C5CE' : '2px solid transparent',
                  color: TEXT_PRIMARY, fontSize: 'var(--aguila-fs-body)', textAlign: 'left', cursor: 'pointer',
                  alignItems: 'center', width: '100%',
                  opacity: c.active ? 1 : 0.5,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.name}
                  </div>
                  {c.area_servicio && (
                    <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_SECONDARY, marginTop: 2 }}>
                      {c.area_servicio}
                    </div>
                  )}
                </div>
                <div style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: 'var(--aguila-fs-meta)', color: TEXT_SECONDARY }}>
                  {tab === 'foreign'
                    ? `${c.dot_number ?? '—'}${c.mc_number ? ` · MC${c.mc_number}` : ''}`
                    : `${c.rfc ?? '—'}`}
                </div>
                <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_SECONDARY }}>
                  {(c.tipos_trailer ?? []).slice(0, 2).join(', ') || '—'}
                </div>
                <div>
                  <StarRating value={c.calificacion} />
                </div>
                <div style={{ textAlign: 'right', fontSize: 'var(--aguila-fs-meta)', color: c.active ? '#86EFAC' : TEXT_MUTED }}>
                  {c.active ? '●' : '○'}
                </div>
              </button>
            ))
          )}
        </div>

        <aside style={{
          background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 16,
          padding: 20, backdropFilter: `blur(${GLASS_BLUR})`, boxShadow: GLASS_SHADOW,
        }}>
          {!selectedId ? (
            <div style={{ color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)' }}>
              Selecciona un transportista para ver su historial de 90 días.
            </div>
          ) : historyLoading ? (
            <div style={{ color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)' }}>Cargando historial…</div>
          ) : !history ? (
            <div style={{ color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)' }}>Sin historial disponible.</div>
          ) : (
            <>
              <div style={{
                fontSize: 'var(--aguila-fs-label)', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: TEXT_MUTED,
              }}>
                Últimos 90 días
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY, margin: '8px 0 16px 0' }}>
                {history.carrier.name}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_SECONDARY }}>Tráficos</div>
                  <div style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: 22, fontWeight: 800, color: TEXT_PRIMARY }}>
                    {history.traficos_90d}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_SECONDARY }}>Cruzados</div>
                  <div style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: 22, fontWeight: 800, color: TEXT_PRIMARY }}>
                    {fmtPct(history.on_time_rate)}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 'var(--aguila-fs-label)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: TEXT_MUTED, marginBottom: 8 }}>
                Tráficos recientes
              </div>
              {history.recent.length === 0 ? (
                <div style={{ fontSize: 12, color: TEXT_MUTED }}>Sin movimientos en 90 días.</div>
              ) : (
                history.recent.map((r) => (
                  <div key={r.trafico} style={{
                    display: 'flex', gap: 8, justifyContent: 'space-between',
                    padding: '6px 0', borderBottom: `1px solid ${BORDER}`,
                    fontSize: 12,
                  }}>
                    <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', color: TEXT_PRIMARY }}>
                      {r.trafico}
                    </span>
                    <span style={{ color: TEXT_SECONDARY }}>
                      {r.estatus ?? '—'} · {fmtDate(r.fecha_cruce ?? r.updated_at)}
                    </span>
                  </div>
                ))
              )}
            </>
          )}
        </aside>
      </div>

      <FallbackLink
        href="https://trafico1web.globalpc.net/catalogos/transportistas"
        label="Transportistas"
        isIncomplete={rows.length === 0}
        message="Sin transportistas en ZAPATA AI — consulta el catálogo de GlobalPC."
      />
    </div>
  )
}
