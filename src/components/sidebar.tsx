'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Truck, Package, FileText, FolderOpen, BarChart3, Files, CreditCard, Landmark, BookOpen, Scale, Calculator, Factory, ChevronLeft, ChevronRight } from 'lucide-react'
import { CLIENT_NAME, PATENTE, ADUANA } from '@/lib/client-config'

const navGroups = [
  { label: 'OPERATIONS', items: [
    { href: '/traficos', label: 'Traficos', icon: Truck },
    { href: '/entradas', label: 'Entradas', icon: Package },
    { href: '/pedimentos', label: 'Pedimentos', icon: FileText },
    { href: '/expedientes', label: 'Expedientes', icon: FolderOpen },
  ]},
  { label: 'INTELLIGENCE', items: [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/reportes', label: 'Reportes', icon: BarChart3 },
    { href: '/anexo24', label: 'Anexo 24', icon: BookOpen },
    { href: '/oca', label: 'OCA', icon: Scale },
    { href: '/soia', label: 'SOIA', icon: Landmark },
  ]},
  { label: 'ADMIN', items: [
    { href: '/proveedores', label: 'Proveedores', icon: Factory },
    { href: '/documentos', label: 'Documentos', icon: Files },
    { href: '/cuentas', label: 'Cuentas', icon: CreditCard },
    { href: '/cotizacion', label: 'Cotizacion', icon: Calculator },
    { href: '/carriers', label: 'Carriers', icon: Truck },
  ]},
]

export default function Sidebar() {
  const pathname = usePathname()
  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href)
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => { if (localStorage.getItem('sidebar-collapsed') === 'true') setCollapsed(true) }, [])
  const toggle = () => { const n = !collapsed; setCollapsed(n); localStorage.setItem('sidebar-collapsed', String(n)) }
  const W = collapsed ? 64 : 240

  return (
    <aside className="sidebar-desktop" style={{ width: W, minWidth: W, background: 'var(--bg-sidebar)', display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', borderRight: '1px solid var(--border-primary)', transition: 'width 200ms ease, min-width 200ms ease' }}>
      <div style={{ height: 64, padding: collapsed ? '0 12px' : '0 16px', borderBottom: '1px solid var(--border-light)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, justifyContent: collapsed ? 'center' : 'flex-start' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--amber-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'white' }}>RZ</span>
        </div>
        {!collapsed && <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{CLIENT_NAME}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>Portal Aduanal</div>
        </div>}
        <button onClick={toggle} style={{ width: 24, height: 24, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {navGroups.map((g, gi) => (
          <div key={g.label}>
            {!collapsed && <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: 'var(--text-tertiary)', padding: gi === 0 ? '8px 16px 6px' : '16px 16px 6px' }}>{g.label}</div>}
            {collapsed && gi > 0 && <div style={{ height: 1, background: 'var(--border-light)', margin: '8px 8px' }} />}
            {g.items.map(item => {
              const active = isActive(item.href); const Icon = item.icon
              return (
                <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined} style={{
                  display: 'flex', alignItems: 'center', gap: 12, height: 40, padding: collapsed ? '0' : '0 16px',
                  justifyContent: collapsed ? 'center' : 'flex-start', fontSize: 14, textDecoration: 'none',
                  transition: 'all 150ms ease', borderRadius: active ? `0 ${collapsed ? '8px 8px' : '8px 8px'} 0` : '8px',
                  margin: collapsed ? '2px 8px' : '2px 8px',
                  color: active ? 'var(--amber-800)' : 'var(--text-secondary)',
                  fontWeight: active ? 500 : 400,
                  background: active ? 'var(--amber-100)' : 'transparent',
                  borderLeft: active ? '3px solid var(--amber-600)' : '3px solid transparent',
                }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
                >
                  <Icon size={18} strokeWidth={1.8} style={{ flexShrink: 0, color: active ? 'var(--amber-600)' : 'var(--text-tertiary)' }} />
                  {!collapsed && item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
      <div style={{ padding: collapsed ? '12px 8px' : '12px 16px', borderTop: '1px solid var(--border-light)', flexShrink: 0, textAlign: collapsed ? 'center' : 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: collapsed ? 'center' : 'flex-start', marginBottom: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-green)' }} />
          {!collapsed && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>CRUZ</span>}
        </div>
        {!collapsed && <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>Patente {PATENTE} &middot; Aduana {ADUANA}</div>}
      </div>
    </aside>
  )
}
