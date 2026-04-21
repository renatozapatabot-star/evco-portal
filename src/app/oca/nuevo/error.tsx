'use client'
import { CockpitErrorCard } from '@/components/aguila'
export default function OcaNuevoError({ error, reset }: { error: Error; reset: () => void }) {
  return <CockpitErrorCard message={error.message} onRetry={reset} />
}
