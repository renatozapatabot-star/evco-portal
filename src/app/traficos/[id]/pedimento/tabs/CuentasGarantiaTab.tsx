'use client'

import type { CuentaGarantiaRow } from '@/lib/pedimento-types'
import { TabPlaceholder } from './TabPlaceholder'

export interface CuentasGarantiaTabProps {
  rows: CuentaGarantiaRow[]
}

export function CuentasGarantiaTab(_props: CuentasGarantiaTabProps) {
  return <TabPlaceholder title="Cuentas de Garantía" slice="B6c" />
}
