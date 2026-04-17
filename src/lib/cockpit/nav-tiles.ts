import { Truck, FileText, FolderOpen, Book, Package, BarChart3, ClipboardList } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * UI nav-tile union. The six canonical tiles are locked by invariant 29
 * (must be in UNIFIED_NAV_TILES, unchanged without Renato IV founder
 * sign-off — Tito advisory on business-side implications).
 *
 * Role-specific cockpits (trafico/bodega/contabilidad) populate extra
 * counts via additional keys below — these are NOT rendered as top-level
 * nav; they're extension slots for role-filtered counters.
 *
 * `reportes` key remains in the union for back-compat (old routes, old
 * role-filter code). The nav tile itself now renders as "Anexo 24" and
 * points at /anexo-24 — approved 2026-04-18 by Renato IV.
 */
export type NavTileKey =
  | 'traficos'
  | 'pedimentos'
  | 'expedientes'
  | 'catalogo'
  | 'entradas'
  | 'anexo24'
  | 'reportes'
  | 'clasificaciones'
  | 'facturas'
  | 'cartera'
  | 'bodega'

export interface NavTileDef {
  key: NavTileKey
  href: string
  label: string
  icon: LucideIcon
  description: string
}

/**
 * CRUZ v8 — the six cockpit nav tiles, locked.
 *
 * Identical order, labels, icons, descriptions across /inicio,
 * /operador/inicio, and /admin/eagle. Role decides what data
 * populates each card; role does NOT decide which cards appear.
 *
 * Changing this list requires Renato IV founder sign-off (Tito advisory
 * on business-side implications) per core-invariants rule 29.
 *
 * 2026-04-18 — tile #6 promoted from "Reportes" to "Anexo 24".
 * Anexo 24 (Formato 53 from GlobalPC.net) is the SAT-audit truth
 * document for IMMEX and the canonical product reference for every
 * merchandise name + part number + fraction rendered in CRUZ. Legacy
 * /reportes/** routes stay alive behind a 308 redirect for back-compat.
 *
 * BarChart3 import kept for back-compat references elsewhere; the tile
 * now ships with ClipboardList (inventory-control semantics).
 */
export const UNIFIED_NAV_TILES: readonly NavTileDef[] = [
  { key: 'traficos',    href: '/embarques',   label: 'Tráficos',     icon: Truck,          description: 'Operaciones activas' },
  { key: 'pedimentos',  href: '/pedimentos',  label: 'Pedimentos',   icon: FileText,       description: 'Declaraciones aduanales' },
  { key: 'expedientes', href: '/expedientes', label: 'Expedientes',  icon: FolderOpen,     description: 'Documentos por operación' },
  { key: 'catalogo',    href: '/catalogo',    label: 'Catálogo',     icon: Book,           description: 'Partes e historial' },
  { key: 'entradas',    href: '/entradas',    label: 'Entradas',     icon: Package,        description: 'Control de almacén' },
  { key: 'anexo24',     href: '/anexo-24',    label: 'Anexo 24',     icon: ClipboardList,  description: 'Control de inventario IMMEX' },
] as const

// Suppress unused-import warning — BarChart3 is retained for downstream
// consumers that still reference it (legacy components, operator extras).
void BarChart3

export interface NavCellData {
  count: number | null
  series: number[]
  /** Short secondary sentence rendered under the description (v8). */
  microStatus?: string
  /** Colors the microStatus amber when true — used for "N pendientes" signals. */
  microStatusWarning?: boolean
  /** Tiny muted parenthetical for lifetime/historical totals so the
   *  this-month metric keeps the headline position. Example:
   *  "(+214K en histórico)" on the Expedientes card. */
  historicMicrocopy?: string
  /** Optional suffix appended to the primary count (e.g. "%"). */
  countSuffix?: string
}

export type NavCounts = Partial<Record<NavTileKey, NavCellData>>

export const EMPTY_NAV_COUNTS: NavCounts = {
  traficos:    { count: null, series: [] },
  pedimentos:  { count: null, series: [] },
  expedientes: { count: null, series: [] },
  catalogo:    { count: null, series: [] },
  entradas:    { count: null, series: [] },
  anexo24:     { count: null, series: [] },
  // Kept for back-compat — legacy consumers still pass `reportes` counts
  // through NavCounts even though the tile no longer renders. Safe no-op.
  reportes:    { count: null, series: [] },
}
