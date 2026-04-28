'use client'

import { useMemo, useState } from 'react'
import { Download, Loader2, Calendar } from 'lucide-react'
import { formatDateDMY, formatNumber } from '@/lib/format'
import styles from './Anexo24DownloadCta.module.css'

interface Props {
  companyId: string
  isInternal: boolean
}

/**
 * Primary CTA — "Descargar Formato 53". Streams the PDF + XLSX directly
 * from `/api/reports/anexo-24/generate` (no storage round-trip). User
 * picks a window via the toggle group (audit lock-in 2026-04-25):
 *
 *   · Año actual (default — YTD)
 *   · Este mes / Mes anterior / Trimestre / 90 días
 *   · Rango personalizado
 *
 * Three explicit download buttons: PDF · Excel · CSV (outline).
 * The window flows into `date_from` / `date_to` query params which the
 * endpoint filters against `traficos.fecha_pago`.
 */

type Preset = 'ytd' | 'mes' | 'mes_anterior' | 'trimestre' | 'ultimos_90' | 'custom'

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function computeRange(preset: Preset, custom: { from: string; to: string }): { from: string; to: string; label: string } {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const today = iso(now)
  switch (preset) {
    case 'ytd':
      return { from: `${y}-01-01`, to: today, label: `Año ${y} (acumulado)` }
    case 'mes': {
      const from = new Date(Date.UTC(y, m, 1))
      return { from: iso(from), to: today, label: from.toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }) }
    }
    case 'mes_anterior': {
      const from = new Date(Date.UTC(y, m - 1, 1))
      const to = new Date(Date.UTC(y, m, 0))
      return { from: iso(from), to: iso(to), label: from.toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }) }
    }
    case 'trimestre': {
      const q = Math.floor(m / 3)
      const from = new Date(Date.UTC(y, q * 3, 1))
      return { from: iso(from), to: today, label: `T${q + 1} ${y}` }
    }
    case 'ultimos_90': {
      // UTC-anchored math so the result doesn't drift ±1 day depending
      // on the client's timezone. The screen + the exporter both filter
      // on `traficos.fecha_pago` (DATE in UTC) — anchor here too.
      const from = new Date(Date.UTC(y, m, now.getUTCDate() - 90))
      return { from: iso(from), to: today, label: 'Últimos 90 días' }
    }
    case 'custom':
      return { from: custom.from, to: custom.to, label: `${formatDateDMY(custom.from)} → ${formatDateDMY(custom.to)}` }
  }
}

const PRESETS: Array<[Preset, string]> = [
  ['mes', 'Este mes'],
  ['mes_anterior', 'Mes anterior'],
  ['trimestre', 'Este trimestre'],
  ['ultimos_90', '90 días'],
  ['ytd', 'Año actual'],
  ['custom', 'Personalizado'],
]

export function Anexo24DownloadCta({ companyId, isInternal }: Props) {
  const [generating, setGenerating] = useState<null | 'pdf' | 'xlsx'>(null)
  const [result, setResult] = useState<{ row_count: number; label: string; format: 'PDF' | 'Excel' } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preset, setPreset] = useState<Preset>('ytd')
  const [custom, setCustom] = useState(() => {
    const now = new Date()
    const y = now.getUTCFullYear()
    return { from: `${y}-01-01`, to: iso(now) }
  })

  const range = useMemo(() => computeRange(preset, custom), [preset, custom])
  const rangeInvalid = range.from > range.to

  const buildUrl = (format: 'pdf' | 'xlsx') => {
    const params = new URLSearchParams({ format, date_from: range.from, date_to: range.to })
    if (isInternal && companyId) params.set('company_id', companyId)
    return `/api/reports/anexo-24/generate?${params.toString()}`
  }

  const csvHref = (() => {
    const params = new URLSearchParams({ date_from: range.from, date_to: range.to })
    if (isInternal && companyId) params.set('company_id', companyId)
    return `/api/anexo-24/csv?${params.toString()}`
  })()

  const downloadBlob = async (url: string, filename: string): Promise<Response> => {
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) return res
    const blob = await res.blob()
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(href), 1000)
    return res
  }

  const handleDownload = async (format: 'pdf' | 'xlsx') => {
    if (rangeInvalid) {
      setError('La fecha inicial no puede ser posterior a la final.')
      return
    }
    setGenerating(format)
    setError(null)
    setResult(null)
    try {
      const ext = format === 'pdf' ? 'pdf' : 'xlsx'
      const res = await downloadBlob(
        buildUrl(format),
        `anexo24_${companyId || 'evco'}_${range.from}_${range.to}.${ext}`,
      )
      if (!res.ok) {
        const diag = await res.json().catch(() => null) as { error?: { message?: string } } | null
        setError(diag?.error?.message ?? `Error al generar ${format.toUpperCase()} (HTTP ${res.status})`)
        return
      }
      const rowCount = Number.parseInt(res.headers.get('X-Anexo24-Rows') ?? '0', 10) || 0
      setResult({ row_count: rowCount, label: range.label, format: format === 'pdf' ? 'PDF' : 'Excel' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión')
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div className={styles.wrapper}>
      {/* Period header label */}
      <div className={styles.periodHeader}>
        <Calendar size={12} strokeWidth={1.8} aria-hidden />
        Periodo
      </div>

      {/* ToggleGroup — horizontal scroll on mobile, wrap on desktop */}
      <div role="radiogroup" aria-label="Periodo del Formato 53" className={styles.toggleGroup}>
        {PRESETS.map(([key, label]) => {
          const active = preset === key
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setPreset(key)}
              className={`${styles.toggle} ${active ? styles.toggleActive : ''}`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {preset === 'custom' && (
        <div className={styles.customRow}>
          <label className={styles.customLabel}>
            Desde
            <input
              type="date"
              value={custom.from}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
              className={styles.customInput}
            />
          </label>
          <label className={styles.customLabel}>
            Hasta
            <input
              type="date"
              value={custom.to}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
              className={styles.customInput}
            />
          </label>
        </div>
      )}

      <div className={styles.rangeChip}>
        {formatDateDMY(range.from)} → {formatDateDMY(range.to)}
      </div>

      {/* Three download buttons */}
      <div className={styles.actions}>
        <button
          type="button"
          onClick={() => handleDownload('pdf')}
          disabled={generating !== null || rangeInvalid}
          aria-label="Descargar PDF"
          className={styles.btnPrimary}
        >
          {generating === 'pdf' ? (
            <>
              <Loader2 size={16} className={styles.spin} strokeWidth={2} />
              Generando PDF…
            </>
          ) : (
            <>
              <Download size={16} strokeWidth={2} />
              Descargar PDF
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleDownload('xlsx')}
          disabled={generating !== null || rangeInvalid}
          aria-label="Descargar Excel"
          className={styles.btnPrimary}
        >
          {generating === 'xlsx' ? (
            <>
              <Loader2 size={16} className={styles.spin} strokeWidth={2} />
              Generando Excel…
            </>
          ) : (
            <>
              <Download size={16} strokeWidth={2} />
              Descargar Excel
            </>
          )}
        </button>

        <a
          href={rangeInvalid ? '#' : csvHref}
          aria-label="Descargar CSV"
          aria-disabled={rangeInvalid}
          onClick={(e) => { if (rangeInvalid) e.preventDefault() }}
          className={styles.btnOutline}
        >
          <Download size={16} strokeWidth={2} />
          Descargar CSV
        </a>
      </div>

      {error && (
        <p role="alert" className={styles.error}>{error}</p>
      )}

      {result && !generating && (
        <div role="status" className={styles.success}>
          {result.format} descargado · {result.label} · {formatNumber(result.row_count)} partidas
        </div>
      )}
    </div>
  )
}
