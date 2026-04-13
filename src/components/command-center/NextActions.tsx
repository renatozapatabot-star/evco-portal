'use client'

import Link from 'next/link'
import { Zap, CheckCircle2, AlertTriangle, FileText } from 'lucide-react'

interface NextActionsProps {
  pendingEntradas: number
  activeTraficosList: { trafico: string; daysOld: number }[]
  docsPendientes: number
  expedientesTotal: number
  totalTraficos: number
}

export function NextActions({ pendingEntradas, activeTraficosList, docsPendientes, expedientesTotal, totalTraficos }: NextActionsProps) {
  const items: { icon: typeof Zap; text: string; href: string; actionLabel: string; urgent: boolean }[] = []

  // Unassigned entradas
  if (pendingEntradas > 0) {
    items.push({
      icon: AlertTriangle,
      text: `${pendingEntradas} entrada${pendingEntradas !== 1 ? 's' : ''} sin asignar`,
      href: '/entradas',
      actionLabel: 'Asignar',
      urgent: true,
    })
  }

  // Old active embarques
  const oldOnes = activeTraficosList.filter(t => t.daysOld > 7)
  if (oldOnes.length > 0) {
    items.push({
      icon: Zap,
      text: `${oldOnes[0].trafico} — ${oldOnes[0].daysOld} días en proceso`,
      href: '/embarques',
      actionLabel: 'Ver',
      urgent: true,
    })
  }

  // Pending docs
  if (docsPendientes > 0) {
    items.push({
      icon: FileText,
      text: `${docsPendientes} embarque${docsPendientes !== 1 ? 's' : ''} sin pedimento`,
      href: '/expedientes',
      actionLabel: 'Revisar',
      urgent: false,
    })
  }

  // All good message
  if (items.length === 0) {
    items.push({
      icon: CheckCircle2,
      text: 'Todo al corriente — sin acciones pendientes',
      href: '/',
      actionLabel: '',
      urgent: false,
    })
  }

  // Cap at 4 items
  const display = items.slice(0, 4)

  return (
    <div className="cc-card" style={{ padding: '16px 20px', borderRadius: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: 10 }}>
        Próximas acciones
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {display.map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', borderRadius: 10,
            background: item.urgent ? 'rgba(192,197,206,0.04)' : 'transparent',
            borderLeft: item.urgent ? '3px solid rgba(251,191,36,0.5)' : '3px solid transparent',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <item.icon size={14} style={{ color: item.urgent ? '#C0C5CE' : '#22C55E', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#E6EDF3' }}>{item.text}</span>
            </div>
            {item.actionLabel && (
              <Link href={item.href} style={{
                padding: '4px 14px', borderRadius: 8,
                background: 'rgba(192,197,206,0.1)', color: '#C0C5CE',
                fontSize: 12, fontWeight: 700, textDecoration: 'none',
                transition: 'background 150ms',
                minHeight: 32, display: 'inline-flex', alignItems: 'center',
              }}>
                {item.actionLabel} →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
