'use client'

import { CockpitErrorCard } from '@/components/aguila'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <CockpitErrorCard
      message={`No se pudo cargar Anexo 24: ${error.message}`}
      onRetry={reset}
    />
  )
}
