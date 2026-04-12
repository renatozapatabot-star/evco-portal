import type { EntityId } from '@/types/search'

export type EntityKind = EntityId

export interface UniversalSearchHit {
  kind: EntityKind
  id: string
  title: string
  subtitle: string
  href: string
}

export type UniversalSearchResponse = {
  query: string
  traficos: UniversalSearchHit[]
  pedimentos: UniversalSearchHit[]
  entradas: UniversalSearchHit[]
  facturas: UniversalSearchHit[]
  partidas: UniversalSearchHit[]
  productos: UniversalSearchHit[]
  fracciones: UniversalSearchHit[]
  clientes: UniversalSearchHit[]
  proveedores: UniversalSearchHit[]
  operadores: UniversalSearchHit[]
  documentos: UniversalSearchHit[]
  ordenes_carga: UniversalSearchHit[]
  took_ms: number
}

export type GroupKey = Exclude<keyof UniversalSearchResponse, 'query' | 'took_ms'>

export const GROUP_LABELS_ES: Record<GroupKey, string> = {
  traficos: 'Tráficos',
  pedimentos: 'Pedimentos',
  entradas: 'Entradas',
  facturas: 'Facturas',
  partidas: 'Partidas',
  productos: 'Productos',
  fracciones: 'Fracciones',
  clientes: 'Clientes',
  proveedores: 'Proveedores',
  operadores: 'Operadores',
  documentos: 'Documentos',
  ordenes_carga: 'Órdenes de carga',
}

export const GROUP_LIST_HREFS: Record<GroupKey, string> = {
  traficos: '/traficos',
  pedimentos: '/pedimentos',
  entradas: '/entradas',
  facturas: '/pedimentos',
  partidas: '/fracciones',
  productos: '/fracciones',
  fracciones: '/fracciones',
  clientes: '/clientes',
  proveedores: '/proveedores',
  operadores: '/operadores',
  documentos: '/documentos',
  ordenes_carga: '/traficos',
}
