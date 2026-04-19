'use client'

import { useMemo, useState } from 'react'
import { Download, Loader2, Calendar } from 'lucide-react'

interface Props {
  companyId: string
  isInternal: boolean
}

/**
 * Primary CTA — "Descargar Formato 53". Streams the PDF + XLSX directly
 * from `/api/reports/anexo-24/generate` (no storage round-trip). The
 * user picks a window before downloading:
 *
 *   · Año actual (default — YTD)
 *   · Este mes / Mes anterior / Trimestre / 90 días
 *   · Rango personalizado (DD/MM/YYYY → DD/MM/YYYY)
 *
 * The window flows into `date_from` / `date_to` query params which the
 * endpoint filters against `traficos.fecha_pago` — matches the SAT
 * auditor's mental model ("show me what was paid in March").
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
      const from = new Date(Date.now() - 90 * 86_400_000)
      return { from: iso(from), to: today, label: 'Últimos 90 días' }
    }
    case 'custom':
      return { from: custom.from, to: custom.to, label: `${custom.from} → ${custom.to}` }
  }
}

export function Anexo24DownloadCta({ companyId, isInternal }: Props) {
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{ row_count: number; label: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preset, setPreset] = useState<Preset>('ytd')
  const [custom, setCustom] = useState(() => {
    const now = new Date()
    const y = now.getUTCFullYear()
    return { from: `${y}-01-01`, to: iso(now) }
  })

  const range = useMemo(() => computeRange(preset, custom), [preset, custom])

  const buildUrl = (format: 'pdf' | 'xlsx') => {
    const params = new URLSearchParams({ format, date_from: range.from, date_to: range.to })
    if (isInternal && companyId) params.set('company_id', companyId)
    return `/api/reports/anexo-24/generate?${params.toString()}`
  }

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

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    setResult(null)
    try {
      const pdfRes = await downloadBlob(
        buildUrl('pdf'),
        `anexo24_${companyId || 'evco'}_${range.from}_${range.to}.pdf`,
      )
      if (!pdfRes.ok) {
        const diag = await pdfRes.json().catch(() => null) as { error?: { message?: string } } | null
        setError(diag?.error?.message ?? `Error al generar PDF (HTTP ${pdfRes.status})`)
        return
      }
      const rowCount = Number.parseInt(pdfRes.headers.get('X-Anexo24-Rows') ?? '0', 10) || 0

      const xlsxRes = await downloadBlob(
        buildUrl('xlsx'),
        `anexo24_${companyId || 'evco'}_${range.from}_${range.to}.xlsx`,
      )
      if (!xlsxRes.ok) {
        const diag = await xlsxRes.json().catch(() => null) as { error?: { message?: string } } | null
        setError(diag?.error?.message ?? `Excel no disponible (HTTP ${xlsxRes.status}). PDF se descargó correctamente.`)
      }

      setResult({ row_count: rowCount, label: range.label })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div>
      {/* Period selector */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 14,
          alignItems: 'center',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 'var(--aguila-fs-meta, 11px)',
            color: 'rgba(192,197,206,0.7)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 600,
            marginRight: 8,
          }}
        >
          <Calendar size={12} strokeWidth={1.8} aria-hidden />
          Periodo
        </span>
        {([
          ['mes', 'Este mes'],
          ['mes_anterior', 'Mes anterior'],
          ['trimestre', 'Este trimestre'],
          ['ultimos_90', '90 días'],
          ['ytd', 'Año actual'],
          ['custom', 'Personalizado'],
        ] as Array<[Preset, string]>).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPreset(key)}
            aria-pressed={preset === key}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 12, // WHY: button label between --aguila-fs-meta (11) and --aguila-fs-body (13) — distinct from body on the same row.
              fontWeight: preset === key ? 700 : 500,
              background: preset === key ? 'rgba(201,167,74,0.14)' : 'rgba(192,197,206,0.06)',
              border: `1px solid ${preset === key ? 'rgba(201,167,74,0.45)' : 'rgba(192,197,206,0.18)'}`,
              color: preset === key ? '#F4D47A' : 'rgba(230,237,243,0.82)',
              cursor: 'pointer',
              transition: 'all var(--dur-fast, 150ms) ease',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, fontSize: 'var(--aguila-fs-meta, 11px)', color: 'rgba(192,197,206,0.7)' }}>
            Desde
            <input
              type="date"
              value={custom.from}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(192,197,206,0.18)',
                color: 'var(--portal-fg-1)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12, // WHY: date input label — mid-tier, matches button set above.
                minHeight: 40,
              }}
            />
          </label>
          <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, fontSize: 'var(--aguila-fs-meta, 11px)', color: 'rgba(192,197,206,0.7)' }}>
            Hasta
            <input
              type="date"
              value={custom.to}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(192,197,206,0.18)',
                color: 'var(--portal-fg-1)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12, // WHY: date input label — mid-tier, matches button set above.
                minHeight: 40,
              }}
            />
          </label>
        </div>
      )}

      <div style={{ fontSize: 11, // WHY: metadata range label sits below --aguila-fs-meta
        color: "rgba(192,197,206,0.6)", marginBottom: 10, fontFamily: 'var(--font-mono)' }}>
        {range.from} → {range.to}
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating}
        aria-label="Descargar Formato 53"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          minHeight: 60,
          padding: '0 28px',
          borderRadius: 14,
          border: 'none',
          background: generating
            ? 'rgba(201,167,74,0.28)'
            : 'linear-gradient(135deg, #F4D47A 0%, #C9A74A 50%, #8F7628 100%)', // design-token — canonical silver/gold CTA gradient
          color: generating ? 'rgba(230,237,243,0.55)' : 'var(--portal-ink-0)',
          fontSize: 'var(--aguila-fs-section, 15px)',
          fontWeight: 700,
          letterSpacing: '0.02em',
          cursor: generating ? 'wait' : 'pointer',
          boxShadow: generating
            ? 'none'
            : '0 10px 30px rgba(201,167,74,0.25), 0 0 20px rgba(201,167,74,0.12), inset 0 1px 0 rgba(255,255,255,0.22)',
          transition: 'all var(--dur-fast, 150ms) var(--ease-brand, cubic-bezier(0.22, 1, 0.36, 1))',
        }}
      >
        {generating ? (
          <>
            <Loader2 size={18} className="cruz-spin" strokeWidth={2} />
            Generando Formato 53…
          </>
        ) : (
          <>
            <Download size={18} strokeWidth={2} />
            Descargar Formato 53 (PDF + Excel)
          </>
        )}
      </button>

      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        <a
          href={`/api/anexo-24/csv${isInternal ? `?company_id=${encodeURIComponent(companyId)}` : ''}`}
          style={{
            fontSize: 'var(--aguila-fs-meta, 11px)',
            color: 'rgba(192,197,206,0.7)',
            textDecoration: 'none',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            borderBottom: '1px solid rgba(192,197,206,0.18)',
            paddingBottom: 1,
            transition: 'color var(--dur-fast, 150ms) ease, border-color var(--dur-fast, 150ms) ease',
          }}
        >
          Descargar CSV para contabilidad
        </a>
      </div>

      {error && (
        <p
          role="alert"
          style={{
            marginTop: 12,
            fontSize: 'var(--aguila-fs-body, 13px)',
            color: 'var(--portal-status-red-fg)',
          }}
        >
          {error}
        </p>
      )}

      {result && !generating && (
        <div
          role="status"
          style={{
            marginTop: 14,
            padding: '10px 14px',
            borderRadius: 10,
            background: 'var(--portal-status-green-bg)',
            border: '1px solid rgba(34,197,94,0.18)',
            fontSize: 'var(--aguila-fs-body, 13px)',
            color: 'rgba(230,237,243,0.88)',
          }}
        >
          Formato 53 descargado · {result.label} · {result.row_count.toLocaleString('es-MX')} partidas · PDF + Excel
        </div>
      )}

      <style jsx>{`
        .cruz-spin { animation: cruz-rotate 900ms linear infinite; }
        @keyframes cruz-rotate { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .cruz-spin { animation: none; }
        }
      `}</style>
    </div>
  )
}
