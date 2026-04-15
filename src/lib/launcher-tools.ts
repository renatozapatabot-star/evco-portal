/**
 * ZAPATA AI Launcher Tray — single source of truth for "tools" surfaced in
 * the top-nav `+` button. NOT navigation destinations (those live in
 * UNIFIED_NAV_TILES). These are actions: Subir, Clasificar, Exportar, etc.
 *
 * Adding a tool here automatically surfaces it in the LauncherTray with
 * proper role gating + count badge support.
 */

import {
  ScanLine,
  Upload,
  FileText,
  Calculator,
  FileSpreadsheet,
  BarChart3,
  FileSearch,
  Phone,
  Search,
  type LucideIcon,
} from 'lucide-react'

export type LauncherRole = 'admin' | 'broker' | 'operator' | 'warehouse' | 'contabilidad' | 'trafico' | 'client'

export interface LauncherTool {
  key: string
  label: string
  description: string
  href: string
  icon: LucideIcon
  /** Roles that can actually use this tool. Other roles see it grayed out. */
  roles: ReadonlyArray<LauncherRole>
  /**
   * Optional special-case action key. When set, clicking the tile fires a
   * client event instead of navigating — used for things like opening Cmd+K.
   */
  action?: 'open-search'
}

export const LAUNCHER_TOOLS: ReadonlyArray<LauncherTool> = [
  {
    key: 'clasificador',
    label: 'Clasificador',
    description: 'Sube · auto-clasifica · TIGIE',
    href: '/clasificador',
    icon: ScanLine,
    roles: ['admin', 'broker', 'operator', 'trafico'],
  },
  {
    key: 'subir',
    label: 'Subir documento',
    description: 'Asocia archivos al expediente',
    href: '/operador/subir',
    icon: Upload,
    roles: ['admin', 'broker', 'operator', 'trafico', 'warehouse'],
  },
  {
    key: 'oca',
    label: 'Generar OCA',
    description: 'Opinión de clasificación',
    href: '/oca/nuevo',
    icon: FileText,
    roles: ['admin', 'broker'],
  },
  {
    key: 'cotizacion',
    label: 'Cotización',
    description: 'Calcula DTA · IGI · IVA · USMCA',
    href: '/cotizacion',
    icon: Calculator,
    roles: ['admin', 'broker', 'operator', 'contabilidad'],
  },
  {
    key: 'anexo24',
    label: 'Anexo 24',
    description: 'Reporte IMMEX al SAT',
    href: '/reportes/anexo-24',
    icon: FileSpreadsheet,
    roles: ['admin', 'broker', 'contabilidad'],
  },
  {
    key: 'reportes',
    label: 'Reportes',
    description: 'Analítica y descargas',
    href: '/reportes',
    icon: BarChart3,
    roles: ['admin', 'broker', 'operator', 'contabilidad', 'client'],
  },
  {
    key: 'auditoria',
    label: 'Auditoría',
    description: 'Genera el PDF semanal',
    href: '/admin/auditoria/generar',
    icon: FileSearch,
    roles: ['admin', 'broker'],
  },
  {
    key: 'llamadas',
    label: 'Llamadas',
    description: 'Transcripciones y atenciones',
    href: '/calls',
    icon: Phone,
    roles: ['admin', 'broker', 'operator'],
  },
  {
    key: 'busqueda',
    label: 'Búsqueda avanzada',
    description: 'Cmd+K · embarques, pedimentos, partidas',
    href: '#',
    icon: Search,
    roles: ['admin', 'broker', 'operator', 'warehouse', 'contabilidad', 'trafico', 'client'],
    action: 'open-search',
  },
]

/** Counts surfaced as red-dot badges on each tool tile. Provided per-render. */
export interface LauncherCounts {
  clasificador?: number | null
  subir?: number | null
  oca?: number | null
  cotizacion?: number | null
  anexo24?: number | null
  reportes?: number | null
  auditoria?: number | null
  llamadas?: number | null
  busqueda?: number | null
}
