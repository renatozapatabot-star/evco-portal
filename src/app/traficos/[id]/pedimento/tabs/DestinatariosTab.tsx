'use client'

import type { DestinatarioRow } from '@/lib/pedimento-types'
import { TabPlaceholder } from './TabPlaceholder'

export interface DestinatariosTabProps {
  rows: DestinatarioRow[]
}

export function DestinatariosTab(_props: DestinatariosTabProps) {
  return <TabPlaceholder title="Destinatarios" slice="B6c" />
}
