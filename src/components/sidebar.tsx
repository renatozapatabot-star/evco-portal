'use client'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard, Truck, FolderOpen, BarChart3,
  MessageSquare, Users, UserPlus, Shield, Cpu,
  Monitor, BookOpen, TrendingUp,
} from 'lucide-react'

/* V6 client nav: exactly 5 items — Inicio, Tráficos, CRUZ, Reportes, Documentos.
   CRUZ is gold-accented as item #3. Removed routes remain accessible by URL. */
const NAV = [
  { href: '/',             icon: LayoutDashboard, label: 'Inicio' },
  { href: '/traficos',     icon: Truck,           label: 'Tráficos' },
  { href: '/cruz',         icon: MessageSquare,   label: 'CRUZ',     gold: true },
  { href: '/reportes',     icon: BarChart3,       label: 'Reportes' },
  { href: '/documentos',   icon: FolderOpen,      label: 'Documentos' },
]

const ADMIN_NAV = [
  { href: '/admin',         icon: Users,       label: 'Fleet Overview' },
  { href: '/war-room',      icon: Monitor,     label: 'War Room' },
  { href: '/operaciones',   icon: Cpu,         label: 'Autonomía' },
  { href: '/radar',         icon: Shield,      label: 'Radar Riesgos' },
  { href: '/conocimiento',  icon: BookOpen,    label: 'Conocimiento' },
  { href: '/revenue',       icon: TrendingUp,  label: 'Revenue' },
  { href: '/admin/onboard', icon: UserPlus,    label: 'Nuevo Cliente' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const match = document.cookie.match(/(^| )user_role=([^;]+)/)
    setRole(match ? match[2] : null)
  }, [])

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <nav className="icon-rail" aria-label="Navegación principal">
      <Link href="/" className="ir-logo" aria-label="Dashboard">
        <div className="ir-zmark z-mark-coin"><span>Z</span></div>
      </Link>

      <div className="ir-nav">
        {NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`${item.gold ? 'ir-cruz-nav' : 'ir-item'} ${isActive(item.href) ? 'ir-active' : ''}`}
            aria-label={item.label}
            aria-current={isActive(item.href) ? 'page' : undefined}
          >
            <item.icon size={22} strokeWidth={1.5} />
            <span className="ir-label">{item.label}</span>
            <span className="ir-tooltip">{item.label}</span>
          </Link>
        ))}

        {role === 'admin' && (
          <>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '8px 6px' }} />
            {ADMIN_NAV.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`ir-item ${isActive(item.href) ? 'ir-active' : ''}`}
                aria-label={item.label}
                aria-current={isActive(item.href) ? 'page' : undefined}
              >
                <item.icon size={22} strokeWidth={1.5} />
                <span className="ir-tooltip">{item.label}</span>
              </Link>
            ))}
          </>
        )}
      </div>

    </nav>
  )
}
