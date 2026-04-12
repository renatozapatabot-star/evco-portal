export type EntityKind =
  | 'trafico'
  | 'entrada'
  | 'pedimento'
  | 'proveedor'
  | 'producto'
  | 'fraccion'
  | 'documento'

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
  entradas: UniversalSearchHit[]
  pedimentos: UniversalSearchHit[]
  proveedores: UniversalSearchHit[]
  productos: UniversalSearchHit[]
  fracciones: UniversalSearchHit[]
  documentos: UniversalSearchHit[]
  took_ms: number
}

export const GROUP_LABELS_ES: Record<keyof Omit<UniversalSearchResponse, 'query' | 'took_ms'>, string> = {
  traficos: 'Tráficos',
  entradas: 'Entradas',
  pedimentos: 'Pedimentos',
  proveedores: 'Proveedores',
  productos: 'Productos',
  fracciones: 'Fracciones',
  documentos: 'Documentos',
}

export const GROUP_LIST_HREFS: Record<keyof Omit<UniversalSearchResponse, 'query' | 'took_ms'>, string> = {
  traficos: '/traficos',
  entradas: '/entradas',
  pedimentos: '/pedimentos',
  proveedores: '/proveedores',
  productos: '/fracciones',
  fracciones: '/fracciones',
  documentos: '/documentos',
}
