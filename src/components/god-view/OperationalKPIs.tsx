'use client'

import Link from 'next/link'
import { fmtCurrency } from '@/lib/format-utils'

interface Props {
  enProceso: number
  cruzadosHoy: number
  listosDespacho: number
  emailsHoy: number
  tipoCambio: number | null
  ahorroTmec: number
}

interface KpiTile {
  href: string
  value: string
  label: string
  color: string
}

export function OperationalKPIs({ enProceso, cruzadosHoy, listosDespacho, emailsHoy, tipoCambio, ahorroTmec }: Props) {
  const tiles: KpiTile[] = [
    {
      href: '/embarques?estatus=En Proceso',
      value: String(enProceso),
      label: 'En proceso',
      color: 'var(--warning-500, #D97706)',
    },
    {
      href: '/embarques?estatus=Cruzado',
      value: String(cruzadosHoy),
      label: 'Cruzados hoy',
      color: 'var(--success-500, #16A34A)',
    },
    {
      href: '/embarques?pipeline_stage=ready_to_file',
      value: String(listosDespacho),
      label: 'Listos despacho',
      color: 'var(--gold, #E8EAED)',
    },
    {
      href: '/comunicaciones',
      value: String(emailsHoy),
      label: 'Emails hoy',
      color: 'var(--info-500, #3B82F6)',
    },
    {
      href: '#',
      value: tipoCambio ? `$${tipoCambio.toFixed(2)}` : '—',
      label: 'Tipo de cambio',
      color: 'var(--text-secondary)',
    },
    ...(ahorroTmec > 0 ? [{
      href: '/ahorro',
      value: fmtCurrency(ahorroTmec, { currency: 'USD' }),
      label: 'Ahorro T-MEC',
      color: 'var(--gold, #E8EAED)',
    }] : []),
  ]

  return (
    <div className="god-section">
      <h2 className="god-section-title">KPIs</h2>
      <div className="god-kpi-grid">
        {tiles.map(t => (
          <Link key={t.label} href={t.href} className="god-kpi-tile" style={{ borderTopColor: t.color }}>
            <span className="god-kpi-value font-mono">{t.value}</span>
            <span className="god-kpi-label">{t.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
