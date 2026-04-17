'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'

interface GenerateResult {
  pdf_url: string
  xlsx_url: string
  row_count: number
  generado_en: string
}

interface Props {
  companyId: string
  isInternal: boolean
}

/**
 * Primary CTA — "Descargar Formato 53". Single tap generates both PDF
 * and XLSX against the full year-to-date window, opens the PDF in a
 * new tab, and records the generation in the Anexo 24 docs hub.
 *
 * Internal users can override the period via ?from=YYYY-MM-DD&to=
 * later; Phase 1 keeps the interaction minimal — one button, one tap,
 * something downloads.
 */
export function Anexo24DownloadCta({ companyId, isInternal }: Props) {
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    setResult(null)
    try {
      // Default window: current calendar year → today. Matches SAT
      // audit cadence (annual reviews) so Ursula can defend any
      // period the inspector asks for.
      const now = new Date()
      const yearStart = `${now.getUTCFullYear()}-01-01`
      const today = now.toISOString().slice(0, 10)

      const res = await fetch('/api/reports/anexo-24/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_from: yearStart,
          date_to: today,
          company_id: isInternal ? companyId : null,
        }),
      })
      const body = (await res.json()) as {
        data: GenerateResult | null
        error: { code: string; message: string } | null
      }
      if (!res.ok || body.error) {
        setError(body.error?.message ?? 'No pudimos generar el Formato 53. Intenta de nuevo en unos minutos.')
        return
      }
      if (body.data) {
        setResult(body.data)
        // Auto-open the PDF so Ursula doesn't have to hunt for the link.
        if (typeof window !== 'undefined' && body.data.pdf_url) {
          window.open(body.data.pdf_url, '_blank', 'noopener,noreferrer')
        }
      }
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
          Formato 53 generado con {result.row_count.toLocaleString('es-MX')} partidas ·{' '}
          <a
            href={result.xlsx_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#C9A74A', textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            descargar Excel
          </a>
          {result.pdf_url && (
            <>
              {' · '}
              <a
                href={result.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#C9A74A', textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                abrir PDF
              </a>
            </>
          )}
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
