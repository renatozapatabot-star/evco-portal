'use client'

import { useEffect, useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { AlertTriangle, CheckCircle, Clock, Shield, Plus } from 'lucide-react'
import Link from 'next/link'
import { getCookieValue } from '@/lib/client-config'
import { fmtDate as fmtDateLib } from '@/lib/format-utils'

interface LegalDoc {
  id: string
  document_type: string
  client_name: string
  company_id: string
  issued_date: string | null
  expiry_date: string | null
  status: 'valid' | 'expiring_90' | 'expiring_30' | 'expired' | 'verify'
  notes: string | null
  responsible: string | null
}

const DOC_TYPES = [
  { key: 'poder_notarial', label: 'Poder Notarial', description: 'Poder para despacho aduanal' },
  { key: 'encargo_conferido', label: 'Encargo Conferido', description: 'Autorización ante VUCEM para AA' },
  { key: 'padron_importadores', label: 'Padrón de Importadores', description: 'Registro SAT importador' },
  { key: 'efirma', label: 'e.firma SAT', description: 'Firma electrónica avanzada' },
  { key: 'immex', label: 'Programa IMMEX', description: 'Autorización maquila temporal' },
  { key: 'rfc', label: 'Constancia RFC', description: 'Registro Federal de Contribuyentes' },
  { key: 'opinion_cumplimiento', label: 'Opinión de Cumplimiento', description: 'SAT Art. 32-D CFF' },
  { key: 'carta_porte', label: 'Permiso Carta Porte', description: 'Complemento CFDI transporte' },
]

function daysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null
  return Math.floor((new Date(expiryDate).getTime() - Date.now()) / 86400000)
}

function getStatus(expiryDate: string | null): LegalDoc['status'] {
  if (!expiryDate) return 'verify'
  const days = daysUntilExpiry(expiryDate)
  if (days === null) return 'verify'
  if (days < 0) return 'expired'
  if (days <= 30) return 'expiring_30'
  if (days <= 90) return 'expiring_90'
  return 'valid'
}

function StatusBadge({ status, days }: { status: LegalDoc['status']; days: number | null }) {
  const config = {
    valid: { label: 'Vigente', color: 'var(--success)', bg: 'rgba(34,197,94,0.08)' },
    expiring_90: { label: `${days}d restantes`, color: 'var(--warning)', bg: 'rgba(234,179,8,0.08)' },
    expiring_30: { label: `${days}d — URGENTE`, color: 'var(--danger)', bg: 'rgba(239,68,68,0.08)' },
    expired: { label: 'EXPIRADO', color: 'var(--danger)', bg: 'rgba(239,68,68,0.12)' },
    verify: { label: 'Verificar', color: 'var(--n-400)', bg: 'var(--n-50)' },
  }
  const c = config[status]
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
      color: c.color, background: c.bg, textTransform: 'uppercase',
    }}>
      {c.label}
    </span>
  )
}

// ── Hardcoded initial data (will be dynamic from DB) ──
function getInitialDocs(): LegalDoc[] {
  const clientName = getCookieValue('company_name') || 'Su Empresa'
  const companyId = getCookieValue('company_id') ?? ''
  const contactName = getCookieValue('user_name') ?? 'Contacto'
  return [
  { id: '1', document_type: 'poder_notarial', client_name: clientName, company_id: companyId, issued_date: '2024-01-15', expiry_date: '2027-01-15', status: 'valid', notes: 'Poder amplio para despacho', responsible: contactName },
  { id: '2', document_type: 'encargo_conferido', client_name: clientName, company_id: companyId, issued_date: '2025-06-01', expiry_date: '2026-06-01', status: 'expiring_90', notes: 'Renovar antes de jun 2026', responsible: contactName },
  { id: '3', document_type: 'padron_importadores', client_name: clientName, company_id: companyId, issued_date: null, expiry_date: null, status: 'verify', notes: 'Verificar vigencia en SAT', responsible: contactName },
  { id: '4', document_type: 'efirma', client_name: clientName, company_id: companyId, issued_date: '2023-03-10', expiry_date: '2027-03-10', status: 'valid', notes: null, responsible: contactName },
  { id: '5', document_type: 'immex', client_name: clientName, company_id: companyId, issued_date: '2024-08-01', expiry_date: '2027-08-01', status: 'valid', notes: 'Programa activo', responsible: contactName },
  ]
}

export default function DocumentosLegalesPage() {
  const isMobile = useIsMobile()
  const [docs, setDocs] = useState<LegalDoc[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Try to load from API, fallback to initial data
    fetch('/api/data?table=legal_documents&limit=100&order_by=expiry_date&order_dir=asc')
      .then(r => r.json())
      .then(res => {
        if (res.data?.length > 0) {
          setDocs(res.data.map((d: { expiry_date?: string | null; [key: string]: unknown }) => ({
            ...d,
            status: getStatus(d.expiry_date ?? null),
          })))
        } else {
          // Use initial hardcoded data
          setDocs(getInitialDocs().map(d => ({
            ...d,
            status: getStatus(d.expiry_date),
          })))
        }
      })
      .catch(() => {
        setDocs(getInitialDocs().map(d => ({
          ...d,
          status: getStatus(d.expiry_date),
        })))
      })
      .finally(() => setLoading(false))
  }, [])

  const expired = docs.filter(d => d.status === 'expired')
  const expiringSoon = docs.filter(d => d.status === 'expiring_30' || d.status === 'expiring_90')
  const valid = docs.filter(d => d.status === 'valid')
  const needVerify = docs.filter(d => d.status === 'verify')

  const fmtDate = (s: string | null) => fmtDateLib(s)

  const getDocLabel = (key: string) => DOC_TYPES.find(d => d.key === key)?.label || key

  return (
    <div className="page-enter" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Documentos Legales</h1>
          <p style={{ fontSize: 13, color: 'var(--n-400)', margin: '4px 0 0' }}>
            Poderes notariales, encargos conferidos, e.firma y más
          </p>
        </div>
      </div>

      {/* Alert summary */}
      {(expired.length > 0 || expiringSoon.length > 0) && (
        <div style={{
          background: expired.length > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(234,179,8,0.06)',
          border: `1px solid ${expired.length > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(234,179,8,0.2)'}`,
          borderRadius: 12, padding: '16px 20px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <AlertTriangle size={16} style={{ color: expired.length > 0 ? 'var(--danger)' : 'var(--warning)' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: expired.length > 0 ? 'var(--danger)' : 'var(--warning)' }}>
              {expired.length > 0
                ? `${expired.length} documento(s) expirado(s) — acción inmediata requerida`
                : `${expiringSoon.length} documento(s) próximo(s) a vencer`}
            </span>
          </div>
          {expired.map(d => (
            <div key={d.id} style={{ fontSize: 12, color: 'var(--danger)', marginLeft: 24, marginTop: 4 }}>
              {d.client_name} — {getDocLabel(d.document_type)} — Expirado <span style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtDate(d.expiry_date)}</span>
            </div>
          ))}
          {expiringSoon.map(d => (
            <div key={d.id} style={{ fontSize: 12, color: 'var(--warning)', marginLeft: 24, marginTop: 4 }}>
              {d.client_name} — {getDocLabel(d.document_type)} — Vence <span style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtDate(d.expiry_date)}</span> (<span style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{daysUntilExpiry(d.expiry_date)}d</span>)
            </div>
          ))}
        </div>
      )}

      {/* Documents table */}
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Documento</th>
                <th>Cliente</th>
                <th>Emitido</th>
                <th>Vence</th>
                <th>Estado</th>
                <th>Responsable</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td><div className="skel" style={{ width: 120, height: 14 }} /></td>
                  <td><div className="skel" style={{ width: 100, height: 14 }} /></td>
                  <td><div className="skel" style={{ width: 80, height: 14 }} /></td>
                  <td><div className="skel" style={{ width: 80, height: 14 }} /></td>
                  <td><div className="skel" style={{ width: 80, height: 14 }} /></td>
                  <td><div className="skel" style={{ width: 60, height: 14 }} /></td>
                  <td><div className="skel" style={{ width: 60, height: 14 }} /></td>
                </tr>
              ))}
              {!loading && docs.map(doc => {
                const days = daysUntilExpiry(doc.expiry_date)
                return (
                  <tr key={doc.id} style={{
                    background: doc.status === 'expired' ? 'rgba(239,68,68,0.04)' :
                                doc.status === 'expiring_30' ? 'rgba(239,68,68,0.02)' : undefined,
                  }}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{getDocLabel(doc.document_type)}</div>
                      {doc.notes && <div style={{ fontSize: 11, color: 'var(--n-400)', marginTop: 2 }}>{doc.notes}</div>}
                    </td>
                    <td style={{ fontSize: 13 }}>{doc.client_name}</td>
                    <td style={{ fontSize: 13, color: 'var(--n-500)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtDate(doc.issued_date)}</td>
                    <td style={{ fontSize: 13, fontWeight: doc.status !== 'valid' ? 600 : 400, fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtDate(doc.expiry_date)}</td>
                    <td><StatusBadge status={doc.status} days={days} /></td>
                    <td style={{ fontSize: 13, color: 'var(--n-500)' }}>{doc.responsible || '—'}</td>
                    <td>
                      {doc.status === 'expired' && (
                        <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600, cursor: 'pointer' }}>Renovar</span>
                      )}
                      {(doc.status === 'expiring_30' || doc.status === 'expiring_90') && (
                        <span style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 600, cursor: 'pointer' }}>Programar</span>
                      )}
                      {doc.status === 'verify' && (
                        <span style={{ fontSize: 12, color: 'var(--gold-600)', fontWeight: 600, cursor: 'pointer' }}>Verificar</span>
                      )}
                      {doc.status === 'valid' && (
                        <span style={{ fontSize: 12, color: 'var(--n-300)' }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alert schedule info */}
      <div style={{ marginTop: 20, padding: '16px 20px', background: 'var(--n-50)', borderRadius: 12, border: '1px solid var(--border-light)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
          <Shield size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Alertas Automáticas
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, fontSize: 12, color: 'var(--n-500)' }}>
          <div><Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> 90 días: Advertencia</div>
          <div><Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> 60 días: Recordatorio</div>
          <div><AlertTriangle size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> 30 días: Crítico</div>
          <div><AlertTriangle size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> 7 días: Escalación</div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--n-400)', marginTop: 8 }}>
          Las alertas se envían por portal, email y Telegram al equipo de operaciones.
        </div>
      </div>
    </div>
  )
}
