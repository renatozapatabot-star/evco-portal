import {
  LayoutDashboard, Truck, FileText, FolderOpen,
  BarChart3, DollarSign, Users2, BookOpen,
  Shield, Calendar, Award,
  Settings, Package,
  History, Clock, ClipboardList,
  Warehouse, Bot, Rocket, Tags, Layers, TrendingUp, Search,
  Mail, FileEdit, Activity, Radio, Phone, Code, Briefcase, Mic, Brain,
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
      { href: '/launchpad',      label: 'Launchpad',      icon: Rocket },
      { href: '/war-room',       label: 'War Room',       icon: Radio },
      { href: '/clasificar',     label: 'Clasificar',     icon: Tags },
      { href: '/lotes',          label: 'Lotes',          icon: Layers },
      { href: '/traficos',       label: 'Tráficos',       icon: Truck },
      { href: '/entradas',       label: 'Entradas',       icon: Package },
      { href: '/bodega',         label: 'Inventario',     icon: Warehouse },
      { href: '/pedimentos',     label: 'Pedimentos',     icon: FileText },
      { href: '/expedientes',    label: 'Expedientes',    icon: FolderOpen },
      { href: '/archivos',       label: 'Archivos',       icon: FolderOpen },
      { href: '/drafts',         label: 'Borradores',     icon: FileEdit },
      { href: '/comunicaciones', label: 'Comunicaciones',  icon: Mail },
      { href: '/acciones',       label: 'Acciones',       icon: Activity },
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
      { href: '/agente',       label: 'CRUZ Agent',  icon: Bot },
      { href: '/cerebro',      label: 'Cerebro',     icon: Brain },
      { href: '/predicciones', label: 'Predicciones', icon: BarChart3 },
      { href: '/inventario',   label: 'Inv. Inteligente', icon: TrendingUp },
      { href: '/excepciones',  label: 'Excepciones',  icon: Search },
      { href: '/ahorro',       label: 'Ahorro',       icon: DollarSign },
      { href: '/negociacion',  label: 'Negociación',  icon: Users2 },
      { href: '/plantillas-doc', label: 'Red Docs', icon: FileText },
      { href: '/inteligencia-competitiva', label: 'Competencia', icon: BarChart3 },
      { href: '/simulador',    label: 'Simulador',    icon: BarChart3 },
      { href: '/soia',          label: 'SOIA Cruces',  icon: Clock },
      { href: '/radar',         label: 'Radar',        icon: BarChart3 },
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
      { href: '/riesgo-auditoria', label: 'Riesgo SAT', icon: Shield },
    ],
  },
  {
    key: 'ventas',
    label: 'Ventas',
    icon: Briefcase,
    children: [
      { href: '/prospectos',   label: 'Prospectos',   icon: Users2 },
      { href: '/cotizacion',   label: 'Cotización',   icon: DollarSign },
      { href: '/facturacion',  label: 'Facturación',  icon: FileText },
    ],
  },
]

export const INTERNAL_BOTTOM: NavTopLevel[] = [
  { href: '/voz',          label: 'Voz',          icon: Mic, roles: ['admin', 'broker'] },
  { href: '/rentabilidad', label: 'Rentabilidad', icon: DollarSign, roles: ['admin'] },
  { href: '/admin',        label: 'Config',       icon: Settings, roles: ['admin', 'broker'] },
]

// ---------------------------------------------------------------------------
// CLIENT NAV — client role (8 items visible to clients)
// ---------------------------------------------------------------------------

export const CLIENT_NAV: NavTopLevel[] = [
  { href: '/',             label: 'Inicio',               icon: LayoutDashboard },
  { href: '/traficos',     label: 'Tráficos',             icon: Truck },
  { href: '/entradas',     label: 'Entradas',             icon: Package },
  { href: '/pedimentos',   label: 'Pedimentos',           icon: FileText },
  { href: '/expedientes',  label: 'Expedientes Digitales', icon: FolderOpen },
  { href: '/bodega',       label: 'Inventario',           icon: Warehouse },
  { href: '/reportes',     label: 'Reportes',             icon: BarChart3 },
  { href: '/financiero',   label: 'Financiero',           icon: DollarSign },
  { href: '/documentos',   label: 'Documentos',           icon: FolderOpen },
]

// ---------------------------------------------------------------------------
// CLIENT NAV GROUPS — client role (dropdown menus for sidebar)
// ---------------------------------------------------------------------------

export const CLIENT_GROUPS: NavGroup[] = []

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
  { href: '/reportes',   label: 'Inteligencia',  icon: BarChart3 },
  { href: '/mve',        label: 'Cumplimiento',  icon: Shield },
  { href: '/admin',      label: 'Config',        icon: Settings },
]

export const MOBILE_CLIENT_TABS: MobileTab[] = [
  { href: '/',           label: 'Inicio',        icon: LayoutDashboard },
  { href: '#cruz-ai',    label: '',              icon: null, center: true },
  { href: '#buscar',     label: 'Buscar',        icon: Search },
]

// ---------------------------------------------------------------------------
// Route protection — used by middleware.ts
// ---------------------------------------------------------------------------

/** Routes that only admin/broker can access. Client hitting these → redirect to / */
export const ADMIN_ONLY_ROUTES = [
  '/admin',
  '/launchpad',
  '/clasificar',
  '/lotes',
  '/war-room',
  '/operaciones',
  '/radar',
  '/conocimiento',
  '/revenue',
  '/intelligence',
  '/demo',
  '/mve',
  '/calendario',
  '/usmca',
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
  '/agente',
  '/cerebro',
  '/predicciones',
  '/inventario',
  '/excepciones',
  '/riesgo-auditoria',
  '/ahorro',
  '/negociacion',
  '/plantillas-doc',
  '/inteligencia-competitiva',
  '/simulador',
  '/archivos',
  '/operador',
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
  '/catalogo',
  '/anexo24',
  '/exportar',
  '/bienvenida',
  '/facturacion',
  '/noticias',
  '/analytics',
  '/mensajes',
  '/actividad',
  '/logros',
  '/login',
] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get all flat routes for a role (used for search/command palette filtering) */
export function getRoutesForRole(role: UserRole): NavRoute[] {
  if (role === 'client') {
    return CLIENT_NAV
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
