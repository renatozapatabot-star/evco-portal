'use client'

import { useEffect, useState, useMemo } from 'react'
import DataTable, { Column } from '@/components/DataTable'
import EmptyState from '@/components/EmptyState'
import { Landmark } from 'lucide-react'
import { COMPANY_ID } from '@/lib/client-config'

const BRIDGES = [
  { name: 'Puente Internacional I', sub: 'Gateway to Americas', type: 'Pasajero', status: 'green', wait: '-' },
  { name: 'Puente Internacional II', sub: 'World Trade Bridge', type: 'Comercial', status: 'green', wait: '-' },
  { name: 'Puente Colombia', sub: 'Solidaridad', type: 'Comercial', status: 'green', wait: '-' },
  { name: 'Puente Juarez-Lincoln', sub: 'Puente Nuevo', type: 'Mixto', status: 'yellow', wait: '-' },
]

function StatusBadge({ value }: { value: string }) {
  const v = (value || '').toUpperCase()
  const isGreen = v.includes('DESADUAN')
  const isBlue = v.includes('CUMPLIDO')
  const bg = isGreen ? 'rgba(34,197,94,0.15)' : isBlue ? 'rgba(59,130,246,0.15)' : 'rgba(234,179,8,0.15)'
  const color = isGreen ? 'var(--status-green)' : isBlue ? 'var(--status-blue)' : 'var(--status-yellow)'
  return <span style={{ background: bg, color, fontSize: 12, fontWeight: 600, padding: '4px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{v || '-'}</span>
}

export function SoiaView() {
  const [cruces, setCruces] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [bridgeRec, setBridgeRec] = useState<{ name: string; avg: number } | null>(null)

  useEffect(() => {
    fetch('/api/data?table=soia_cruces&limit=200&order_by=created_at&order_dir=desc')
      .then(r => r.json()).then(d => setCruces(d.data || []))
      .catch((err: unknown) => { console.error("[CRUZ]", (err as Error)?.message || err) }).finally(() => setLoading(false))
    // Bridge intelligence
    fetch(`/api/data?table=bridge_intelligence&company_id=${COMPANY_ID}&limit=500`)
      .then(r => r.json()).then(d => {
        const today = new Date().getDay()
        const records = (d.data || []).filter((b: any) => b.day_of_week === today)
        const avgByBridge: Record<string, number[]> = {}
        records.forEach((b: any) => {
          const name = b.bridge_id || b.bridge_name || 'unknown'
          if (!avgByBridge[name]) avgByBridge[name] = []
          avgByBridge[name].push(b.crossing_hours)
        })
        const bridges = Object.entries(avgByBridge).map(([name, hours]) => ({
          name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          avg: hours.reduce((a, b) => a + b, 0) / hours.length,
        })).sort((a, b) => a.avg - b.avg)
        if (bridges[0]) setBridgeRec(bridges[0])
      }).catch((err: unknown) => { console.error("[CRUZ]", (err as Error)?.message || err) })
  }, [])

  // Derive summary stats
  const desaduanado = cruces.filter(c => {
    const cols = Object.values(c).map(v => String(v || '').toUpperCase())
    return cols.some(v => v.includes('DESADUAN'))
  }).length
  const cumplido = cruces.filter(c => {
    const cols = Object.values(c).map(v => String(v || '').toUpperCase())
    return cols.some(v => v.includes('CUMPLIDO'))
  }).length

  // Build columns dynamically from data
  const tableColumns: Column[] = useMemo(() => {
    if (cruces.length === 0) return []
    const keys = Object.keys(cruces[0]).filter(k => k !== 'id' && k !== 'tenant_id' && k !== 'created_at')
    return keys.slice(0, 8).map(key => {
      const isStatus = key.includes('status') || key.includes('estado') || key.includes('semaforo')
      return {
        key,
        label: key.replace(/_/g, ' '),
        render: isStatus ? (row: any) => <StatusBadge value={row[key]} /> : undefined,
        mono: key.includes('trafico') || key.includes('pedimento') || key.includes('num') || key.includes('secuencia'),
      }
    })
  }, [cruces])

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="pg-title">SOIA — Semáforo Aduanal</h1>
        <p className="pg-meta">Aduana 240 Nuevo Laredo &middot; {cruces.length} registros</p>
      </div>

      {/* Bridge Intelligence Recommendation */}
      {bridgeRec && (
        <div style={{ padding: '14px 18px', background: 'var(--success-bg)', border: '1px solid var(--success-b)', borderRadius: 'var(--r-lg)', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--success)', marginBottom: 4 }}>
              Recomendado Hoy — {['domingo','lunes','martes','miércoles','jueves','viernes','sábado'][new Date().getDay()]}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--n-900)' }}>{bridgeRec.name}</div>
            <div style={{ fontSize: 12, color: 'var(--n-400)', marginTop: 2 }}>Promedio hoy: {bridgeRec.avg.toFixed(1)}h · basado en historial real</div>
          </div>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 0 4px var(--success-bg)' }} />
        </div>
      )}

      {/* Crossing Recommendation */}
      {(() => {
        const best = BRIDGES.find(b => b.status === 'green' && b.type === 'Comercial')
        if (!best) return null
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'var(--green-bg, rgba(22,163,74,0.08))', border: '1px solid var(--green-border, rgba(22,163,74,0.2))', borderRadius: 'var(--r-lg, 12px)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--green, #16A34A)', boxShadow: '0 0 0 3px var(--green-bg, rgba(22,163,74,0.08))' }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--green, #16A34A)', marginBottom: 2 }}>Cruce Recomendado</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{best.name} — {best.sub}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Semáforo verde &middot; Comercial disponible</div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Bridge Status Grid 2x2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
        {BRIDGES.map(b => (
          <div key={b.name} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{b.name}</div>
            <div style={{ fontSize: 14, color: 'var(--amber-700)', marginBottom: 16 }}>{b.sub}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: b.status === 'green' ? 'var(--status-green)' : b.status === 'yellow' ? 'var(--status-yellow)' : 'var(--status-red)' }} />
                <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{b.type}</span>
              </div>
              <div className="mono" style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)' }}>{b.wait}</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 12 }}>Actualizado: {new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        ))}
      </div>

      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 24, textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: 32, fontWeight: 600, color: 'var(--status-green)' }}>{desaduanado}</div>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--amber-700)', marginTop: 4 }}>Desaduanado</div>
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 24, textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: 32, fontWeight: 600, color: 'var(--status-blue)' }}>{cumplido}</div>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--amber-700)', marginTop: 4 }}>Cumplido</div>
        </div>
      </div>

      {/* Cruces Recientes */}
      {loading ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div className="skel" style={{ width: 200, height: 20, margin: '0 auto 8px' }} />
          <div className="skel" style={{ width: 140, height: 14, margin: '0 auto' }} />
        </div>
      ) : cruces.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Landmark size={20} style={{ color: 'var(--amber-600)' }} />}
            title="SOIA pendiente de sincronización"
            subtitle="La tabla soia_cruces está vacía. Se poblará cuando GlobalPC sincronice datos de cruces."
          />
        </div>
      ) : (
        <DataTable
          columns={tableColumns}
          data={cruces}
          loading={false}
          keyField="id"
          pageSize={50}
          exportFilename={`${COMPANY_ID}_soia`}
          searchPlaceholder="Buscar cruce..."
          emptyMessage="Sin cruces recientes"
        />
      )}
    </div>
  )
}
