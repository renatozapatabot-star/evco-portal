import { Truck, FileText, FolderOpen, Book, Package, BarChart3, ClipboardList, Receipt } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * UI nav-tile union. Five-tile V1 Clean Visibility layout per founder
 * override 2026-04-24. Client cockpit renders Entradas · Pedimentos ·
 * Expediente · Catálogo · Anexo 24. Contabilidad removed from client
 * nav (reachable by operator from /operador/inicio). Embarques reachable
 * by cross-link only from the three core surfaces.
 *
 * Keys kept in the union for back-compat (legacy counts, role-filter
 * code, deep links): `traficos`, `contabilidad`, `expedientes`, `reportes`,
 * `clasificaciones`, `facturas`, `cartera`, `bodega`.
 */
export type NavTileKey =
  | 'traficos'
  | 'pedimentos'
  | 'contabilidad'
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
  /** Default href — may be overridden per-role via `resolveNavHref`. */
  href: string
  label: string
  icon: LucideIcon
  description: string
}

/** Role tags the cockpit composes for. Kept loose to avoid a UI→lib import. */
export type NavRole = 'client' | 'operator' | 'owner' | 'admin' | 'broker' | string

/**
 * Five cockpit nav tiles — V1 Clean Visibility (2026-04-24).
 *
 * Client cockpit renders these five. Operator/owner cockpits compose
 * from the same array but have additional deep-link access (via
 * `/operador/inicio`) to Contabilidad, Embarques, and internal queues.
 *
 * Order matters — ranked by daily-use frequency for the shipper:
 *   1. Entradas        — "did my merchandise arrive?"
 *   2. Pedimentos      — "did it clear customs?"
 *   3. Expediente      — "what PDFs are on file?"
 *   4. Catálogo        — "what parts / fractions are we on?"
 *   5. Anexo 24        — "IMMEX inventory proof"
 *
 * Embarques is NOT a tile — reachable only via cross-link from the
 * three core surfaces (a trafico is the parent record, not a primary
 * lookup key for the shipper).
 */
export const UNIFIED_NAV_TILES: readonly NavTileDef[] = [
  { key: 'entradas',     href: '/entradas',     label: 'Entradas',           icon: Package,        description: 'Llegadas al almacén' },
  { key: 'pedimentos',   href: '/pedimentos',   label: 'Pedimentos',         icon: FileText,       description: 'Declaraciones aduanales' },
  { key: 'expedientes',  href: '/expedientes',  label: 'Expediente Digital', icon: FolderOpen,     description: 'PDFs por operación' },
  { key: 'catalogo',     href: '/catalogo',     label: 'Catálogo',           icon: Book,           description: 'Partes y fracciones' },
  { key: 'anexo24',      href: '/anexo-24',     label: 'Anexo 24',           icon: ClipboardList,  description: 'Control IMMEX' },
] as const

/**
 * Resolve the href for a nav tile given a role. V1 Clean Visibility
 * uses the tile's declared href unconditionally — no role-aware
 * remapping remains after the 2026-04-24 reset. Signature preserved
 * for back-compat with existing callers.
 */
export function resolveNavHref(tile: NavTileDef, _role: NavRole): string {
  return tile.href
}

/**
 * Returns the tile as-declared. Signature preserved for back-compat;
 * role-aware relabelling was retired with the V1 reset (2026-04-24).
 */
export function resolveNavTile(tile: NavTileDef, _role: NavRole): NavTileDef {
  return tile
}

// Suppress unused-import warnings — retained for downstream consumers
// that still reference these by name (legacy components, operator extras).
void BarChart3
void Truck
void Receipt

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
  traficos:      { count: null, series: [] },
  contabilidad:  { count: null, series: [] },
  expedientes:   { count: null, series: [] },
  catalogo:      { count: null, series: [] },
  entradas:      { count: null, series: [] },
  anexo24:       { count: null, series: [] },
  // Back-compat — legacy consumers still pass `pedimentos` + `reportes`
  // counts through NavCounts even though the tiles no longer render.
  // Safe no-op; removing these keys would break unrelated call sites.
  pedimentos:    { count: null, series: [] },
  reportes:      { count: null, series: [] },
}
