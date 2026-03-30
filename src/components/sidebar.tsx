'use client'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { GOLD_GRADIENT } from '@/lib/design-system'
import {
  Truck, Package, FileText, FolderOpen,
  BarChart3, CreditCard, Table2, Activity,
  Users, UserPlus, Shield, Mic, Cpu,
  Monitor, BookOpen, TrendingUp, Bell, Landmark,
} from 'lucide-react'

const NAV = [
  { href: '/traficos',     icon: Truck,      label: 'Tráficos' },
  { href: '/entradas',     icon: Package,    label: 'Entradas' },
  { href: '/pedimentos',   icon: FileText,   label: 'Pedimentos' },
  { href: '/expedientes',  icon: FolderOpen, label: 'Expedientes' },
  { href: '/reportes',     icon: BarChart3,  label: 'Reportes' },
  { href: '/cuentas',      icon: CreditCard, label: 'Cuentas' },
  { href: '/cumplimiento', icon: Shield,     label: 'Cumplimiento' },
  { href: '/anexo24',      icon: Table2,     label: 'Anexo 24' },
  { href: '/immex',        icon: Package,    label: 'IMMEX' },
  { href: '/soia',         icon: Landmark,   label: 'SOIA' },
  { href: '/alertas',      icon: Bell,       label: 'Alertas' },
  { href: '/status',       icon: Activity,   label: 'Sistema' },
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
            className={`ir-item ${isActive(item.href) ? 'ir-active' : ''}`}
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

      <Link
        href="/cruz"
        className={`ir-cruz ${isActive('/cruz') ? 'ir-active' : ''}`}
        aria-label="CRUZ AI"
      >
        <div style={{
          width: 22, height: 22, borderRadius: 6,
          background: GOLD_GRADIENT,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, fontFamily: 'Georgia, serif',
          color: '#1A1710',
        }}>Z</div>
        <span className="ir-tooltip">CRUZ AI</span>
      </Link>
    </nav>
  )
}
