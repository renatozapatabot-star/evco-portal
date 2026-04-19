'use client'

import { CockpitErrorCard } from '@/components/aguila'

export default function RevenueError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <CockpitErrorCard
      message={`No se pudo cargar el panel de ingresos. ${error?.message ?? 'Error desconocido'}`}
      onRetry={reset}
    />
  )
}
