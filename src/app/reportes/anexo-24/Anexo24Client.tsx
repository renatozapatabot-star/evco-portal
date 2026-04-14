'use client'

import { useState } from 'react'
import { BG_ELEVATED } from '@/lib/design-system'

interface Anexo24ClientProps {
  isInternal: boolean
  companyId: string
}

interface GenerateResult {
  pdf_url: string
  xlsx_url: string
  row_count: number
  generado_en: string
}

export function Anexo24Client({ isInternal, companyId }: Anexo24ClientProps) {
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [clienteFilter, setClienteFilter] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/reports/anexo-24/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_from: dateFrom || null,
          date_to: dateTo || null,
          company_id: isInternal && clienteFilter ? clienteFilter : null,
        }),
      })
      const body = (await res.json()) as {
        data: GenerateResult | null
        error: { code: string; message: string } | null
      }
      if (!res.ok || body.error) {
        setError(body.error?.message ?? 'Error al generar Anexo 24')
        return
      }
      if (body.data) setResult(body.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div
      className="rounded-2xl border p-6"
      style={{
        backgroundColor: BG_ELEVATED,
        borderColor: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <section className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="date-from"
            className="mb-2 block text-xs uppercase tracking-wider text-slate-400"
          >
            Desde
          </label>
          <input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-xl border px-4 py-3 font-mono text-sm text-slate-100 focus:outline-none"
            style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderColor: 'rgba(255,255,255,0.10)',
              minHeight: '60px',
            }}
          />
        </div>
        <div>
          <label
            htmlFor="date-to"
            className="mb-2 block text-xs uppercase tracking-wider text-slate-400"
          >
            Hasta
          </label>
          <input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-xl border px-4 py-3 font-mono text-sm text-slate-100 focus:outline-none"
            style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderColor: 'rgba(255,255,255,0.10)',
              minHeight: '60px',
            }}
          />
        </div>
      </section>

      {isInternal && (
        <section className="mb-5">
          <label
            htmlFor="cliente-filter"
            className="mb-2 block text-xs uppercase tracking-wider text-slate-400"
          >
            Cliente (opcional — dejar vacío para sesión actual)
          </label>
          <input
            id="cliente-filter"
            type="text"
            value={clienteFilter}
            onChange={(e) => setClienteFilter(e.target.value)}
            placeholder={companyId}
            className="w-full rounded-xl border px-4 py-3 font-mono text-sm text-slate-100 focus:outline-none"
            style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderColor: 'rgba(255,255,255,0.10)',
              minHeight: '60px',
            }}
          />
        </section>
      )}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating}
        className="w-full rounded-xl px-6 py-4 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        style={{
          minHeight: '60px',
          background: !generating
            ? 'linear-gradient(135deg, #E8EAED 0%, #C0C5CE 50%, #7A7E86 100%)'
            : 'rgba(192,197,206,0.25)',
          color: !generating ? '#0A0A0C' : '#7A7E86',
        }}
      >
        {generating ? 'Generando…' : 'Generar Anexo 24'}
      </button>

      {error && (
        <p className="mt-4 text-sm" style={{ color: '#EF4444' }}>
          {error}
        </p>
      )}

      {result && (
        <section
          className="mt-6 rounded-xl border p-4"
          style={{
            backgroundColor: 'rgba(192,197,206,0.08)',
            borderColor: 'rgba(192,197,206,0.25)',
          }}
        >
          <p className="mb-2 text-xs uppercase tracking-wider text-slate-400">
            Anexo 24 generado
          </p>
          <p className="text-sm text-slate-200">
            <span className="font-mono">{result.row_count}</span> partidas ·{' '}
            <span className="font-mono text-xs text-slate-400">
              {result.generado_en}
            </span>
          </p>
          <div className="mt-3 flex gap-4">
            <a
              href={result.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline"
              style={{ color: '#C0C5CE' }}
            >
              Descargar PDF
            </a>
            <a
              href={result.xlsx_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline"
              style={{ color: '#C0C5CE' }}
            >
              Descargar Excel
            </a>
          </div>
        </section>
      )}
    </div>
  )
}
