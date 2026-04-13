import { Truck, FileText, FolderOpen, Book, Package, Tags } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * UI nav-tile union. The six canonical tiles are locked by invariant 29
 * (must be in UNIFIED_NAV_TILES, unchanged without Tito + Renato IV sign-off).
 * Role-specific cockpits (trafico/bodega/contabilidad) populate extra counts
 * via these additional keys — they are not rendered as top-level nav.
 */
export type NavTileKey =
  | 'traficos'
  | 'pedimentos'
  | 'expedientes'
  | 'catalogo'
  | 'entradas'
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
 * AGUILA v7 — the six cockpit nav tiles, locked.
 *
 * Identical order, labels, icons, descriptions across /inicio,
 * /operador/inicio, and /admin/eagle. Role decides what data
 * populates each card; role does NOT decide which cards appear.
 *
 * Changing this list requires Tito + Renato IV sign-off
 * (core-invariants rule 29).
 */
export const UNIFIED_NAV_TILES: readonly NavTileDef[] = [
  { key: 'traficos',        href: '/traficos',   label: 'Tráficos',        icon: Truck,      description: 'Operaciones activas' },
  { key: 'pedimentos',      href: '/pedimentos', label: 'Pedimentos',      icon: FileText,   description: 'Declaraciones aduanales' },
  { key: 'expedientes',     href: '/expedientes',label: 'Expedientes',     icon: FolderOpen, description: 'Documentos por operación' },
  { key: 'catalogo',        href: '/catalogo',   label: 'Catálogo',        icon: Book,       description: 'Partes e historial' },
  { key: 'entradas',        href: '/entradas',   label: 'Entradas',        icon: Package,    description: 'Control de almacén' },
  { key: 'clasificaciones', href: '/clasificar', label: 'Clasificaciones', icon: Tags,       description: 'Fracciones arancelarias' },
] as const

export interface NavCellData {
  count: number | null
  series: number[]
  /** Short secondary sentence rendered under the description (v8). */
  microStatus?: string
  /** Colors the microStatus amber when true — used for "N pendientes" signals. */
  microStatusWarning?: boolean
  /** Optional suffix appended to the primary count (e.g. "%"). */
  countSuffix?: string
}

export type NavCounts = Partial<Record<NavTileKey, NavCellData>>

export const EMPTY_NAV_COUNTS: NavCounts = {
  traficos:        { count: null, series: [] },
  pedimentos:      { count: null, series: [] },
  expedientes:     { count: null, series: [] },
  catalogo:        { count: null, series: [] },
  entradas:        { count: null, series: [] },
  clasificaciones: { count: null, series: [] },
}
