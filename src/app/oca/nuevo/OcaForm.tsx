'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GlassCard, AguilaInput, AguilaTextarea } from '@/components/aguila'
import { TEXT_MUTED, SILVER_GRADIENT } from '@/lib/design-system'
import type { OcaRow } from '@/lib/oca/types'

interface GenerateResponse {
  data: { opinion: OcaRow; razonamiento: string } | null
  error: { code: string; message: string } | null
}

export function OcaForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErr(null)
    setLoading(true)

    const fd = new FormData(e.currentTarget)
    const body = {
      product_description: String(fd.get('product_description') ?? '').trim(),
      pais_origen: String(fd.get('pais_origen') ?? '').trim(),
      uso_final: String(fd.get('uso_final') ?? '').trim() || undefined,
      fraccion_sugerida: String(fd.get('fraccion_sugerida') ?? '').trim() || undefined,
      trafico_id: String(fd.get('trafico_id') ?? '').trim() || undefined,
    }

    try {
      const res = await fetch('/api/oca/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as GenerateResponse
      if (!res.ok || !json.data) {
        setErr(json.error?.message ?? 'No se pudo generar la opinión')
        setLoading(false)
        return
      }
      router.push(`/oca/${json.data.opinion.id}`)
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2))
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 720, display: 'grid', gap: 16 }}>
      <GlassCard>
        <div style={{ display: 'grid', gap: 16 }}>
          <AguilaTextarea
            id="product_description"
            name="product_description"
            label="Descripción del producto"
            required
            minLength={10}
            maxLength={2000}
            rows={5}
            placeholder="Ej. Resina de polietileno de alta densidad, virgen, en pellets, para moldeo por inyección automotriz."
            style={{ minHeight: 110 }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <AguilaInput
              id="pais_origen"
              name="pais_origen"
              label="País de origen"
              required
              placeholder="USA, China, Alemania…"
            />
            <AguilaInput
              id="fraccion_sugerida"
              name="fraccion_sugerida"
              label="Fracción sugerida"
              placeholder="3901.20.01"
              pattern="\d{4}\.\d{2}\.\d{2}"
              mono
            />
          </div>

          <AguilaInput
            id="uso_final"
            name="uso_final"
            label="Uso final"
            placeholder="Aplicación industrial específica"
          />

          <AguilaInput
            id="trafico_id"
            name="trafico_id"
            label="Embarque (opcional)"
            placeholder="Vincular la opinión a un embarque"
            mono
          />
        </div>
      </GlassCard>

      {err && (
        <GlassCard>
          <p style={{ color: 'var(--portal-status-red-fg)', fontSize: 'var(--aguila-fs-body)', margin: 0 }}>{err}</p>
        </GlassCard>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          type="submit"
          disabled={loading}
          style={{
            minHeight: 60,
            padding: '0 28px',
            background: SILVER_GRADIENT,
            color: 'var(--portal-ink-0)',
            border: 'none',
            borderRadius: 10,
            fontSize: 'var(--aguila-fs-section)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Consultando Opus…' : 'Generar opinión'}
        </button>
        <span style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED }}>
          Opus evaluará LIGIE, TIGIE y GRI · ~30-60s
        </span>
      </div>
    </form>
  )
}
