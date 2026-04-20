import { Truck, FileText, FolderOpen, Book, Package, BarChart3, ClipboardList, Receipt } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * UI nav-tile union. Six canonical tiles, post-founder-override 2026-04-19
 * (tile #2 promoted from "Pedimentos" to "Contabilidad" per the active
 * override in `.claude/rules/founder-overrides.md`). Changing the list
 * requires Renato IV founder sign-off (recorded in the override log) —
 * the invariant is no longer "tile list frozen" but "tile list governed
 * by the override log".
 *
 * Role-specific cockpits (trafico/bodega/contabilidad) populate extra
 * counts via additional keys below — these are NOT rendered as top-level
 * nav; they're extension slots for role-filtered counters.
 *
 * `reportes` and `pedimentos` keys remain in the union for back-compat
 * (old routes, old role-filter code, /pedimentos deep-links). The
 * `pedimentos` tile itself is retired from the nav grid but the route
 * stays live — reachable via CruzCommand, CRUZ AI tools, and deep links.
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
 * Six cockpit nav tiles — post-override 2026-04-19.
 *
 * Identical order, labels, icons, descriptions across /inicio,
 * /operador/inicio, /admin/eagle. Role decides the counts; role does
 * NOT decide which cards appear.
 *
 * Tile #2 = Contabilidad — routes to `/mi-cuenta` for clients (their
 * own A/R per `client-accounting-ethics.md`) and `/contabilidad/inicio`
 * for operator + owner (Anabel's broker cockpit). Resolve via
 * `resolveNavHref(tile, role)`.
 *
 * Legacy /pedimentos/** routes stay alive behind deep-link access for
 * back-compat. Tile #6 remains Anexo 24 (SAT-audit truth document).
 */
export const UNIFIED_NAV_TILES: readonly NavTileDef[] = [
  { key: 'traficos',     href: '/embarques',          label: 'Tráficos',     icon: Truck,          description: 'Operaciones activas' },
  { key: 'contabilidad', href: '/contabilidad/inicio', label: 'Contabilidad', icon: Receipt,        description: 'Saldo y facturas' },
  { key: 'expedientes',  href: '/expedientes',        label: 'Expedientes',  icon: FolderOpen,     description: 'Documentos por operación' },
  { key: 'catalogo',     href: '/catalogo',           label: 'Catálogo',     icon: Book,           description: 'Partes e historial' },
  { key: 'entradas',     href: '/entradas',           label: 'Entradas',     icon: Package,        description: 'Control de almacén' },
  { key: 'anexo24',      href: '/anexo-24',           label: 'Anexo 24',     icon: ClipboardList,  description: 'Control de inventario IMMEX' },
] as const

/**
 * Resolve the href for a nav tile given a role. Client role sees their
 * own A/R at /mi-cuenta (gated by NEXT_PUBLIC_MI_CUENTA_ENABLED); every
 * other role routes to the broker cockpit.
 *
 * When the client flag is OFF, the Contabilidad tile for clients routes
 * to /pedimentos — the pre-2026-04-19 destination — so Ursula's click
 * still lands on a usable surface instead of a redirect loop.
 */
export function resolveNavHref(tile: NavTileDef, role: NavRole): string {
  if (tile.key === 'contabilidad' && role === 'client') {
    const clientEnabled = process.env.NEXT_PUBLIC_MI_CUENTA_ENABLED === 'true'
    return clientEnabled ? '/mi-cuenta' : '/pedimentos'
  }
  return tile.href
}

/**
 * Returns a possibly-relabelled tile for a given role + env flag state.
 *
 * Contract: when a client lands on the Contabilidad tile AND the
 * NEXT_PUBLIC_MI_CUENTA_ENABLED flag is OFF, the tile renders AS
 * "Pedimentos" (the pre-override label/icon/description + route) so the
 * pre-flag UX is 100% preserved for clients. When the flag is ON, or
 * for non-client roles, the tile renders normally as Contabilidad.
 *
 * This is the integration point the approval gate rides on: Tito flips
 * the flag after walking through /mi-cuenta on preview, and clients
 * see the change only once approval has landed.
 */
export function resolveNavTile(tile: NavTileDef, role: NavRole): NavTileDef {
  if (tile.key !== 'contabilidad' || role !== 'client') return tile
  const clientEnabled = process.env.NEXT_PUBLIC_MI_CUENTA_ENABLED === 'true'
  if (clientEnabled) return tile
  return {
    key: tile.key,
    href: '/pedimentos',
    label: 'Pedimentos',
    icon: FileText,
    description: 'Declaraciones aduanales',
  }
}

// Suppress unused-import warnings — retained for downstream consumers
// that still reference these by name (legacy components, operator extras).
void BarChart3
void FileText

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
