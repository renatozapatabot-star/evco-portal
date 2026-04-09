'use client'

import { useEffect, useState } from 'react'
import { getCookieValue } from '@/lib/client-config'
import { EmptyState } from '@/components/ui/EmptyState'

interface Memory {
  id: string
  memory_type: string
  natural_language_description: string
  applied_count: number
  last_applied_at: string | null
  created_at: string
  active: boolean
}

export default function MisReglasPage() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/data?table=operator_memories&limit=100&order_by=created_at&order_dir=desc')
      .then(r => r.json())
      .then(res => setMemories(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const operatorName = getCookieValue('operator_name') || 'Operador'

  return (
    <div className="page-shell">
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">Lo que CRUZ recuerda de ti</h1>
        <p className="page-subtitle">
          Cada vez que corriges al sistema, CRUZ aprende y aplica tu regla automáticamente en el futuro.
        </p>
      </div>

      {loading && (
        <div style={{ padding: 32, textAlign: 'center', color: '#8B949E' }}>Cargando reglas...</div>
      )}

      {!loading && memories.length === 0 && (
        <EmptyState
          icon="🧠"
          title="Aún no hay reglas guardadas"
          description="Cuando corrijas una clasificación o ajustes un dato, CRUZ recordará tu preferencia y la aplicará automáticamente la próxima vez."
        />
      )}

      {!loading && memories.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {memories.map(m => (
            <div key={m.id} style={{
              background: '#222222', borderRadius: 14, padding: 16,
              border: m.active ? '1px solid rgba(201,168,76,0.2)' : '1px solid rgba(255,255,255,0.06)',
              opacity: m.active ? 1 : 0.5,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{
                  fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.05em', color: '#C9A84C',
                  background: 'rgba(201,168,76,0.1)', padding: '2px 8px', borderRadius: 4,
                }}>
                  {m.memory_type.replace(/_/g, ' ')}
                </span>
                {m.applied_count > 0 && (
                  <span className="font-mono" style={{ fontSize: 11, color: '#16A34A' }}>
                    Aplicada {m.applied_count} {m.applied_count === 1 ? 'vez' : 'veces'}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 14, color: '#E6EDF3', lineHeight: 1.5, marginBottom: 8 }}>
                {m.natural_language_description}
              </div>
              <div style={{ fontSize: 11, color: '#6E7681' }}>
                Creada: {new Date(m.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Chicago' })}
                {m.last_applied_at && ` · Última aplicación: ${new Date(m.last_applied_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', timeZone: 'America/Chicago' })}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
