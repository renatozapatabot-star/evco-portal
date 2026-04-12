'use client'

import type { PedimentoRow } from '@/lib/pedimento-types'
import { TabPlaceholder } from './TabPlaceholder'

export interface InicioTabProps {
  pedimento: PedimentoRow
  trafico: { trafico: string; estatus: string | null; pedimento: string | null }
}

export function InicioTab(_props: InicioTabProps) {
  return <TabPlaceholder title="Inicio" slice="B6b" />
}
