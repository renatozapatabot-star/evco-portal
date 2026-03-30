'use client'
import { useState } from 'react'
import { ChevronDown, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface AlertItem {
  id: string; label: string; count: number
  severity: 'critical' | 'warning' | 'info'; href: string
  icon: React.ElementType
}

export function AlertBar({ alerts }: { alerts: AlertItem[] }) {
  const [expanded, setExpanded] = useState(false)
  const router = useRouter()
  if (!alerts.length) return null

  const critCount = alerts.filter(a => a.severity === 'critical').length
  const topAlert  = [...alerts].sort((a,b) => {
    const o: Record<string, number> = {critical:0,warning:1,info:2}
    return o[a.severity] - o[b.severity]
  })[0]

  return (
    <div className="alert-bar" data-critical={critCount > 0} role="status" aria-label={`${alerts.length} alertas${critCount > 0 ? `, ${critCount} crítica` : ''}`}>
      <div className="ab-row" onClick={() => setExpanded(!expanded)}>
        <div className="ab-left">
          <AlertTriangle size={13} style={{ color: critCount > 0 ? 'var(--danger)' : 'var(--warning)', flexShrink: 0 }} />
          <span className="ab-summary">
            <strong>{alerts.length} alertas</strong>
            {critCount > 0 && <span className="ab-crit"> &middot; {critCount} cr&iacute;tica</span>}
            <span className="ab-sep">&mdash;</span>
            <span className="ab-preview">{topAlert.label} {topAlert.count}</span>
          </span>
        </div>
        <button className="ab-toggle" aria-expanded={expanded} aria-label={expanded ? 'Colapsar' : 'Expandir'}>
          <ChevronDown size={14} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease' }} />
        </button>
      </div>

      {expanded && (
        <div className="ab-list">
          {alerts.map(alert => (
            <button key={alert.id} className={`ab-item ab-item--${alert.severity}`} onClick={(e) => { e.stopPropagation(); router.push(alert.href) }}>
              <alert.icon size={13} />
              <span>{alert.label}</span>
              <span className="ab-count">{alert.count}</span>
              <span className="ab-arrow">&rarr;</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
