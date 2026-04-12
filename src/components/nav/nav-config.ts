import {
  LayoutDashboard, Truck, FileText, FolderOpen,
  BarChart3, DollarSign, Users2, BookOpen,
  Shield, Settings, Package,
  Warehouse, TrendingUp, Radio, Brain,
  FileSpreadsheet, ScanLine,
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
  { href: '/admin/inicio', label: 'Inicio', icon: LayoutDashboard },
]

// V1 nav (Phase 4 cull) — admin/broker see operator surfaces + admin-only extras.
// Non-V1 routes (launchpad, war-room, agente, cerebro, clasificar, lotes, rentabilidad,
// cuentas, financiero, fracciones, inteligencia, predicciones, acciones, cotizacion,
// prospectos, comunicaciones, cruces, auditoria, riesgo-auditoria, usmca, ahorro, drafts,
// catalogo, proveedores) are hidden from nav but remain reachable by direct URL.
export const INTERNAL_GROUPS: NavGroup[] = [
  {
    key: 'operaciones',
    label: 'Operaciones',
    icon: Truck,
    children: [
      { href: '/traficos',        label: 'Tráficos',            icon: Truck },
      { href: '/pedimentos',      label: 'Pedimentos',          icon: FileText },
      { href: '/banco-facturas',  label: 'Banco de facturas',   icon: FileSpreadsheet },
      { href: '/corredor',        label: 'Corredor',            icon: Radio },
    ],
  },
  {
    key: 'cumplimiento',
    label: 'Cumplimiento',
    icon: Shield,
    children: [
      { href: '/mve/alerts', label: 'MVE',      icon: Shield },
      { href: '/reportes',   label: 'Reportes', icon: BarChart3 },
    ],
  },
  {
    key: 'administracion',
    label: 'Administración',
    icon: Settings,
    roles: ['admin', 'broker'],
    children: [
      { href: '/admin/shadow',             label: 'Shadow',            icon: Brain,           roles: ['admin', 'broker'] },
      { href: '/admin/carriers',           label: 'Transportistas',    icon: Truck,           roles: ['admin', 'broker'] },
      { href: '/admin/quickbooks-export',  label: 'Exportar QuickBooks', icon: FileSpreadsheet, roles: ['admin', 'broker'] },
      { href: '/clientes',                 label: 'Clientes',          icon: Users2,          roles: ['admin', 'broker'] },
    ],
  },
]

export const INTERNAL_BOTTOM: NavTopLevel[] = [
  { href: '/admin',        label: 'Config',       icon: Settings, roles: ['admin', 'broker'] },
]

// ---------------------------------------------------------------------------
// CLIENT NAV — client role (8 items visible to clients)
// ---------------------------------------------------------------------------

// V1 client nav (Phase 4 cull) — 7 items. Non-V1 (/entradas, /catalogo, /solicitar,
// /clasificar-producto, /ahorro) remain reachable by direct URL.
export const CLIENT_NAV: NavTopLevel[] = [
  { href: '/',                  label: 'Inicio',        icon: LayoutDashboard },
  { href: '/traficos',          label: 'Tráficos',      icon: Truck },
  { href: '/pedimentos',        label: 'Pedimentos',    icon: FileText },
  { href: '/reportes',          label: 'Reportes',      icon: BarChart3 },
  { href: '/reportes/anexo-24', label: 'Anexo 24',      icon: FileSpreadsheet },
  { href: '/expedientes',       label: 'Expedientes',   icon: FolderOpen },
  { href: '/kpis',              label: "KPI's",         icon: TrendingUp },
]

// ---------------------------------------------------------------------------
// CLIENT NAV GROUPS — client role (dropdown menus for sidebar)
// ---------------------------------------------------------------------------

export const CLIENT_GROUPS: NavGroup[] = []

// ---------------------------------------------------------------------------
// OPERATOR NAV — slim workflow-focused nav (no financials)
// ---------------------------------------------------------------------------

// V1 operator nav (Phase 4 cull) — 7 items.
export const OPERATOR_NAV: NavTopLevel[] = [
  { href: '/operador/inicio', label: 'Inicio',             icon: LayoutDashboard },
  { href: '/traficos',        label: 'Tráficos',           icon: Truck },
  { href: '/pedimentos',      label: 'Pedimentos',         icon: FileText },
  { href: '/banco-facturas',  label: 'Banco de facturas',  icon: FileSpreadsheet },
  { href: '/corredor',        label: 'Corredor',           icon: Radio },
  { href: '/mve/alerts',      label: 'MVE',                icon: Shield },
  { href: '/reportes',        label: 'Reportes',           icon: BarChart3 },
]

export const OPERATOR_GROUPS: NavGroup[] = []

// ---------------------------------------------------------------------------
// WAREHOUSE NAV — warehouse role (Vicente). Cockpit pages added in later commits.
// ---------------------------------------------------------------------------

// V1 warehouse nav (Phase 4 cull) — 4 items.
export const WAREHOUSE_NAV: NavTopLevel[] = [
  { href: '/bodega/inicio',   label: 'Inicio',    icon: LayoutDashboard },
  { href: '/bodega/recibir',  label: 'Recibir',   icon: Package },
  { href: '/bodega/escanear', label: 'Escanear',  icon: ScanLine },
  { href: '/bodega/patio',    label: 'Patio',     icon: Warehouse },
  { href: '/bodega/ayuda',    label: 'Ayuda',     icon: BookOpen },
]

export const WAREHOUSE_GROUPS: NavGroup[] = []

// ---------------------------------------------------------------------------
// CONTABILIDAD NAV — contabilidad role (Anabel). Cockpit pages added in later commits.
// ---------------------------------------------------------------------------

// V1 contabilidad nav (Phase 4 cull) — 5 items.
export const CONTABILIDAD_NAV: NavTopLevel[] = [
  { href: '/contabilidad',          label: 'Inicio',       icon: LayoutDashboard },
  { href: '/facturacion',           label: 'Facturación',  icon: FileText },
  { href: '/cobranzas',             label: 'Cobranzas',    icon: DollarSign },
  { href: '/pagos',                 label: 'Pagos',        icon: DollarSign },
  { href: '/contabilidad/exportar',   label: 'Exportar',            icon: FileSpreadsheet },
  { href: '/admin/quickbooks-export', label: 'Exportar QuickBooks', icon: FileSpreadsheet },
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
  { href: '/admin/inicio', label: 'Inicio',       icon: LayoutDashboard },
  { href: '/traficos',     label: 'Tráficos',     icon: Truck },
  { href: '/pedimentos',   label: 'Pedimentos',   icon: FileText },
  { href: '/mve/alerts',   label: 'MVE',          icon: Shield },
  { href: '/reportes',     label: 'Reportes',     icon: BarChart3 },
]

export const MOBILE_CLIENT_TABS: MobileTab[] = [
  { href: '/',            label: 'Inicio',      icon: LayoutDashboard },
  { href: '/traficos',    label: 'Tráficos',    icon: Truck },
  { href: '/pedimentos',  label: 'Pedimentos',  icon: FileText },
  { href: '/reportes',    label: 'Reportes',    icon: BarChart3 },
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
