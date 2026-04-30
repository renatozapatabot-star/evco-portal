'use client'

import { CockpitErrorCard } from '@/components/aguila/CockpitErrorCard'

export default function AprobarError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return <CockpitErrorCard message={error.message} onRetry={reset} />
}
