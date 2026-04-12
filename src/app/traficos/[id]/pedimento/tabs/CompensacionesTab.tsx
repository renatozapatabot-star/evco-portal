'use client'

import type { CompensacionRow } from '@/lib/pedimento-types'
import { TabPlaceholder } from './TabPlaceholder'

export interface CompensacionesTabProps {
  rows: CompensacionRow[]
}

export function CompensacionesTab(_props: CompensacionesTabProps) {
  return <TabPlaceholder title="Compensaciones" slice="B6c" />
}
