'use client'

import { useEffect, useState } from 'react'
import { Calendar, FileText, Phone } from 'lucide-react'
import { COMPANY_ID } from '@/lib/client-config'

export default function CumplimientoPage() {
  const [deadlineCount, setDeadlineCount] = useState(0)
  const [pendingDocsCount, setPendingDocsCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/data?table=traficos&limit=500&order_by=fecha_llegada&order_dir=desc`)
      .then(r => r.json())
      .then(res => {
        const traficos = res.data || []
        const now = new Date()
        const oneWeekMs = 7 * 86400000

        // Count traficos with upcoming activity this week (not completed/cancelled)
        const activeThisWeek = traficos.filter((t: Record<string, string>) => {
          if (t.estatus === 'Despachado' || t.estatus === 'Cancelado') return false
          if (!t.fecha_llegada) return false
          const diff = new Date(t.fecha_llegada).getTime() - now.getTime()
          return diff >= 0 && diff < oneWeekMs
        })
        setDeadlineCount(activeThisWeek.length)

        // Count traficos missing key documents (no expediente or pending status)
        const pendingDocs = traficos.filter((t: Record<string, string>) => {
          if (t.estatus === 'Despachado' || t.estatus === 'Cancelado') return false
          return !t.expediente_id || t.estatus === 'En proceso'
        })
        setPendingDocsCount(pendingDocs.length)
      })
      .catch(() => {
        setDeadlineCount(0)
        setPendingDocsCount(0)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: 32, background: '#FAFAF8', minHeight: '100vh' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: '#1A1A1A', marginBottom: 4 }}>
          Cumplimiento
        </h1>
        <p style={{ fontSize: 14, color: '#6B6B6B' }}>
          Resumen de obligaciones y documentos pendientes
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 64, color: '#9B9B9B' }}>Cargando...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {/* Card 1: Upcoming deadlines this week */}
          <div style={{
            background: '#FFFFFF', border: '1px solid #E8E5E0', borderRadius: 8,
            padding: 24, borderTop: '4px solid #C9A84C',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Calendar size={20} style={{ color: '#8B6914' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#8B6914', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Vencimientos esta semana
              </span>
            </div>
            <div className="mono" style={{ fontSize: 40, fontWeight: 700, color: '#1A1A1A', lineHeight: 1 }}>
              {deadlineCount}
            </div>
            <p style={{ fontSize: 13, color: '#6B6B6B', marginTop: 8 }}>
              {deadlineCount === 0
                ? 'Sin vencimientos programados esta semana.'
                : `${deadlineCount} vencimiento${deadlineCount > 1 ? 's' : ''} próximo${deadlineCount > 1 ? 's' : ''} esta semana.`}
            </p>
          </div>

          {/* Card 2: Pending documents */}
          <div style={{
            background: '#FFFFFF', border: '1px solid #E8E5E0', borderRadius: 8,
            padding: 24, borderTop: '4px solid #C9A84C',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <FileText size={20} style={{ color: '#8B6914' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#8B6914', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Documentos pendientes
              </span>
            </div>
            <div className="mono" style={{ fontSize: 40, fontWeight: 700, color: '#1A1A1A', lineHeight: 1 }}>
              {pendingDocsCount}
            </div>
            <p style={{ fontSize: 13, color: '#6B6B6B', marginTop: 8 }}>
              {pendingDocsCount === 0
                ? 'Todos los documentos al corriente.'
                : `${pendingDocsCount} operación${pendingDocsCount > 1 ? 'es' : ''} con documentación pendiente.`}
            </p>
          </div>

          {/* Card 3: Contact agent */}
          <div style={{
            background: '#FFFFFF', border: '1px solid #E8E5E0', borderRadius: 8,
            padding: 24, borderTop: '4px solid #C9A84C',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Phone size={20} style={{ color: '#8B6914' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#8B6914', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Acción requerida
              </span>
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.5 }}>
              Contacte a su agente aduanal
            </p>
            <p style={{ fontSize: 13, color: '#6B6B6B', marginTop: 8 }}>
              Para cualquier duda sobre sus obligaciones de cumplimiento, comuníquese directamente con su agente.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
