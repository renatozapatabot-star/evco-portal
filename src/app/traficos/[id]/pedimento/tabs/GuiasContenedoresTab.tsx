'use client'

import type { GuiaRow } from '@/lib/pedimento-types'
import { TabPlaceholder } from './TabPlaceholder'

export interface GuiasContenedoresTabProps {
  rows: GuiaRow[]
}

export function GuiasContenedoresTab(_props: GuiasContenedoresTabProps) {
  return <TabPlaceholder title="Guías / Contenedores" slice="B6c" />
}
