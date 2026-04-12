'use client'

import type { TransportistaRow } from '@/lib/pedimento-types'
import { TabPlaceholder } from './TabPlaceholder'

export interface TransportistasTabProps {
  rows: TransportistaRow[]
}

export function TransportistasTab(_props: TransportistasTabProps) {
  return <TabPlaceholder title="Transportistas" slice="B6c" />
}
