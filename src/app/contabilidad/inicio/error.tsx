'use client'

import { CockpitErrorCard } from '@/components/aguila/CockpitErrorCard'

export default function ContabilidadInicioError({ error, reset }: { error: Error; reset: () => void }) {
  return <CockpitErrorCard message={error.message} onRetry={reset} />
}
