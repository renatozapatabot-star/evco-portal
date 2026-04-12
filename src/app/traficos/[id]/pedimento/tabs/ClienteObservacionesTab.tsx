'use client'

import type { PedimentoRow } from '@/lib/pedimento-types'
import { TabPlaceholder } from './TabPlaceholder'

export interface ClienteObservacionesTabProps {
  pedimento: PedimentoRow
}

export function ClienteObservacionesTab(_props: ClienteObservacionesTabProps) {
  return <TabPlaceholder title="Cliente / Observaciones" slice="B6b" />
}
