import {
  LayoutDashboard, Truck, FileText, FolderOpen,
  BarChart3, DollarSign, Users2, BookOpen,
  Shield, Calendar, Award,
  Settings, MessageSquare, Package,
  History, Archive, Clock, ClipboardList, Receipt, Send, Phone,
  Warehouse, Upload,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ---------------------------------------------------------------------------
// Roles — from user_role cookie set on login (see api/auth/route.ts)
// ---------------------------------------------------------------------------
export type UserRole = 'admin' | 'client' | 'broker'

// ---------------------------------------------------------------------------
// Route item — single link in the nav
// ---------------------------------------------------------------------------
export interface NavRoute {
  href: string
  label: string
  icon: LucideIcon
  /** Only visible to these roles. Omit = visible to all. */
  roles?: UserRole[]
  /** @deprecated — use roles: ['broker'] instead */
  titoOnly?: boolean
}

// ---------------------------------------------------------------------------
// Dropdown group — top bar dropdown menu
// ---------------------------------------------------------------------------
export interface NavGroup {
  key: string
  label: string
  icon: LucideIcon
  roles?: UserRole[]
  children: NavRoute[]
}

// ---------------------------------------------------------------------------
// Top-level item (no accordion)
// ---------------------------------------------------------------------------
export interface NavTopLevel extends NavRoute {
  /** Gold accent treatment (CRUZ AI) */
  gold?: boolean
}

// ---------------------------------------------------------------------------
// INTERNAL NAV — admin role
// ---------------------------------------------------------------------------

export const INTERNAL_TOP: NavTopLevel[] = [
  { href: '/', label: 'Inicio', icon: LayoutDashboard },
]

export const INTERNAL_GROUPS: NavGroup[] = [
  {
    key: 'operaciones',
    label: 'Operaciones',
    icon: Truck,
    children: [
      { href: '/traficos',     label: 'Traficos',    icon: Truck },
      { href: '/entradas',     label: 'Entradas',    icon: Package },
      { href: '/bodega',       label: 'Bodega',      icon: Warehouse },
      { href: '/pedimentos',   label: 'Pedimentos',  icon: FileText },
      { href: '/expedientes',  label: 'Expedientes', icon: FolderOpen },
    ],
  },
  {
    key: 'inteligencia',
    label: 'Inteligencia',
    icon: BarChart3,
    children: [
      { href: '/reportes',     label: 'Reportes',    icon: BarChart3 },
      { href: '/cuentas',      label: 'Financiero',  icon: DollarSign },
      { href: '/proveedores',  label: 'Proveedores', icon: Users2 },
      { href: '/catalogo',     label: 'Catálogo',    icon: ClipboardList },
      { href: '/anexo24',      label: 'Anexo 24',    icon: BookOpen },
    ],
  },
  {
    key: 'cumplimiento',
    label: 'Cumplimiento',
    icon: Shield,
    children: [
      { href: '/mve',          label: 'MVE',         icon: Shield },
      { href: '/calendario',   label: 'Calendario',  icon: Calendar },
      { href: '/usmca',        label: 'USMCA',       icon: Award },
      { href: '/cruces',       label: 'Cruces',      icon: Clock },
      { href: '/auditoria',   label: 'Auditoría',   icon: History },
    ],
  },
]

export const INTERNAL_BOTTOM: NavTopLevel[] = [
  { href: '/broker', label: 'CRUZ', icon: MessageSquare, gold: true, roles: ['admin', 'broker'] },
  { href: '/admin',  label: 'Config', icon: Settings, roles: ['admin', 'broker'] },
]

// ---------------------------------------------------------------------------
// CLIENT NAV — client role (8 items visible to clients)
// ---------------------------------------------------------------------------

export const CLIENT_NAV: NavTopLevel[] = [
  { href: '/',             label: 'Inicio',       icon: LayoutDashboard },
  { href: '/traficos',     label: 'Tráficos',     icon: Truck },
  { href: '/entradas',     label: 'Entradas',     icon: Package },
  { href: '/pedimentos',   label: 'Pedimentos',   icon: FileText },
  { href: '/documentos',   label: 'Documentos',   icon: FolderOpen },
  { href: '/financiero',   label: 'Financiero',   icon: DollarSign },
  { href: '/proveedores',  label: 'Proveedores',  icon: Users2 },
  { href: '/cruz',         label: 'CRUZ AI',       icon: MessageSquare },
]

// ---------------------------------------------------------------------------
// CLIENT NAV GROUPS — client role (dropdown menus for sidebar)
// ---------------------------------------------------------------------------

export const CLIENT_GROUPS: NavGroup[] = [
  {
    key: 'operaciones',
    label: 'Operaciones',
    icon: Truck,
    children: [
      { href: '/traficos',    label: 'Tráficos',    icon: Truck },
      { href: '/entradas',    label: 'Entradas',    icon: Package },
      { href: '/pedimentos',  label: 'Pedimentos',  icon: FileText },
    ],
  },
  {
    key: 'documentos',
    label: 'Documentos',
    icon: FolderOpen,
    children: [
      { href: '/documentos',    label: 'Documentos',   icon: FolderOpen },
      { href: '/expedientes',   label: 'Expedientes',  icon: FolderOpen },
    ],
  },
  {
    key: 'costos',
    label: 'Costos',
    icon: DollarSign,
    children: [
      { href: '/financiero',    label: 'Financiero',    icon: DollarSign },
      { href: '/proveedores',   label: 'Proveedores',   icon: Users2 },
    ],
  },
]

// ---------------------------------------------------------------------------
// MOBILE BOTTOM NAV
// ---------------------------------------------------------------------------

export interface MobileTab {
  href: string
  label: string
  icon: LucideIcon | null
  /** Center Z-mark button */
  center?: boolean
}

export const MOBILE_INTERNAL_TABS: MobileTab[] = [
  { href: '/',           label: 'Inicio',        icon: LayoutDashboard },
  { href: '/traficos',   label: 'Operaciones',   icon: Truck },
  { href: '/broker',     label: 'CRUZ',          icon: null, center: true },
  { href: '/reportes',   label: 'Inteligencia',  icon: BarChart3 },
  { href: '/mve',        label: 'Mas',           icon: Settings },
]

export const MOBILE_CLIENT_TABS: MobileTab[] = [
  { href: '/',           label: 'Inicio',        icon: LayoutDashboard },
  { href: '/traficos',   label: 'Tráficos',      icon: Truck },
  { href: '/cruz',       label: 'CRUZ',          icon: null, center: true },
  { href: '/documentos', label: 'Documentos',    icon: FolderOpen },
  { href: '/financiero', label: 'Financiero',    icon: DollarSign },
]

// ---------------------------------------------------------------------------
// Route protection — used by middleware.ts
// ---------------------------------------------------------------------------

/** Routes that only admin/broker can access. Client hitting these → redirect to / */
export const ADMIN_ONLY_ROUTES = [
  '/admin',
  '/war-room',
  '/operaciones',
  '/radar',
  '/conocimiento',
  '/revenue',
  '/intelligence',
  '/demo',
  '/anexo24',
  '/mve',
  '/calendario',
  '/usmca',
  '/cuentas',
  '/cumplimiento',
  '/oca',
  '/drafts',
  '/carriers',
  '/prospectos',
  '/cotizacion',
  '/acciones',
  '/planeacion',
  '/comunicaciones',
  '/alertas',
  '/immex',
  '/soia',
  '/status',
  '/voz',
  '/calls',
  '/api-docs',
  '/documentos-legales',
  '/cruces',
  '/alertas-internas',
  '/auditoria',
] as const

/** Routes accessible by client role */
export const CLIENT_ROUTES = [
  '/',
  '/traficos',
  '/entradas',
  '/pedimentos',
  '/documentos',
  '/financiero',
  '/proveedores',
  '/reportes',
  '/expedientes',
  '/bodega',
  '/cruz',
  '/catalogo',
  '/login',
] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get all flat routes for a role (used for search/command palette filtering) */
export function getRoutesForRole(role: UserRole): NavRoute[] {
  if (role === 'client') {
    return CLIENT_GROUPS.flatMap(g => g.children)
  }

  const routes: NavRoute[] = [
    ...INTERNAL_TOP,
    ...INTERNAL_GROUPS.flatMap(g => g.children),
    ...INTERNAL_BOTTOM,
  ]
  return routes
}

/** Check if a path belongs to a nav group (for auto-expanding accordion) */
export function getActiveGroup(pathname: string, groups?: NavGroup[]): string | null {
  const searchGroups = groups ?? INTERNAL_GROUPS
  for (const group of searchGroups) {
    if (group.children.some(child =>
      child.href === '/' ? pathname === '/' : pathname.startsWith(child.href)
    )) {
      return group.key
    }
  }
  return null
}

/** Check if a route is allowed for a given role */
export function isRouteAllowed(pathname: string, role: UserRole): boolean {
  if (role === 'admin' || role === 'broker') return true

  // Client: check against allowed list
  return CLIENT_ROUTES.some(route =>
    route === '/' ? pathname === '/' : pathname.startsWith(route)
  )
}
