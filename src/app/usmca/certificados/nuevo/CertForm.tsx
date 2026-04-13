'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GlassCard, SectionHeader } from '@/components/aguila'
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
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
} as const

const monoInputStyle = {
  ...inputStyle,
  fontFamily: 'var(--font-jetbrains-mono), monospace',
} as const

const labelStyle = {
  display: 'block',
  fontSize: 10,
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
            <div>
              <label htmlFor="hs_code" style={labelStyle}>HS Code (6+ dígitos) *</label>
              <input id="hs_code" name="hs_code" required placeholder="3901.20 ó 3901.20.01" style={monoInputStyle} />
            </div>
            <div>
              <label htmlFor="country_of_origin" style={labelStyle}>País origen</label>
              <input id="country_of_origin" name="country_of_origin" defaultValue="US" maxLength={3} style={monoInputStyle} />
            </div>
            <div>
              <label htmlFor="origin_criterion" style={labelStyle}>Criterio origen *</label>
              <select id="origin_criterion" name="origin_criterion" defaultValue="B" style={inputStyle}>
                {(['A','B','C','D'] as const).map(k => (
                  <option key={k} value={k}>{k} — {ORIGIN_CRITERION_LABELS[k].split('·')[1]?.trim() ?? k}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rvc_method" style={labelStyle}>Método RVC (si aplica)</label>
              <input id="rvc_method" name="rvc_method" placeholder="Transaction Value · Net Cost" style={inputStyle} />
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Certificador" />
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <div>
              <label htmlFor="certifier_role" style={labelStyle}>Rol *</label>
              <select id="certifier_role" name="certifier_role" defaultValue="exporter" style={inputStyle}>
                <option value="exporter">Exportador</option>
                <option value="producer">Productor</option>
                <option value="importer">Importador</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label htmlFor="certifier_name" style={labelStyle}>Nombre *</label>
              <input id="certifier_name" name="certifier_name" required minLength={2} maxLength={200} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div>
              <label htmlFor="certifier_title" style={labelStyle}>Cargo</label>
              <input id="certifier_title" name="certifier_title" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="certifier_email" style={labelStyle}>Correo</label>
              <input id="certifier_email" name="certifier_email" type="email" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="certifier_phone" style={labelStyle}>Teléfono</label>
              <input id="certifier_phone" name="certifier_phone" style={inputStyle} />
            </div>
          </div>
          <div>
            <label htmlFor="certifier_address" style={labelStyle}>Domicilio</label>
            <input id="certifier_address" name="certifier_address" style={inputStyle} />
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Partes" />
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            <div>
              <label htmlFor="exporter_name" style={labelStyle}>Exportador</label>
              <input id="exporter_name" name="exporter_name" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="exporter_address" style={labelStyle}>Domicilio exportador</label>
              <input id="exporter_address" name="exporter_address" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="producer_name" style={labelStyle}>Productor</label>
              <input id="producer_name" name="producer_name" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="producer_address" style={labelStyle}>Domicilio productor</label>
              <input id="producer_address" name="producer_address" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="importer_name" style={labelStyle}>Importador</label>
              <input id="importer_name" name="importer_name" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="importer_address" style={labelStyle}>Domicilio importador</label>
              <input id="importer_address" name="importer_address" style={inputStyle} />
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Vigencia y vínculos" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <div>
            <label htmlFor="blanket_from" style={labelStyle}>Blanket desde</label>
            <input id="blanket_from" name="blanket_from" type="date" style={monoInputStyle} />
          </div>
          <div>
            <label htmlFor="blanket_to" style={labelStyle}>Blanket hasta (máx 12 meses)</label>
            <input id="blanket_to" name="blanket_to" type="date" style={monoInputStyle} />
          </div>
          <div>
            <label htmlFor="trafico_id" style={labelStyle}>Embarque vinculado</label>
            <input id="trafico_id" name="trafico_id" style={monoInputStyle} />
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <label htmlFor="notes" style={labelStyle}>Notas internas</label>
          <textarea id="notes" name="notes" rows={2} maxLength={1000} style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }} />
        </div>
      </GlassCard>

      {err && (
        <GlassCard>
          <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{err}</p>
        </GlassCard>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          type="submit"
          disabled={loading}
          style={{
            minHeight: 60, padding: '0 28px',
            background: SILVER_GRADIENT, color: '#0A0A0C',
            border: 'none', borderRadius: 10,
            fontSize: 14, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 0.5,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Guardando borrador…' : 'Crear borrador'}
        </button>
        <span style={{ fontSize: 11, color: TEXT_MUTED }}>
          Firma final en pantalla de detalle · ventana visible de cancelación
        </span>
      </div>
    </form>
  )
}
