'use client'

import type { ContribucionRow } from '@/lib/pedimento-types'
import { TabPlaceholder } from './TabPlaceholder'

export interface ContribucionesTabProps {
  rows: ContribucionRow[]
}

export function ContribucionesTab(_props: ContribucionesTabProps) {
  return <TabPlaceholder title="Contribuciones" slice="B6c" />
}
