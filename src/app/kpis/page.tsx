'use client'

import { EmptyState } from '@/components/ui/EmptyState'

export default function KPIsPage() {
  return (
    <div className="page-shell">
      <div style={{ marginBottom: 12 }}>
        <h1 className="page-title">KPI&apos;s</h1>
        <p className="page-subtitle">Indicadores clave de rendimiento</p>
      </div>
      <div className="table-shell" style={{ padding: 40 }}>
        <EmptyState
          icon="📊"
          title="Indicadores en preparación"
          description="Los KPI's de sus operaciones estarán disponibles próximamente."
        />
      </div>
    </div>
  )
}
