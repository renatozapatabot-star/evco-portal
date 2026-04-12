'use client'

import type { PedimentoFacturaRow } from '@/lib/pedimento-types'
import { TabPlaceholder } from './TabPlaceholder'

export interface FacturasProveedoresTabProps {
  facturas: PedimentoFacturaRow[]
}

export function FacturasProveedoresTab(_props: FacturasProveedoresTabProps) {
  return <TabPlaceholder title="Facturas / Proveedores" slice="B6c" />
}
