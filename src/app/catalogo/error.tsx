'use client'

import { CockpitErrorCard } from '@/components/aguila'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <CockpitErrorCard
      message={`No se pudo cargar el catálogo: ${error.message}`}
      onRetry={reset}
    />
  )
}
