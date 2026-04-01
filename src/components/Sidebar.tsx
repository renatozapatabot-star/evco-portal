'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Truck, Package, Warehouse, Calendar, FolderOpen, Upload,
  BarChart3, DollarSign, Users2, FileText,
  Shield, Award,
  Settings, Sparkles, Star,
  ChevronLeft, ChevronRight, LogOut,
  Sun, Moon,
} from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import type { UserRole } from '@/components/nav/nav-config'

const T = {
  bg: 'var(--cruz-surface)',
  border: 'var(--cruz-border)',
  text: 'var(--cruz-text)',
  textMuted: 'var(--cruz-text-muted)',
  gold: 'var(--cruz-gold)',
  goldSubtle: 'var(--cruz-gold-dim)',
  goldBorder: 'var(--cruz-border-gold)',
  hover: 'var(--cruz-elevated)',
  activeBorder: 'var(--cruz-gold)',
  sectionLabel: 'var(--cruz-text-ghost)',
} as const

const EXPANDED_W = 240
const COLLAPSED_W = 64

interface SidebarItem {
  href: string
  label: string
  icon: typeof Truck
}

interface SidebarSection {
  label: string
  items: SidebarItem[]
}

const OPERACIONES: SidebarSection = {
  label: 'OPERACIONES',
  items: [
    { href: '/traficos',    label: 'Tráficos',    icon: Truck },
    { href: '/entradas',    label: 'Entradas',     icon: Package },
    { href: '/bodega',      label: 'Bodega',       icon: Warehouse },
    { href: '/calendario',  label: 'Calendario',   icon: Calendar },
    { href: '/expedientes',      label: 'Expedientes',  icon: FolderOpen },
    { href: '/documentos/subir', label: 'Subir Docs',   icon: Upload },
  ],
}

const INTELIGENCIA: SidebarSection = {
  label: 'INTELIGENCIA',
  items: [
    { href: '/reportes',    label: 'Reportes',     icon: BarChart3 },
    { href: '/cuentas',     label: 'Financiero',   icon: DollarSign },
    { href: '/proveedores', label: 'Proveedores',  icon: Users2 },
    { href: '/anexo24',     label: 'Anexo 24',     icon: FileText },
  ],
}

const CUMPLIMIENTO: SidebarSection = {
  label: 'CUMPLIMIENTO',
  items: [
    { href: '/mve',   label: 'MVE',   icon: Shield },
    { href: '/usmca', label: 'USMCA', icon: Award },
  ],
}

const SECTIONS = [OPERACIONES, INTELIGENCIA, CUMPLIMIENTO]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [role, setRole] = useState<UserRole>('client')
  const [companyName, setCompanyName] = useState('')
  const [clientClave, setClientClave] = useState('')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const r = getCookieValue('user_role')
    if (r === 'admin' || r === 'broker') setRole(r as UserRole)
    else setRole('client')
    setClientClave(getCookieValue('company_clave') ?? '')
    const cn = getCookieValue('company_name')
    setCompanyName(cn ? decodeURIComponent(cn) : '')
  }, [])

  // Persist collapsed state
  useEffect(() => {
    const saved = localStorage.getItem('cruz-sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  // Sync body class for CSS layout shifts
  useEffect(() => {
    if (collapsed) document.body.classList.add('sidebar-collapsed')
    else document.body.classList.remove('sidebar-collapsed')
  }, [collapsed])

  // Theme initialization
  useEffect(() => {
    const saved = localStorage.getItem('cruz-theme')
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved)
    } else {
      const preferLight = window.matchMedia('(prefers-color-scheme: light)').matches
      setTheme(preferLight ? 'light' : 'dark')
    }
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('cruz-theme', next)
  }

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('cruz-sidebar-collapsed', String(next))
  }

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  const isInternal = role === 'admin' || role === 'broker'
  const w = collapsed ? COLLAPSED_W : EXPANDED_W

  const roleLabel = role === 'admin' ? 'Admin' : role === 'broker' ? 'Operador' : clientClave || 'Cliente'

  return (
    <nav
      className="shell-sidebar"
      data-sidebar=""
      style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: w, background: T.bg,
        borderRight: `1px solid ${T.border}`,
        display: 'flex', flexDirection: 'column',
        zIndex: 901, transition: 'width 200ms ease',
        overflowX: 'hidden', overflowY: 'auto',
      }}
    >
      {/* ── Logo ── */}
      <Link
        href="/"
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: collapsed ? '20px 16px' : '20px 20px',
          textDecoration: 'none', flexShrink: 0,
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 6,
          background: '#CC1B2F', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{
            color: '#FFF', fontWeight: 900, fontSize: 18,
            fontFamily: 'var(--font-geist-sans)', letterSpacing: '-0.02em', lineHeight: 1,
          }}>Z</span>
        </div>
        {!collapsed && (
          <span style={{ fontSize: 18, fontWeight: 800, color: T.text, letterSpacing: '-0.01em' }}>
            CRUZ
          </span>
        )}
      </Link>

      {/* ── Sections ── */}
      <div style={{ flex: 1, padding: collapsed ? '8px 8px' : '8px 12px', overflowY: 'auto' }}>
        {/* OPERACIONES */}
        <SidebarGroup section={OPERACIONES} collapsed={collapsed} pathname={pathname} isActive={isActive} router={router} />

        {/* CRUZ AI Button */}
        <div style={{ padding: collapsed ? '12px 0' : '12px 0' }}>
          <Link
            href="/cruz"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 8, width: '100%',
              padding: collapsed ? '10px 0' : '10px 12px',
              background: isActive('/cruz') ? T.gold : T.goldSubtle,
              color: isActive('/cruz') ? '#1A1814' : T.gold,
              border: `1px solid ${T.goldBorder}`,
              borderRadius: 8, textDecoration: 'none',
              fontSize: 14, fontWeight: 700,
              transition: 'all 150ms',
            }}
          >
            <Sparkles size={18} />
            {!collapsed && 'CRUZ AI'}
          </Link>
        </div>

        {/* INTELIGENCIA + CUMPLIMIENTO */}
        <SidebarGroup section={INTELIGENCIA} collapsed={collapsed} pathname={pathname} isActive={isActive} router={router} />
        <SidebarGroup section={CUMPLIMIENTO} collapsed={collapsed} pathname={pathname} isActive={isActive} router={router} />

        {/* BROKER ONLY */}
        {isInternal && (
          <div style={{ marginTop: 16 }}>
            {!collapsed && (
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                color: T.sectionLabel, padding: '8px 12px 4px',
                textTransform: 'uppercase',
              }}>
                Broker
              </div>
            )}
            <NavItem
              href="/broker"
              label="CRUZ"
              icon={Star}
              collapsed={collapsed}
              active={isActive('/broker')}
              gold
              onClick={() => router.push('/broker')}
            />
            <NavItem
              href="/admin"
              label="Config"
              icon={Settings}
              collapsed={collapsed}
              active={isActive('/admin')}
              onClick={() => router.push('/admin')}
            />
          </div>
        )}
      </div>

      {/* ── Bottom: User info + Toggle ── */}
      <div style={{ flexShrink: 0, borderTop: `1px solid ${T.border}`, padding: collapsed ? '12px 8px' : '12px' }}>
        {/* User info */}
        {!collapsed && (
          <div style={{ padding: '0 8px 12px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {companyName || (isInternal ? 'Renato Zapata & Co' : 'Cliente')}
            </div>
            <div style={{
              display: 'inline-block', marginTop: 4,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
              padding: '2px 8px', borderRadius: 9999,
              background: T.goldSubtle, color: T.gold,
              border: `1px solid ${T.goldBorder}`,
              textTransform: 'uppercase',
            }}>
              {roleLabel}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <a
                href="/api/auth/logout"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 12, color: T.textMuted,
                  textDecoration: 'none', transition: 'color 150ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = T.text)}
                onMouseLeave={e => (e.currentTarget.style.color = T.textMuted)}
              >
                <LogOut size={14} />
                Cerrar sesión
              </a>
              <button
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                style={{
                  marginLeft: 'auto',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 6,
                  background: 'transparent', border: 'none',
                  color: T.textMuted, cursor: 'pointer',
                  transition: 'color 150ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = T.text)}
                onMouseLeave={e => (e.currentTarget.style.color = T.textMuted)}
              >
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </div>
          </div>
        )}
        {collapsed && (
          <>
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', padding: '8px 0',
                background: 'transparent', border: 'none',
                color: T.textMuted, cursor: 'pointer',
                transition: 'color 150ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = T.text)}
              onMouseLeave={e => (e.currentTarget.style.color = T.textMuted)}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <a
              href="/api/auth/logout"
              title="Cerrar sesión"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '8px 0', color: T.textMuted, textDecoration: 'none',
                transition: 'color 150ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = T.text)}
              onMouseLeave={e => (e.currentTarget.style.color = T.textMuted)}
            >
              <LogOut size={18} />
            </a>
          </>
        )}

        {/* Toggle */}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '100%', padding: '8px 0',
            background: 'transparent', border: 'none',
            color: T.textMuted, cursor: 'pointer',
            transition: 'color 150ms', borderRadius: 6,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = T.text)}
          onMouseLeave={e => (e.currentTarget.style.color = T.textMuted)}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    </nav>
  )
}

/* ── Section group with label ── */
function SidebarGroup({
  section, collapsed, pathname, isActive, router,
}: {
  section: SidebarSection
  collapsed: boolean
  pathname: string
  isActive: (href: string) => boolean
  router: ReturnType<typeof useRouter>
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      {!collapsed && (
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
          color: T.sectionLabel, padding: '4px 12px',
          marginTop: 24, marginBottom: 8,
          textTransform: 'uppercase',
        }}>
          {section.label}
        </div>
      )}
      {collapsed && <div style={{ height: 8 }} />}
      {section.items.map(item => (
        <NavItem
          key={item.href}
          href={item.href}
          label={item.label}
          icon={item.icon}
          collapsed={collapsed}
          active={isActive(item.href)}
          onClick={() => router.push(item.href)}
        />
      ))}
    </div>
  )
}

/* ── Single nav item ── */
function NavItem({
  href, label, icon: Icon, collapsed, active, gold, onClick,
}: {
  href: string
  label: string
  icon: typeof Truck
  collapsed: boolean
  active: boolean
  gold?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      style={{
        display: 'flex', alignItems: 'center',
        gap: 10, width: '100%',
        padding: collapsed ? '10px 0' : '10px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        background: active ? 'rgba(196,162,78,0.08)' : 'transparent',
        border: 'none',
        borderLeft: 'none',
        borderRadius: 6,
        color: active ? (gold ? T.gold : T.text) : (gold ? T.gold : T.textMuted),
        fontSize: 13, fontWeight: active ? 700 : 500,
        fontFamily: 'var(--font-geist-sans)',
        cursor: 'pointer', transition: 'all 100ms',
        textAlign: 'left', whiteSpace: 'nowrap',
        position: 'relative',
      }}
      onMouseEnter={e => {
        if (!active) e.currentTarget.style.background = T.hover
        if (!active && !gold) e.currentTarget.style.color = T.text
      }}
      onMouseLeave={e => {
        if (!active) e.currentTarget.style.background = active ? 'rgba(196,162,78,0.08)' : 'transparent'
        if (!active && !gold) e.currentTarget.style.color = T.textMuted
      }}
    >
      {active && !collapsed && (
        <span style={{
          position: 'absolute', left: 0, top: '20%', bottom: '20%',
          width: 3, background: T.gold,
          borderRadius: '0 2px 2px 0',
        }} />
      )}
      <Icon size={18} strokeWidth={active ? 2.2 : 1.8} style={{ opacity: active ? 1 : 0.4, color: active ? T.gold : undefined }} />
      {!collapsed && label}
    </button>
  )
}
