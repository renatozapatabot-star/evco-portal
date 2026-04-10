'use client'

import { useEffect, useState, useMemo } from 'react'
import { useReducedMotion } from 'framer-motion'

interface BannerItem {
  text: string
  href?: string
}

interface NewsBannerProps {
  items: BannerItem[]
  /** Rotation interval in ms. Default 5000 (5s). */
  interval?: number
}

export function NewsBanner({ items, interval = 5000 }: NewsBannerProps) {
  const prefersReduced = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  const filtered = useMemo(() => items.filter(i => i.text), [items])

  useEffect(() => {
    if (filtered.length <= 1 || prefersReduced) return
    const timer = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex(prev => (prev + 1) % filtered.length)
        setVisible(true)
      }, 300) // fade out, swap, fade in
    }, interval)
    return () => clearInterval(timer)
  }, [filtered.length, interval, prefersReduced])

  if (filtered.length === 0) return null

  const current = filtered[index % filtered.length]

  return (
    <div style={{
      background: 'rgba(9,9,11,0.75)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      minHeight: 36,
      marginBottom: 12,
      borderRadius: 8,
    }}>
      {/* Gold pulse dot */}
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: '#eab308', flexShrink: 0,
        opacity: 0.8,
      }} />

      {/* Item text with fade */}
      <span style={{
        fontSize: 12, fontWeight: 500,
        color: '#eab308',
        fontFamily: 'var(--font-jetbrains-mono)',
        transition: prefersReduced ? 'none' : 'opacity 300ms ease',
        opacity: visible ? 1 : 0,
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {current.text}
      </span>

      {/* Dots indicator */}
      {filtered.length > 1 && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {filtered.map((_, i) => (
            <span key={i} style={{
              width: 4, height: 4, borderRadius: '50%',
              background: i === index % filtered.length ? '#eab308' : 'rgba(255,255,255,0.15)',
              transition: 'background 300ms ease',
            }} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Item builders per role ──────────────────────────────

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export interface AdminBannerData {
  totalTraficos: number
  activeTraficos: number
  cruzadosThisMonth: number
  cruzadosLastMonth: number
  valorYtdUsd: number
  activeClients: number
  escalationCount: number
  overdueCount: number
  decisionsTotal30d: number
  accuracy30d: number
}

export function buildAdminItems(d: AdminBannerData): BannerItem[] {
  const items: BannerItem[] = []

  // Business pulse
  const trend = d.cruzadosLastMonth > 0
    ? Math.round(((d.cruzadosThisMonth - d.cruzadosLastMonth) / d.cruzadosLastMonth) * 100)
    : 0
  const arrow = trend > 0 ? '↑' : trend < 0 ? '↓' : '→'
  items.push({
    text: `${d.activeTraficos} activos · ${d.cruzadosThisMonth} cruzados este mes ${arrow}${Math.abs(trend)}%`,
    href: '/traficos',
  })

  // Escalations (only if any)
  if (d.escalationCount > 0) {
    items.push({
      text: `${d.escalationCount} escalación${d.escalationCount !== 1 ? 'es' : ''} pendiente${d.escalationCount !== 1 ? 's' : ''}${d.overdueCount > 0 ? ` · ${d.overdueCount} vencida${d.overdueCount !== 1 ? 's' : ''}` : ''}`,
      href: '/drafts',
    })
  }

  // Value
  if (d.valorYtdUsd > 0) {
    items.push({
      text: `Valor YTD: ${fmtCompact(d.valorYtdUsd)} USD · ${d.activeClients} clientes activos`,
      href: '/financiero',
    })
  }

  // AI performance
  if (d.decisionsTotal30d > 0) {
    items.push({
      text: `IA: ${d.decisionsTotal30d} decisiones (30d) · ${d.accuracy30d}% precisión`,
      href: '/agente',
    })
  }

  // Always at least one item
  if (items.length === 0) {
    items.push({ text: `Patente 3596 · ${d.totalTraficos.toLocaleString('es-MX')} operaciones totales` })
  }

  return items
}

export interface ClientBannerData {
  activeShipments: number
  cruzadosEsteMes: number
  facturadoThisMonth: number
  nextCrossing: { trafico: string } | null
  exchangeRate: number | null
}

export function buildClientItems(d: ClientBannerData): BannerItem[] {
  const items: BannerItem[] = []

  if (d.activeShipments > 0) {
    items.push({
      text: `${d.activeShipments} envío${d.activeShipments !== 1 ? 's' : ''} en tránsito · ${d.cruzadosEsteMes} cruzado${d.cruzadosEsteMes !== 1 ? 's' : ''} este mes`,
      href: '/traficos',
    })
  }

  if (d.nextCrossing) {
    items.push({
      text: `Próximo cruce esperado: ${d.nextCrossing.trafico}`,
      href: '/traficos',
    })
  }

  if (d.facturadoThisMonth > 0) {
    items.push({
      text: `Facturado este mes: ${fmtCompact(d.facturadoThisMonth)} MXN`,
      href: '/financiero',
    })
  }

  if (d.exchangeRate) {
    items.push({
      text: `Tipo de cambio: $${d.exchangeRate.toFixed(2)} MXN/USD`,
      href: '/financiero',
    })
  }

  if (items.length === 0) {
    items.push({ text: 'Todo al corriente — sin novedades' })
  }

  return items
}

export interface OperatorBannerData {
  assigned: number
  completed: number
  inProgress: number
  blockedCount: number
  unassignedCount: number
}

export function buildOperatorItems(d: OperatorBannerData): BannerItem[] {
  const items: BannerItem[] = []

  if (d.assigned > 0 || d.completed > 0) {
    items.push({
      text: `${d.assigned} asignados · ${d.completed} completados hoy · ${d.inProgress} en progreso`,
    })
  }

  if (d.blockedCount > 0) {
    items.push({
      text: `${d.blockedCount} tráfico${d.blockedCount !== 1 ? 's' : ''} bloqueado${d.blockedCount !== 1 ? 's' : ''} — esperando documentos`,
      href: '/traficos?estatus=Documentacion',
    })
  }

  if (d.unassignedCount > 0) {
    items.push({
      text: `${d.unassignedCount} sin asignar en cola`,
      href: '/traficos',
    })
  }

  if (items.length === 0) {
    items.push({ text: 'Día al corriente — sin pendientes' })
  }

  return items
}
