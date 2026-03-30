'use client'

export function DashboardSkeleton() {
  return (
    <div style={{ padding: 32 }}>
      <div className="command-center" style={{ marginBottom: 28 }}>
        {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--r-lg)' }} />)}
      </div>
      <div className="kpi-grid" style={{ marginBottom: 28 }}>
        {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--r-lg)' }} />)}
      </div>
      <div className="skeleton" style={{ height: 300, borderRadius: 'var(--r-lg)' }} />
    </div>
  )
}

export function TablePageSkeleton({ title }: { title: string }) {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
      </div>
      <div className="card">
        <div style={{ padding: '12px 20px', borderBottom: 'var(--b-subtle)' }}>
          <div className="skeleton" style={{ width: 200, height: 34 }} />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, padding: '14px 20px', borderBottom: '1px solid var(--n-100)' }}>
            <div className="skeleton" style={{ width: 100, height: 16 }} />
            <div className="skeleton" style={{ width: 80, height: 16 }} />
            <div className="skeleton" style={{ flex: 1, height: 16 }} />
            <div className="skeleton" style={{ width: 60, height: 16 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
