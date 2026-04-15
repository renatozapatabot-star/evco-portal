'use client'

import { useState } from 'react'
import { Download, FileText, Table2, DollarSign, Package } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { getCookieValue } from '@/lib/client-config'
import { DateInputES } from '@/components/ui/DateInputES'

const EXPORTS = [
  { key: 'traficos', label: 'Embarques', desc: 'Lista completa de embarques con estatus, pedimento y valor', icon: Table2 },
  { key: 'pedimentos', label: 'Pedimentos', desc: 'Facturas aduanales con DTA, IGI, IVA y valor', icon: FileText },
  { key: 'entradas', label: 'Entradas', desc: 'Entradas de almacén con bultos, peso y faltantes', icon: Package },
  { key: 'financiero', label: 'Financiero', desc: 'Resumen de pagos y contribuciones', icon: DollarSign },
] as const

export default function ExportarPage() {
  const isMobile = useIsMobile()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function doExport(type: string) {
    setDownloading(type)
    setError('')
    try {
      const csrfToken = getCookieValue('csrf_token') || ''
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ type, date_from: dateFrom || undefined, date_to: dateTo || undefined }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al exportar')
      }

      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition')
      const filename = cd?.match(/filename="(.+)"/)?.[1] || `${type}_export.csv`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    }
    setDownloading(null)
  }

  return (
    <div style={{ padding: '24px 16px', maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 'var(--aguila-fs-title)', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>Exportar Datos</h1>
      <p style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-secondary)', margin: '0 0 24px' }}>
        Descarga tus datos en formato CSV · Patente 3596
      </p>

      {/* Date range filter */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 24 }}>
        <div style={{ fontSize: 'var(--aguila-fs-meta)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 12 }}>
          Rango de fechas (opcional)
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <DateInputES value={dateFrom} onChange={v => setDateFrom(v)} style={{ height: 36, padding: '0 12px', fontSize: 'var(--aguila-fs-body)' }} />
          <span style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--text-muted)' }}>a</span>
          <DateInputES value={dateTo} onChange={v => setDateTo(v)} style={{ height: 36, padding: '0 12px', fontSize: 'var(--aguila-fs-body)' }} />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo('') }} style={{
              fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer',
            }}>Limpiar</button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: '10px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid #FECACA', borderRadius: 8, color: 'var(--danger-text, #991B1B)', fontSize: 'var(--aguila-fs-body)' }}>
          {error}
        </div>
      )}

      {/* Export cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {EXPORTS.map(exp => {
          const Icon = exp.icon
          const isDownloading = downloading === exp.key
          return (
            <div key={exp.key} className="card" style={{
              padding: isMobile ? '16px' : '20px 24px', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 16,
              flexDirection: isMobile ? 'column' : 'row',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 8,
                  background: 'rgba(196,150,60,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon size={20} style={{ color: 'var(--gold)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{exp.label}</div>
                  <div style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--text-secondary)', marginTop: 2 }}>{exp.desc}</div>
                </div>
              </div>
              <button
                onClick={() => doExport(exp.key)}
                disabled={isDownloading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 20px', borderRadius: 8, fontSize: 'var(--aguila-fs-body)', fontWeight: 700,
                  background: isDownloading ? 'var(--border)' : 'var(--gold)', border: 'none',
                  color: isDownloading ? 'var(--text-muted)' : 'var(--bg-card)', cursor: isDownloading ? 'default' : 'pointer',
                  minHeight: 44, flexShrink: 0,
                }}
              >
                <Download size={14} /> {isDownloading ? 'Descargando...' : 'CSV'}
              </button>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 24, textAlign: 'center', fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-muted)' }}>
        Los datos exportados están limitados a su empresa · Patente 3596 · Aduana 240
      </div>
    </div>
  )
}
