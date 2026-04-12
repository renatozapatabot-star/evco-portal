'use client'

import type { PedimentoRow } from '@/lib/pedimento-types'
import { TabPlaceholder } from './TabPlaceholder'

export interface DatosGeneralesTabProps {
  pedimento: PedimentoRow
}

export function DatosGeneralesTab(_props: DatosGeneralesTabProps) {
  return <TabPlaceholder title="Datos Generales" slice="B6b" />
}
