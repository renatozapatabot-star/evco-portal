'use client'

import { CockpitErrorCard } from '@/components/aguila/CockpitErrorCard'

export default function FraccionError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return <CockpitErrorCard message={error.message} onRetry={reset} />
}
