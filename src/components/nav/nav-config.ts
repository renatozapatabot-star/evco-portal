import {
  LayoutDashboard, Truck, FileText, FolderOpen,
  BarChart3, DollarSign, Users2, BookOpen,
  Shield, Calendar, Award,
  Settings, Package,
  History, Clock, ClipboardList,
  Warehouse, Bot, Rocket, Tags, Layers, TrendingUp, Search,
  Mail, FileEdit, Activity, Radio, Phone, Code, Briefcase, Mic, Brain,
  FileSpreadsheet, Ship,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ---------------------------------------------------------------------------
// Roles — from user_role cookie set on login (see api/auth/route.ts)
// ---------------------------------------------------------------------------
export type UserRole = 'admin' | 'client' | 'broker' | 'operator' | 'warehouse' | 'contabilidad'

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
  /** Gold accent treatment (ADUANA AI) */
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
      { href: '/traficos',       label: 'Tráficos',       icon: Truck },
      { href: '/entradas',       label: 'Entradas',       icon: Package },
      { href: '/pedimentos',     label: 'Pedimentos',     icon: FileText },
      { href: '/expedientes',    label: 'Expedientes',    icon: FolderOpen },
      { href: '/bodega',         label: 'Inventario',     icon: Warehouse },
      { href: '/drafts',         label: 'Borradores',     icon: FileEdit },
      { href: '/lotes',          label: 'Lotes',          icon: Layers },
    ],
  },
  {
    key: 'finanzas',
    label: 'Finanzas',
    icon: DollarSign,
    children: [
      { href: '/cuentas',       label: 'Cuentas',       icon: DollarSign },
      { href: '/financiero',    label: 'Contabilidad',  icon: DollarSign },
      { href: '/reportes',      label: 'Reportes',      icon: BarChart3 },
      { href: '/rentabilidad',  label: 'Rentabilidad',  icon: TrendingUp },
      { href: '/facturacion',   label: 'Facturación',   icon: FileText },
    ],
  },
  {
    key: 'inteligencia',
    label: 'Inteligencia',
    icon: BarChart3,
    children: [
      { href: '/agente',        label: 'AGUILA Agent',     icon: Bot },
      { href: '/cerebro',       label: 'Cerebro',        icon: Brain },
      { href: '/clasificar',    label: 'Clasificar',     icon: Tags },
      { href: '/fracciones',    label: 'Fracciones',     icon: Search },
      { href: '/inteligencia',  label: 'Inteligencia',   icon: TrendingUp },
      { href: '/predicciones',  label: 'Predicciones',   icon: BarChart3 },
      { href: '/proveedores',   label: 'Proveedores',    icon: Users2 },
      { href: '/catalogo',      label: 'Catálogo',       icon: ClipboardList },
      { href: '/ahorro',        label: 'Ahorro T-MEC',   icon: DollarSign },
    ],
  },
  {
    key: 'cumplimiento',
    label: 'Cumplimiento',
    icon: Shield,
    children: [
      { href: '/mve',              label: 'MVE',          icon: Shield },
      { href: '/usmca',            label: 'USMCA',        icon: Award },
      { href: '/cruces',           label: 'Cruces',       icon: Clock },
      { href: '/auditoria',        label: 'Auditoría',    icon: History },
      { href: '/riesgo-auditoria', label: 'Riesgo SAT',   icon: Shield },
      { href: '/anexo24',          label: 'Anexo 24',      icon: BookOpen },
    ],
  },
  {
    key: 'ventas',
    label: 'Ventas',
    icon: Briefcase,
    children: [
      { href: '/prospectos',   label: 'Prospectos',   icon: Users2 },
      { href: '/cotizacion',   label: 'Cotización',   icon: DollarSign },
    ],
  },
  {
    key: 'centro',
    label: 'Centro de Mando',
    icon: Radio,
    children: [
      { href: '/launchpad',      label: 'Launchpad',      icon: Rocket },
      { href: '/war-room',       label: 'War Room',       icon: Radio },
      { href: '/comunicaciones', label: 'Comunicaciones',  icon: Mail },
      { href: '/acciones',       label: 'Acciones',       icon: Activity },
      { href: '/operador',       label: 'Operador',       icon: Users2 },
    ],
  },
]

export const INTERNAL_BOTTOM: NavTopLevel[] = [
  { href: '/voz',          label: 'Voz',          icon: Mic, roles: ['admin', 'broker'] },
  { href: '/admin',        label: 'Config',       icon: Settings, roles: ['admin', 'broker'] },
]

// ---------------------------------------------------------------------------
// CLIENT NAV — client role (8 items visible to clients)
// ---------------------------------------------------------------------------

export const CLIENT_NAV: NavTopLevel[] = [
  { href: '/',             label: 'Inicio',               icon: LayoutDashboard },
  { href: '/entradas',     label: 'Entradas',             icon: Package },
  { href: '/traficos',     label: 'Tráficos',             icon: Truck },
  { href: '/pedimentos',   label: 'Pedimentos',           icon: FileText },
  { href: '/catalogo',     label: 'Tráficos Recientes',   icon: ClipboardList },
  { href: '/anexo24',      label: 'Anexo 24',             icon: FileSpreadsheet },
  { href: '/expedientes',  label: 'Expedientes Digitales', icon: FolderOpen },
  { href: '/reportes',     label: 'Reportes',             icon: BarChart3 },
  { href: '/kpis',         label: "KPI's",                icon: TrendingUp },
  { href: '/solicitar',    label: 'Solicitar Embarque',    icon: Ship },
  { href: '/clasificar-producto', label: 'Clasificar Producto', icon: Tags },
  { href: '/ahorro',       label: 'Ahorro',               icon: DollarSign },
]

// ---------------------------------------------------------------------------
// CLIENT NAV GROUPS — client role (dropdown menus for sidebar)
// ---------------------------------------------------------------------------

export const CLIENT_GROUPS: NavGroup[] = []

// ---------------------------------------------------------------------------
// OPERATOR NAV — slim workflow-focused nav (no financials)
// ---------------------------------------------------------------------------

export const OPERATOR_NAV: NavTopLevel[] = [
  { href: '/',             label: 'Mi Turno',         icon: LayoutDashboard },
  { href: '/traficos',     label: 'Tráficos',         icon: Truck },
  { href: '/entradas',     label: 'Entradas',         icon: Package },
  { href: '/pedimentos',   label: 'Pedimentos',       icon: FileText },
  { href: '/expedientes',  label: 'Expedientes',      icon: FolderOpen },
  { href: '/clasificar',   label: 'Clasificar',       icon: Tags },
  { href: '/bodega',       label: 'Inventario',       icon: Warehouse },
]

export const OPERATOR_GROUPS: NavGroup[] = []

// ---------------------------------------------------------------------------
// WAREHOUSE NAV — warehouse role (Vicente). Cockpit pages added in later commits.
// ---------------------------------------------------------------------------

export const WAREHOUSE_NAV: NavTopLevel[] = [
  { href: '/bodega/inicio',  label: 'Inicio',   icon: LayoutDashboard },
  { href: '/entradas',       label: 'Entradas', icon: Package },
  { href: '/bodega/subir',   label: 'Subir',    icon: FileEdit },
  { href: '/buscar',         label: 'Buscar',   icon: Search },
]

export const WAREHOUSE_GROUPS: NavGroup[] = []

// ---------------------------------------------------------------------------
// CONTABILIDAD NAV — contabilidad role (Anabel). Cockpit pages added in later commits.
// ---------------------------------------------------------------------------

export const CONTABILIDAD_NAV: NavTopLevel[] = [
  { href: '/contabilidad/inicio', label: 'Inicio',       icon: LayoutDashboard },
  { href: '/facturacion',         label: 'Facturación',  icon: FileText },
  { href: '/cobranzas',           label: 'Cobranzas',    icon: DollarSign },
  { href: '/pagos',               label: 'Pagos',        icon: DollarSign },
]

export const CONTABILIDAD_GROUPS: NavGroup[] = []

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
  { href: '/entradas',   label: 'Entradas',      icon: Package },
  { href: '/traficos',   label: 'Tráficos',      icon: Truck },
  { href: '/reportes',   label: 'Reportes',      icon: BarChart3 },
]

// ---------------------------------------------------------------------------
// Route protection — used by middleware.ts
// ---------------------------------------------------------------------------

/** Routes that only admin/broker can access. Client hitting these → redirect to / */
export const ADMIN_ONLY_ROUTES = [
  '/admin',
  '/launchpad',
  '/clasificar',
  '/fracciones',
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
  '/cuentas',
  '/rentabilidad',
  '/resultados',
  '/garantia',
] as const

/** Routes accessible by client role */
export const CLIENT_ROUTES = [
  '/',
  '/entradas',
  '/traficos',
  '/pedimentos',
  '/catalogo',
  '/anexo24',
  '/expedientes',
  '/reportes',
  '/kpis',
  '/login',
  '/aduana',
  '/cambiar-contrasena',
  '/ahorro',
  '/solicitar',
  '/clasificar-producto',
] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get all flat routes for a role (used for search/command palette filtering) */
export function getRoutesForRole(role: UserRole): NavRoute[] {
  if (role === 'client') return CLIENT_NAV
  if (role === 'operator') return OPERATOR_NAV
  if (role === 'warehouse') return WAREHOUSE_NAV
  if (role === 'contabilidad') return CONTABILIDAD_NAV

  const routes: NavRoute[] = [
    ...INTERNAL_TOP,
    ...INTERNAL_GROUPS.flatMap(g => g.children),
    ...INTERNAL_BOTTOM,
  ]
  return routes
}

/**
 * Primary top-level nav items for a given role. Used by shells that render a
 * single flat nav (sidebar top list, mobile tabs). Admin/broker fall back to
 * INTERNAL_TOP; unknown roles default to the client nav (safest — minimal surface).
 */
export function getNavForRole(role: UserRole): NavTopLevel[] {
  switch (role) {
    case 'warehouse':
      return WAREHOUSE_NAV
    case 'contabilidad':
      return CONTABILIDAD_NAV
    case 'operator':
      return OPERATOR_NAV
    case 'client':
      return CLIENT_NAV
    case 'admin':
    case 'broker':
      return INTERNAL_TOP
    default:
      return CLIENT_NAV
  }
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

/** Routes accessible by operator role (no financials) */
export const OPERATOR_ROUTES = [
  '/',
  '/traficos',
  '/entradas',
  '/pedimentos',
  '/expedientes',
  '/clasificar',
  '/fracciones',
  '/bodega',
  '/login',
  '/aduana',
  '/cambiar-contrasena',
] as const

/** Check if a route is allowed for a given role */
export function isRouteAllowed(pathname: string, role: UserRole): boolean {
  if (role === 'admin' || role === 'broker') return true

  if (role === 'operator') {
    return OPERATOR_ROUTES.some(route =>
      route === '/' ? pathname === '/' : pathname.startsWith(route)
    )
  }

  // Client: check against allowed list
  return CLIENT_ROUTES.some(route =>
    route === '/' ? pathname === '/' : pathname.startsWith(route)
  )
}
