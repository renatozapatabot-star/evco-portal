'use client'

import { useEffect, useState, useMemo } from 'react'
import { FileText, Plus, X, ExternalLink } from 'lucide-react'
import { getCookieValue, getCompanyIdCookie } from '@/lib/client-config'
import { DateInputES } from '@/components/ui/DateInputES'
import { REQUIRED_DOC_TYPES } from '@/lib/documents'
import { fmtDate } from '@/lib/format-utils'

const T = {
  bg: '#0D0D0C',
  card: '#1A1814',
  border: '#302C23',
  gold: 'var(--gold)',
  goldSubtle: 'rgba(184,149,63,0.12)',
  text: '#F5F0E8',
  textSec: '#A09882',
  textMuted: '#6B6560',
  green: '#2D8540',
  greenBg: 'rgba(45,133,64,0.12)',
  amber: '#C47F17',
  amberBg: 'rgba(196,127,23,0.12)',
  red: '#C23B22',
  redBg: 'rgba(194,59,34,0.12)',
  r: 8,
} as const

interface Template {
  id: string
  company_id: string
  document_type: string
  document_name: string
  file_url: string | null
  is_permanent: boolean
  expiry_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

function getStatus(t: Template): { label: string; color: string; bg: string } {
  if (t.is_permanent && !t.expiry_date) return { label: 'Permanente', color: T.green, bg: T.greenBg }
  if (!t.expiry_date) return { label: 'Activo', color: T.green, bg: T.greenBg }
  const days = Math.floor((new Date(t.expiry_date).getTime() - Date.now()) / 86400000)
  if (days < 0) return { label: 'Expirado', color: T.red, bg: T.redBg }
  if (days < 30) return { label: `Vence en ${days}d`, color: T.amber, bg: T.amberBg }
  return { label: 'Vigente', color: T.green, bg: T.greenBg }
}

export default function PlantillasPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [companyFilter, setCompanyFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const role = getCookieValue('user_role')
  const isInternal = role === 'broker' || role === 'admin'

  // Form state
  const [formCompanyId, setFormCompanyId] = useState('')
  const [formDocType, setFormDocType] = useState('')
  const [formDocName, setFormDocName] = useState('')
  const [formFileUrl, setFormFileUrl] = useState('')
  const [formExpiry, setFormExpiry] = useState('')

  useEffect(() => {
    const companyId = getCompanyIdCookie()
    const url = isInternal
      ? '/api/client-templates'
      : `/api/client-templates?company_id=${companyId}`
    fetch(url)
      .then(r => r.json())
      .then(d => setTemplates(d.data ?? []))
      .catch((err: unknown) => console.error('[plantillas] fetch failed:', (err as Error).message))
      .finally(() => setLoading(false))
  }, [isInternal])

  const companies = useMemo(() => {
    const set = new Set<string>()
    for (const t of templates) set.add(t.company_id)
    return [...set].sort()
  }, [templates])

  const filtered = useMemo(() => {
    if (!companyFilter) return templates
    return templates.filter(t => t.company_id === companyFilter)
  }, [templates, companyFilter])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/client-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: formCompanyId,
        document_type: formDocType,
        document_name: formDocName,
        file_url: formFileUrl || null,
        expiry_date: formExpiry || null,
        is_permanent: !formExpiry,
      }),
    })
    const d = await res.json()
    if (d.data) {
      setTemplates(prev => {
        const idx = prev.findIndex(t => t.company_id === d.data.company_id && t.document_type === d.data.document_type)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = d.data
          return next
        }
        return [...prev, d.data]
      })
      setShowModal(false)
      setFormCompanyId('')
      setFormDocType('')
      setFormDocName('')
      setFormFileUrl('')
      setFormExpiry('')
    }
    setSaving(false)
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', fontSize: 14,
    background: T.card, border: `1px solid ${T.border}`,
    borderRadius: T.r, color: T.text,
    fontFamily: 'var(--font-sans)',
    outline: 'none',
  }

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: 0 }}>
            Plantillas de Documentos
          </h1>
          <p style={{ fontSize: 14, color: T.textSec, margin: '4px 0 0' }}>
            Documentos permanentes registrados por cliente
          </p>
        </div>
        {isInternal && (
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', borderRadius: T.r,
              background: T.gold, color: '#1A1A18',
              fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
            }}
          >
            <Plus size={16} /> Agregar plantilla
          </button>
        )}
      </div>

      {/* Filter bar (broker only) */}
      {isInternal && companies.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <select
            value={companyFilter}
            onChange={e => setCompanyFilter(e.target.value)}
            style={{
              ...inputStyle, width: 'auto', minWidth: 200,
            }}
          >
            <option value="">Todos los clientes</option>
            {companies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {/* Table */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`,
        borderRadius: T.r, overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: T.textMuted }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <FileText size={28} style={{ color: T.textMuted, margin: '0 auto 12px', display: 'block' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: T.textSec }}>Sin plantillas registradas</div>
            <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>
              {isInternal ? 'Agrega documentos permanentes que aplican a cada cliente' : 'Tu agente aduanal registrará tus documentos permanentes aquí'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {[...(isInternal ? ['Cliente'] : []), 'Tipo', 'Nombre', 'Estado', 'Vencimiento', 'Archivo'].map(h => (
                    <th key={h} style={{
                      padding: '12px 16px', textAlign: 'left',
                      fontSize: 12, fontWeight: 700, color: T.textSec,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const status = getStatus(t)
                  return (
                    <tr key={t.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                      {isInternal && (
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: T.textSec, background: 'rgba(255,255,255,0.06)', borderRadius: 4, padding: '2px 8px' }}>
                            {t.company_id}
                          </span>
                        </td>
                      )}
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: T.gold }}>
                        {t.document_type}
                      </td>
                      <td style={{ padding: '12px 16px', color: T.text }}>
                        {t.document_name}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: status.color, background: status.bg, borderRadius: 4, padding: '2px 8px' }}>
                          {status.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: T.textSec, fontSize: 13 }}>
                        {t.expiry_date ? fmtDate(t.expiry_date) : '\u2014'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {t.file_url ? (
                          <a href={t.file_url} target="_blank" rel="noopener noreferrer" style={{ color: T.gold, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <ExternalLink size={14} /> Ver
                          </a>
                        ) : (
                          <span style={{ color: T.textMuted }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }} onClick={() => setShowModal(false)}>
          <div
            style={{
              background: '#14120F', border: `1px solid ${T.border}`,
              borderRadius: 12, padding: 32, maxWidth: 480, width: '100%',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: T.text, margin: 0 }}>Agregar Plantilla</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSec, display: 'block', marginBottom: 6 }}>Cliente (company_id)</label>
                <input
                  value={formCompanyId}
                  onChange={e => setFormCompanyId(e.target.value)}
                  placeholder={getCookieValue('company_id') || 'empresa'}
                  required
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSec, display: 'block', marginBottom: 6 }}>Tipo de documento</label>
                <select
                  value={formDocType}
                  onChange={e => setFormDocType(e.target.value)}
                  required
                  style={inputStyle}
                >
                  <option value="">Seleccionar...</option>
                  {REQUIRED_DOC_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
                  <option value="QR DODA">QR DODA</option>
                  <option value="CFDI">CFDI</option>
                  <option value="CARTA PORTE">CARTA PORTE</option>
                  <option value="CERTIFICADO USMCA">CERTIFICADO USMCA</option>
                  <option value="CONSTANCIA IMMEX">CONSTANCIA IMMEX</option>
                  <option value="PADRON DE IMPORTADORES">PADRON DE IMPORTADORES</option>
                  <option value="ENCARGO CONFERIDO">ENCARGO CONFERIDO</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSec, display: 'block', marginBottom: 6 }}>Nombre del documento</label>
                <input
                  value={formDocName}
                  onChange={e => setFormDocName(e.target.value)}
                  placeholder={`Encargo conferido ${getCookieValue('company_name') || 'empresa'} 2026`}
                  required
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSec, display: 'block', marginBottom: 6 }}>URL del archivo (opcional)</label>
                <input
                  value={formFileUrl}
                  onChange={e => setFormFileUrl(e.target.value)}
                  placeholder="https://..."
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSec, display: 'block', marginBottom: 6 }}>Fecha de vencimiento (dejar vacío = permanente)</label>
                <DateInputES
                  value={formExpiry}
                  onChange={v => setFormExpiry(v)}
                  style={{ height: 40, padding: '0 12px', fontSize: 14, width: '100%', borderRadius: 8 }}
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '12px 24px', borderRadius: T.r,
                  background: T.gold, color: '#1A1A18',
                  fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
                  opacity: saving ? 0.6 : 1,
                  marginTop: 8,
                }}
              >
                {saving ? 'Guardando...' : 'Guardar plantilla'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
