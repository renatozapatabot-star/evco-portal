'use client'

import type { CandadoRow } from '@/lib/pedimento-types'
import { TabPlaceholder } from './TabPlaceholder'

export interface CandadosTabProps {
  rows: CandadoRow[]
}

export function CandadosTab(_props: CandadosTabProps) {
  return <TabPlaceholder title="Candados" slice="B6c" />
}
