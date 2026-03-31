import {
  LayoutDashboard, Truck, FileText, FolderOpen,
  BarChart3, DollarSign, Users2, BookOpen,
  Shield, Calendar, Award,
  Settings, MessageSquare, Package,
  History, Archive, Clock, ClipboardList, Receipt, Send, Phone,
  Warehouse,
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
    ],
  },
]

export const INTERNAL_BOTTOM: NavTopLevel[] = [
  { href: '/broker', label: 'CRUZ', icon: MessageSquare, gold: true, roles: ['admin', 'broker'] },
  { href: '/admin',  label: 'Config', icon: Settings, roles: ['admin', 'broker'] },
]

// ---------------------------------------------------------------------------
// CLIENT NAV — client role (4 items, no accordions)
// ---------------------------------------------------------------------------

export const CLIENT_NAV: NavTopLevel[] = [
  { href: '/',           label: 'Inicio',        icon: LayoutDashboard },
  { href: '/traficos',   label: 'Mis Embarques', icon: Truck },
  { href: '/documentos', label: 'Documentos',    icon: FolderOpen },
  { href: '/reportes',   label: 'Reportes',      icon: BarChart3 },
]

// ---------------------------------------------------------------------------
// CLIENT NAV GROUPS — client role (dropdown menus, same as admin structure)
// ---------------------------------------------------------------------------

export const CLIENT_GROUPS: NavGroup[] = [
  {
    key: 'operaciones',
    label: 'Operaciones',
    icon: Truck,
    children: [
      { href: '/traficos',    label: 'Tráficos Activos', icon: Truck },
      { href: '/historial',   label: 'Historial',        icon: History },
      { href: '/entradas',    label: 'Entradas',         icon: Package },
      { href: '/calendario',  label: 'Calendario',       icon: Calendar },
    ],
  },
  {
    key: 'documentos',
    label: 'Documentos',
    icon: FolderOpen,
    children: [
      { href: '/expedientes',            label: 'Por Tráfico',  icon: FolderOpen },
      { href: '/documentos',             label: 'Repositorio',  icon: Archive },
      { href: '/documentos/pendientes',  label: 'Pendientes',   icon: Clock },
      { href: '/documentos/plantillas',  label: 'Plantillas',   icon: ClipboardList },
    ],
  },
  {
    key: 'costos',
    label: 'Costos',
    icon: DollarSign,
    children: [
      { href: '/financiero',      label: 'Resumen de Cuenta', icon: DollarSign },
      { href: '/pedimentos',      label: 'Por Pedimento',     icon: FileText },
      { href: '/reportes/usmca',  label: 'Ahorros USMCA',    icon: Award },
      { href: '/facturas',        label: 'Facturas',          icon: Receipt },
    ],
  },
  {
    key: 'cumplimiento',
    label: 'Cumplimiento',
    icon: Shield,
    children: [
      { href: '/cumplimiento', label: 'Cumplimiento', icon: Shield },
    ],
  },
  {
    key: 'soporte',
    label: 'Soporte',
    icon: MessageSquare,
    children: [
      { href: '/comunicaciones', label: 'Mensajes',     icon: MessageSquare },
      { href: '/solicitudes',    label: 'Solicitudes',  icon: Send },
      { href: '/contacto',       label: 'Contacto',     icon: Phone },
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
  { href: '/traficos',   label: 'Embarques',     icon: Truck },
  { href: '/cruz',       label: 'CRUZ',          icon: null, center: true },
  { href: '/documentos', label: 'Documentos',    icon: FolderOpen },
  { href: '/reportes',   label: 'Reportes',      icon: BarChart3 },
]

// ---------------------------------------------------------------------------
// Route protection — used by middleware.ts
// ---------------------------------------------------------------------------

/** Routes that only admin can access. Client hitting these → redirect to / */
export const ADMIN_ONLY_ROUTES = [
  '/admin',
  '/war-room',
  '/operaciones',
  '/radar',
  '/conocimiento',
  '/revenue',
  '/entradas',
  '/pedimentos',
  '/expedientes',
  '/proveedores',
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
  '/voz',
  '/calls',
  '/api-docs',
] as const

/** Routes accessible by client role */
export const CLIENT_ROUTES = [
  '/',
  '/traficos',
  '/documentos',
  '/reportes',
  '/bodega',
  '/cruz',
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
