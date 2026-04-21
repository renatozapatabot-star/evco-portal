'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GlassCard, SectionHeader, AguilaInput, AguilaSelect } from '@/components/aguila'
import { TEXT_PRIMARY, TEXT_MUTED, SILVER_GRADIENT } from '@/lib/design-system'
import { ORIGIN_CRITERION_LABELS, type UsmcaCertRow } from '@/lib/usmca/types'

interface Response {
  data: { certificate: UsmcaCertRow } | null
  error: { code: string; message: string } | null
}

const inputStyle = {
  width: '100%',
  minHeight: 48,
  padding: '12px 14px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  color: TEXT_PRIMARY,
  fontSize: 'var(--aguila-fs-section)',
  fontFamily: 'inherit',
  outline: 'none',
} as const

const monoInputStyle = {
  ...inputStyle,
  fontFamily: 'var(--font-jetbrains-mono), monospace',
} as const

const labelStyle = {
  display: 'block',
  fontSize: 'var(--aguila-fs-label)',
  fontWeight: 700,
  color: TEXT_MUTED,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.8,
  marginBottom: 6,
}

export function CertForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErr(null)
    setLoading(true)

    const fd = new FormData(e.currentTarget)
    const pick = (k: string) => {
      const v = String(fd.get(k) ?? '').trim()
      return v.length ? v : undefined
    }

    const body = {
      trafico_id: pick('trafico_id'),
      certifier_role: String(fd.get('certifier_role') ?? 'exporter'),
      certifier_name: String(fd.get('certifier_name') ?? '').trim(),
      certifier_title: pick('certifier_title'),
      certifier_address: pick('certifier_address'),
      certifier_email: pick('certifier_email'),
      certifier_phone: pick('certifier_phone'),
      exporter_name: pick('exporter_name'),
      exporter_address: pick('exporter_address'),
      producer_name: pick('producer_name'),
      producer_address: pick('producer_address'),
      importer_name: pick('importer_name'),
      importer_address: pick('importer_address'),
      goods_description: String(fd.get('goods_description') ?? '').trim(),
      hs_code: String(fd.get('hs_code') ?? '').trim(),
      origin_criterion: String(fd.get('origin_criterion') ?? 'B'),
      rvc_method: pick('rvc_method'),
      country_of_origin: String(fd.get('country_of_origin') ?? 'US').trim(),
      blanket_from: pick('blanket_from'),
      blanket_to: pick('blanket_to'),
      notes: pick('notes'),
    }

    try {
      const res = await fetch('/api/usmca/certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as Response
      if (!res.ok || !json.data) {
        setErr(json.error?.message ?? 'No se pudo crear el certificado')
        setLoading(false)
        return
      }
      router.push(`/usmca/certificados/${json.data.certificate.id}`)
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2))
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 820, display: 'grid', gap: 16 }}>
      <GlassCard>
        <SectionHeader title="Bienes" />
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label htmlFor="goods_description" style={labelStyle}>Descripción de los bienes *</label>
            <textarea
              id="goods_description"
              name="goods_description"
              required minLength={5} maxLength={2000} rows={4}
              placeholder="Suficiente para identificar los bienes (marca, modelo, material, uso)…"
              style={{ ...inputStyle, resize: 'vertical', minHeight: 96 }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
            <AguilaInput id="hs_code" name="hs_code" label="HS Code (6+ dígitos)" required placeholder="3901.20 ó 3901.20.01" mono />
            <AguilaInput id="country_of_origin" name="country_of_origin" label="País origen" defaultValue="US" maxLength={3} mono />
            <AguilaSelect
              id="origin_criterion"
              name="origin_criterion"
              label="Criterio origen"
              required
              defaultValue="B"
              options={(['A','B','C','D'] as const).map((k) => ({
                value: k,
                label: `${k} — ${ORIGIN_CRITERION_LABELS[k].split('·')[1]?.trim() ?? k}`,
              }))}
            />
            <AguilaInput id="rvc_method" name="rvc_method" label="Método RVC (si aplica)" placeholder="Transaction Value · Net Cost" />
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Certificador" />
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <AguilaSelect
              id="certifier_role"
              name="certifier_role"
              label="Rol"
              required
              defaultValue="exporter"
              options={[
                { value: 'exporter', label: 'Exportador' },
                { value: 'producer', label: 'Productor' },
                { value: 'importer', label: 'Importador' },
              ]}
            />
            <AguilaInput
              id="certifier_name"
              name="certifier_name"
              label="Nombre"
              required
              minLength={2}
              maxLength={200}
              className="usmca-col-span-2"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <AguilaInput id="certifier_title" name="certifier_title" label="Cargo" />
            <AguilaInput id="certifier_email" name="certifier_email" label="Correo" type="email" />
            <AguilaInput id="certifier_phone" name="certifier_phone" label="Teléfono" type="tel" />
          </div>
          <AguilaInput id="certifier_address" name="certifier_address" label="Domicilio" />
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Partes" />
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            <AguilaInput id="exporter_name" name="exporter_name" label="Exportador" />
            <AguilaInput id="exporter_address" name="exporter_address" label="Domicilio exportador" />
            <AguilaInput id="producer_name" name="producer_name" label="Productor" />
            <AguilaInput id="producer_address" name="producer_address" label="Domicilio productor" />
            <AguilaInput id="importer_name" name="importer_name" label="Importador" />
            <AguilaInput id="importer_address" name="importer_address" label="Domicilio importador" />
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Vigencia y vínculos" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <AguilaInput id="blanket_from" name="blanket_from" label="Blanket desde" type="date" mono />
          <AguilaInput id="blanket_to" name="blanket_to" label="Blanket hasta (máx 12 meses)" type="date" mono />
          <AguilaInput id="trafico_id" name="trafico_id" label="Embarque vinculado" mono />
        </div>
        <div style={{ marginTop: 14 }}>
          <label htmlFor="notes" style={labelStyle}>Notas internas</label>
          <textarea id="notes" name="notes" rows={2} maxLength={1000} style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }} />
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
            minHeight: 60, padding: '0 28px',
            background: SILVER_GRADIENT, color: 'var(--portal-ink-0)',
            border: 'none', borderRadius: 10,
            fontSize: 'var(--aguila-fs-section)', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 0.5,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Guardando borrador…' : 'Crear borrador'}
        </button>
        <span style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED }}>
          Firma final en pantalla de detalle · ventana visible de cancelación
        </span>
      </div>
    </form>
  )
}
