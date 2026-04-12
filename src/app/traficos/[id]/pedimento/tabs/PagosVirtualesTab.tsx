'use client'

import type { PagoVirtualRow } from '@/lib/pedimento-types'
import { TabPlaceholder } from './TabPlaceholder'

export interface PagosVirtualesTabProps {
  rows: PagoVirtualRow[]
}

export function PagosVirtualesTab(_props: PagosVirtualesTabProps) {
  return <TabPlaceholder title="Formas de Pago Virtuales" slice="B6c" />
}
