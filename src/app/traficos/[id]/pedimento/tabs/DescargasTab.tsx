'use client'

import type { DescargaRow } from '@/lib/pedimento-types'
import { TabPlaceholder } from './TabPlaceholder'

export interface DescargasTabProps {
  rows: DescargaRow[]
}

export function DescargasTab(_props: DescargasTabProps) {
  return <TabPlaceholder title="Descargas" slice="B6c" />
}
