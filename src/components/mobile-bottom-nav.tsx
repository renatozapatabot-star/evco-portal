'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Truck, BarChart3, FolderOpen } from 'lucide-react'

interface BottomTab {
  href: string
  label: string
  icon: typeof LayoutDashboard | null
  center?: boolean
}

const TABS: BottomTab[] = [
  { href: '/',          label: 'Inicio',    icon: LayoutDashboard },
  { href: '/traficos',  label: 'Traficos',  icon: Truck },
  { href: '/cruz',      label: 'CRUZ',      icon: null, center: true },
  { href: '/reportes',  label: 'Reportes',  icon: BarChart3 },
  { href: '/documentos',  label: 'Documentos', icon: FolderOpen },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="m-nav" aria-label="Navegacion movil">
      {TABS.map(tab => {
        const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)

        return (
          <Link key={tab.href} href={tab.href} className={`m-nav-tab ${active ? 'active' : ''} ${tab.center ? 'm-nav-center' : ''}`}>
            <span style={{ position: 'relative' }}>
              {tab.center ? (
                <div className="m-nav-z">Z</div>
              ) : tab.icon ? (
                <tab.icon size={20} strokeWidth={1.6} />
              ) : null}
            </span>
            <span className="m-nav-label">{tab.label}</span>
            {active && !tab.center && <span className="m-nav-active-dot" />}
          </Link>
        )
      })}
    </nav>
  )
}
