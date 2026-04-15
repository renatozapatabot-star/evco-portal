'use client'

import { useEffect, useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { FileText, Clock, Users2, Zap } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { EmptyState } from '@/components/ui/EmptyState'

interface DocTemplate {
  id: string
  doc_type: string
  supplier_key: string
  product_key: string
  typical_turnaround_hours: number | null
  times_used: number
  clients_served: number
}

interface TemplateData {
  templates: DocTemplate[]
  summary: {
    total_templates: number
    unique_suppliers: number
    avg_turnaround_hours: number | null
    by_type: Record<string, number>
    total_uses: number
  }
}

const DOC_LABELS: Record<string, string> = {
  FACTURA_COMERCIAL: 'Factura Comercial',
  COVE: 'COVE',
  LISTA_EMPAQUE: 'Lista de Empaque',
  CERTIFICADO_ORIGEN: 'Certificado de Origen',
  CONOCIMIENTO_EMBARQUE: 'Conocimiento de Embarque',
  CARTA_PORTE: 'Carta Porte',
  PEDIMENTO: 'Pedimento',
  NOM: 'NOM',
  COA: 'CoA',
  ORDEN_COMPRA: 'Orden de Compra',
  DODA_PREVIO: 'DODA Previo',
  PERMISO: 'Permiso',
}

export default function PlantillasDocPage() {
  const isMobile = useIsMobile()
  const [data, setData] = useState<TemplateData | null>(null)
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const role = getCookieValue('user_role')
  const isAdmin = role === 'admin' || role === 'broker'

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    fetch('/api/doc-templates')
      .then(r => r.json())
      .then(d => setData(d.data || null))
      .catch((err) => console.error('[plantillas-doc] fetch failed:', err.message))
      .finally(() => setLoading(false))
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className="page-shell" style={{ textAlign: 'center', padding: 60 }}>
        <FileText size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
        <div style={{ fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>Acceso restringido</div>
      </div>
    )
  }

  const filtered = data?.templates.filter(t =>
    typeFilter === 'all' ? true : t.doc_type === typeFilter
  ) || []

  const docTypes = data ? Object.keys(data.summary.by_type).sort() : []

  return (
    <div className="page-shell" style={{ padding: isMobile ? '16px' : undefined }}>
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, fontSize: isMobile ? 20 : undefined }}>
        <FileText size={24} style={{ color: 'var(--gold)' }} />
        Red de Documentos
      </h1>
      <p style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-muted)', marginBottom: 24 }}>
        Plantillas aprendidas de operaciones completadas — cada documento enseña a la red
      </p>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 60, borderRadius: 8 }} />)}
        </div>
      ) : !data || data.templates.length === 0 ? (
        <EmptyState icon="📄" title="Sin plantillas" description="Las plantillas se generan semanalmente desde solicitudes de documentos completadas." />
      ) : (
        <>
          {/* KPIs */}
          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
            gap: 12, marginBottom: 24,
          }}>
            <KPI icon={<FileText size={16} />} label="Plantillas" value={data.summary.total_templates} />
            <KPI icon={<Users2 size={16} />} label="Proveedores" value={data.summary.unique_suppliers} />
            <KPI icon={<Zap size={16} />} label="Usos totales" value={data.summary.total_uses} />
            <KPI icon={<Clock size={16} />} label="Turnaround prom." value={data.summary.avg_turnaround_hours ? `${data.summary.avg_turnaround_hours}h` : '—'} />
          </div>

          {/* Type filter */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            <FilterPill active={typeFilter === 'all'} onClick={() => setTypeFilter('all')} label={`Todos (${data.templates.length})`} />
            {docTypes.map(dt => (
              <FilterPill
                key={dt}
                active={typeFilter === dt}
                onClick={() => setTypeFilter(dt)}
                label={`${DOC_LABELS[dt] || dt} (${data.summary.by_type[dt]})`}
              />
            ))}
          </div>

          {/* Template list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(t => (
              <div key={t.id} style={{
                padding: '12px 16px', borderRadius: 8,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderLeft: `3px solid var(--gold)`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 'var(--aguila-fs-label)', padding: '1px 6px', borderRadius: 4, background: 'var(--gold)', color: '#FFF', fontWeight: 600 }}>
                        {DOC_LABELS[t.doc_type] || t.doc_type}
                      </span>
                      <span style={{ fontSize: 'var(--aguila-fs-compact)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {t.supplier_key.replace(/_/g, ' ')}
                      </span>
                      {t.product_key !== '_general' && (
                        <span style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-muted)' }}>
                          · {t.product_key.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 'var(--aguila-fs-meta)', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    <span>{t.times_used} usos</span>
                    <span>{t.clients_served} cliente{t.clients_served !== 1 ? 's' : ''}</span>
                    {t.typical_turnaround_hours && <span>~{t.typical_turnaround_hours}h</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function KPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ color: 'var(--gold)' }}>{icon}</span>
        <span style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 'var(--aguila-fs-headline)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}

function FilterPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 12px', borderRadius: 16, fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, cursor: 'pointer', minHeight: 32,
      border: `1px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
      background: active ? 'var(--gold)' : 'var(--bg-card)',
      color: active ? '#FFF' : 'var(--text-secondary)',
    }}>
      {label}
    </button>
  )
}
