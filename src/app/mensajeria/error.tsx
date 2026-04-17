'use client'

import { CockpitErrorCard } from '@/components/aguila'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <CockpitErrorCard
      message={`No se pudo cargar mensajería: ${error.message}`}
      onRetry={reset}
    />
  )
}
