'use client'

import { CockpitErrorCard } from '@/components/aguila/CockpitErrorCard'

export default function MiCuentaError({ error, reset }: { error: Error; reset: () => void }) {
  return <CockpitErrorCard message={`No se pudo cargar tu cuenta: ${error.message}`} onRetry={reset} />
}
