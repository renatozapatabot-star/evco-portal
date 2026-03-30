'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Truck, BarChart3, FolderOpen } from 'lucide-react'
import { GOLD_GRADIENT } from '@/lib/design-system'

const TABS = [
  { href: '/',          label: 'Inicio',    icon: LayoutDashboard },
  { href: '/traficos',  label: 'Tráficos',  icon: Truck },
  { href: '/cruz',      label: 'CRUZ',      icon: null as any, center: true },
  { href: '/reportes',  label: 'Reportes',  icon: BarChart3 },
  { href: '/expedientes', label: 'Docs',     icon: FolderOpen },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="m-nav" aria-label="Navegación móvil">
      {TABS.map(tab => {
        const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
        const Icon = tab.icon

        return (
          <Link key={tab.href} href={tab.href} className={`m-nav-tab ${active ? 'active' : ''} ${tab.center ? 'm-nav-center' : ''}`}>
            <span style={{ position: 'relative' }}>
              {tab.center ? (
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: GOLD_GRADIENT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, fontFamily: 'Georgia, serif',
                  color: '#1A1710',
                }}>Z</div>
              ) : (
                <Icon size={20} strokeWidth={1.6} />
              )}
            </span>
            <span className="m-nav-label">{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
