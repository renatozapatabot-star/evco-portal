'use client'

import { useMemo, useState } from 'react'
import { Calendar, Download, FileDown } from 'lucide-react'
import { GlassCard } from '@/components/aguila'
import {
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, BORDER_HAIRLINE,
} from '@/lib/design-system'

export interface ClientOption {
  companyId: string
  name: string
  clave: string
}

interface Props {
  clients: ClientOption[]
}

const MONO = 'var(--font-jetbrains-mono), monospace'

function startOfWeek(d: Date): Date {
  // ISO week starts Monday. Copy, roll back to Monday 00:00 UTC.
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dow = out.getUTCDay() || 7 // Sunday=0 → treat as 7
  if (dow !== 1) out.setUTCDate(out.getUTCDate() - (dow - 1))
  return out
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setUTCDate(out.getUTCDate() + days)
  return out
}

function fmtDateISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function fmtDateES(d: Date): string {
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

interface WeekPreset {
  key: string
  label: string
  from: string
  to: string
}

function buildPresets(now: Date): WeekPreset[] {
  const thisWeekStart = startOfWeek(now)
  const lastWeekStart = addDays(thisWeekStart, -7)
  const twoWeeksStart = addDays(thisWeekStart, -14)
  return [
    { key: 'this',  label: 'Esta semana',    from: fmtDateISO(thisWeekStart), to: fmtDateISO(addDays(thisWeekStart, 6)) },
    { key: 'last',  label: 'Semana pasada',  from: fmtDateISO(lastWeekStart), to: fmtDateISO(addDays(lastWeekStart, 6)) },
    { key: 'prior', label: 'Hace 2 semanas', from: fmtDateISO(twoWeeksStart), to: fmtDateISO(addDays(twoWeeksStart, 6)) },
  ]
}

export function AuditoriaGenerator({ clients }: Props) {
  const presets = useMemo(() => buildPresets(new Date()), [])
  const [selectedCompany, setSelectedCompany] = useState<string>(clients[0]?.companyId ?? '')
  const [presetKey, setPresetKey] = useState<string>('last')
  const [customFrom, setCustomFrom] = useState<string>('')
  const [customTo, setCustomTo] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeRange = useMemo(() => {
    if (presetKey === 'custom') {
      if (!customFrom || !customTo) return null
      if (customFrom > customTo) return null
      return { from: customFrom, to: customTo }
    }
    const p = presets.find((x) => x.key === presetKey)
    return p ? { from: p.from, to: p.to } : null
  }, [presetKey, customFrom, customTo, presets])

  const selectedClient = clients.find((c) => c.companyId === selectedCompany)

  const canGenerate = Boolean(selectedCompany && activeRange && !loading)

  const onGenerate = async () => {
    if (!canGenerate || !activeRange || !selectedClient) return
    setLoading(true)
    setError(null)
    try {
      const url = `/api/auditoria-pdf?from=${activeRange.from}&to=${activeRange.to}&company_id=${encodeURIComponent(selectedCompany)}`
      const res = await fetch(url)
      if (!res.ok) {
        const msg = await res.text().catch(() => '')
        throw new Error(msg || `Error ${res.status}`)
      }
      const blob = await res.blob()
      const dl = document.createElement('a')
      dl.href = URL.createObjectURL(blob)
      const clavePart = selectedClient.clave || selectedClient.companyId
      dl.download = `AUDITORIA_${clavePart}_${activeRange.from}_${activeRange.to}.pdf`
      document.body.appendChild(dl)
      dl.click()
      dl.remove()
      URL.revokeObjectURL(dl.href)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar el PDF')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--aguila-gap-card, 16px)', maxWidth: 840 }}>
      <GlassCard>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Client picker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label
              htmlFor="auditoria-client"
              style={{
                fontSize: 'var(--aguila-fs-label, 10px)',
                letterSpacing: 'var(--aguila-ls-label, 0.08em)',
                textTransform: 'uppercase',
                color: TEXT_MUTED,
              }}
            >
              Cliente
            </label>
            <select
              id="auditoria-client"
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              style={{
                width: '100%',
                minHeight: 60,
                padding: '0 16px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${BORDER_HAIRLINE}`,
                color: TEXT_PRIMARY,
                fontSize: 'var(--aguila-fs-section)',
                fontWeight: 600,
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                cursor: 'pointer',
              }}
            >
              {clients.length === 0 ? (
                <option value="">Sin clientes activos</option>
              ) : (
                clients.map((c) => (
                  <option key={c.companyId} value={c.companyId} style={{ background: 'var(--portal-ink-1)', color: TEXT_PRIMARY }}>
                    {c.name}{c.clave ? ` · clave ${c.clave}` : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Week presets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{
              fontSize: 'var(--aguila-fs-label, 10px)',
              letterSpacing: 'var(--aguila-ls-label, 0.08em)',
              textTransform: 'uppercase',
              color: TEXT_MUTED,
            }}>
              Semana
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {presets.map((p) => (
                <PresetButton
                  key={p.key}
                  active={presetKey === p.key}
                  onClick={() => setPresetKey(p.key)}
                  label={p.label}
                  detail={`${fmtDateES(new Date(p.from))} — ${fmtDateES(new Date(p.to))}`}
                />
              ))}
              <PresetButton
                active={presetKey === 'custom'}
                onClick={() => setPresetKey('custom')}
                label="Rango personalizado"
                detail={presetKey === 'custom' && customFrom && customTo
                  ? `${fmtDateES(new Date(customFrom))} — ${fmtDateES(new Date(customTo))}`
                  : 'Elige from y to'}
              />
            </div>
          </div>

          {presetKey === 'custom' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <DateField
                id="auditoria-from"
                label="Desde"
                value={customFrom}
                onChange={setCustomFrom}
              />
              <DateField
                id="auditoria-to"
                label="Hasta"
                value={customTo}
                onChange={setCustomTo}
              />
            </div>
          ) : null}

          {/* Active range summary + CTA */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            padding: '12px 16px',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${BORDER_HAIRLINE}`,
          }}>
            <Calendar size={16} color={TEXT_SECONDARY} aria-hidden />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 'var(--aguila-fs-compact)', color: TEXT_MUTED }}>
                Se generará
              </span>
              <span style={{ fontSize: 'var(--aguila-fs-body)', color: TEXT_PRIMARY, fontWeight: 600 }}>
                {selectedClient?.name ?? 'Cliente'}
                {activeRange ? ' · ' : ''}
                {activeRange ? (
                  <span style={{ fontFamily: MONO, color: TEXT_SECONDARY }}>
                    {activeRange.from} → {activeRange.to}
                  </span>
                ) : <span style={{ color: TEXT_MUTED }}>selecciona una semana</span>}
              </span>
            </div>
            <button
              type="button"
              onClick={() => { void onGenerate() }}
              disabled={!canGenerate}
              style={{
                marginLeft: 'auto',
                minHeight: 60,
                padding: '0 24px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                borderRadius: 12,
                background: canGenerate ? 'rgba(234,179,8,0.9)' : 'rgba(255,255,255,0.04)',
                border: canGenerate ? '1px solid rgba(234,179,8,0.3)' : `1px solid ${BORDER_HAIRLINE}`,
                color: canGenerate ? 'var(--portal-ink-0)' : TEXT_MUTED,
                fontSize: 'var(--aguila-fs-section)',
                fontWeight: 700,
                cursor: canGenerate ? 'pointer' : 'not-allowed',
                transition: 'background 160ms ease',
              }}
            >
              {loading
                ? <><FileDown size={18} className="aguila-spin" aria-hidden /> Generando…</>
                : <><Download size={18} aria-hidden /> Generar PDF</>}
            </button>
          </div>

          {error ? (
            <div style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'var(--portal-status-red-bg)',
              border: '1px solid var(--portal-status-red-ring)',
              color: 'var(--portal-status-red-fg)',
              fontSize: 'var(--aguila-fs-compact)',
            }}>
              {error}
            </div>
          ) : null}
        </div>
      </GlassCard>

      <GlassCard size="compact">
        <div style={{
          fontSize: 'var(--aguila-fs-label, 10px)',
          letterSpacing: 'var(--aguila-ls-label, 0.08em)',
          textTransform: 'uppercase',
          color: TEXT_MUTED,
          marginBottom: 8,
        }}>
          Qué incluye el PDF
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, color: TEXT_SECONDARY, fontSize: 'var(--aguila-fs-body)', lineHeight: 1.6 }}>
          <li>Resumen financiero de pedimentos — valor total, DTA, IGI, IVA, total gravamen.</li>
          <li>Detalle de pedimentos por proveedor con factura, COVE y estatus.</li>
          <li>Remesas cruzadas agrupadas por día con bultos, peso y valor.</li>
          <li>Fracciones arancelarias utilizadas en la semana.</li>
          <li>Pie con Patente 3596, Aduana 240, RFC y fecha de emisión.</li>
        </ul>
      </GlassCard>

      <style jsx>{`
        :global(.aguila-spin) {
          animation: aguila-spin 1s linear infinite;
        }
        @keyframes aguila-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.aguila-spin) { animation: none; }
        }
      `}</style>
    </div>
  )
}

function PresetButton({
  active, onClick, label, detail,
}: {
  active: boolean
  onClick: () => void
  label: string
  detail: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        minHeight: 60,
        padding: '10px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
        borderRadius: 12,
        background: active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
        border: active ? '1px solid rgba(255,255,255,0.16)' : `1px solid ${BORDER_HAIRLINE}`,
        color: active ? TEXT_PRIMARY : TEXT_SECONDARY,
        fontSize: 'var(--aguila-fs-body)',
        fontWeight: 600,
        cursor: 'pointer',
        minWidth: 180,
        transition: 'background 160ms ease, color 160ms ease',
      }}
    >
      <span>{label}</span>
      <span style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, fontWeight: 500 }}>{detail}</span>
    </button>
  )
}

function DateField({
  id, label, value, onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        htmlFor={id}
        style={{
          fontSize: 'var(--aguila-fs-label, 10px)',
          letterSpacing: 'var(--aguila-ls-label, 0.08em)',
          textTransform: 'uppercase',
          color: TEXT_MUTED,
        }}
      >
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          minHeight: 60,
          padding: '0 14px',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${BORDER_HAIRLINE}`,
          color: TEXT_PRIMARY,
          fontSize: 'var(--aguila-fs-section)',
          fontFamily: MONO,
          colorScheme: 'dark',
        }}
      />
    </div>
  )
}
