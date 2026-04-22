'use client'

import { CockpitErrorCard } from '@/components/aguila/CockpitErrorCard'

export default function MiCuentaCruzError({ error, reset }: { error: Error; reset: () => void }) {
  return <CockpitErrorCard message={`No pudimos abrir el asistente: ${error.message}`} onRetry={reset} />
}
