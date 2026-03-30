'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Truck, Package, BarChart3 } from 'lucide-react'
import { GOLD, GOLD_GRADIENT } from '@/lib/design-system'

const PRIMARY_NAV = [
  { href: '/',          label: 'Inicio',    icon: LayoutDashboard },
  { href: '/traficos',  label: 'Tráficos',  icon: Truck },
  { href: '/cruz',      label: 'CRUZ',      icon: null as any, center: true },
  { href: '/reportes',  label: 'Reportes',  icon: BarChart3 },
  { href: '/entradas',  label: 'Entradas',  icon: Package },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      className="mobile-nav"
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        height: 60,
        background: '#0A0B0E',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 30,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {PRIMARY_NAV.map(item => {
        const Icon = item.icon
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        const isCenter = 'center' in item && item.center
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '8px 12px',
              color: isCenter ? GOLD : active ? '#1A6BFF' : 'rgba(255,255,255,0.40)',
              fontSize: 9.5,
              fontWeight: active || isCenter ? 600 : 500,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              textDecoration: 'none',
              transition: 'color 150ms ease',
            }}
          >
            {isCenter ? (
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: GOLD_GRADIENT,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, fontFamily: 'Georgia, serif',
                color: '#1A1710',
              }}>Z</div>
            ) : (
              <Icon size={20} strokeWidth={1.8} />
            )}
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
