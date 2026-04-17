'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'

interface Props {
  companyId: string
  isInternal: boolean
}

/**
 * Primary CTA — "Descargar Formato 53". One tap streams the PDF from
 * /api/reports/anexo-24/generate directly to the browser; a follow-up
 * fetch pulls the XLSX as a blob download. No storage round-trip, no
 * waiting for upload, no secondary click.
 *
 * On error the endpoint now returns a real diagnostic message (row
 * count, SQL error, bucket name) — the UI surfaces it verbatim so
 * Ursula can forward a screenshot and the support team can act.
 */
export function Anexo24DownloadCta({ companyId, isInternal }: Props) {
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{ row_count: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const buildUrl = (format: 'pdf' | 'xlsx') => {
    const now = new Date()
    const yearStart = `${now.getUTCFullYear()}-01-01`
    const today = now.toISOString().slice(0, 10)
    const params = new URLSearchParams({ format, date_from: yearStart, date_to: today })
    if (isInternal && companyId) params.set('company_id', companyId)
    return `/api/reports/anexo-24/generate?${params.toString()}`
  }

  /** Fetch a streaming URL as a Blob, then trigger a same-page download
   *  via a temporary anchor. Works on iOS Safari (no popup blocker) and
   *  matches the save-to-Files UX Ursula expects from an audit doc. */
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
    // Release the object URL on the next tick so the download can finish
    setTimeout(() => URL.revokeObjectURL(href), 1000)
    return res
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    setResult(null)
    try {
      const now = new Date()
      const yearStart = `${now.getUTCFullYear()}-01-01`
      const today = now.toISOString().slice(0, 10)

      // PDF first — user sees the doc appear immediately. XLSX follows
      // so accounting gets the machine-readable copy.
      const pdfRes = await downloadBlob(
        buildUrl('pdf'),
        `anexo24_${companyId || 'evco'}_${yearStart}_${today}.pdf`,
      )
      if (!pdfRes.ok) {
        const diag = await pdfRes.json().catch(() => null) as { error?: { message?: string } } | null
        setError(diag?.error?.message ?? `Error al generar PDF (HTTP ${pdfRes.status})`)
        return
      }
      const rowCount = Number.parseInt(pdfRes.headers.get('X-Anexo24-Rows') ?? '0', 10) || 0

      const xlsxRes = await downloadBlob(
        buildUrl('xlsx'),
        `anexo24_${companyId || 'evco'}_${yearStart}_${today}.xlsx`,
      )
      if (!xlsxRes.ok) {
        const diag = await xlsxRes.json().catch(() => null) as { error?: { message?: string } } | null
        // Not fatal — PDF already downloaded. Surface a soft warning.
        setError(diag?.error?.message ?? `Excel no disponible (HTTP ${xlsxRes.status}). PDF se descargó correctamente.`)
      }

      setResult({ row_count: rowCount })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div>
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
            : 'linear-gradient(135deg, #F4D47A 0%, #C9A74A 50%, #8F7628 100%)',
          color: generating ? 'rgba(230,237,243,0.55)' : '#0A0A0C',
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
            color: '#FCA5A5',
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
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.18)',
            fontSize: 'var(--aguila-fs-body, 13px)',
            color: 'rgba(230,237,243,0.88)',
          }}
        >
          Formato 53 descargado · {result.row_count.toLocaleString('es-MX')} partidas · PDF + Excel
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
