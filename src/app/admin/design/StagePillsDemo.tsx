'use client'

/**
 * Interactive demo island for /admin/design.
 * Client component because AguilaStagePills needs a real onChange
 * callback (can't pass functions server→client without Server Actions).
 */

import { useState } from 'react'
import { AguilaStagePills } from '@/components/aguila'

type DemoStage = 'new' | 'contacted' | 'qualified' | 'demo' | 'won'

export function StagePillsDemo() {
  const [current, setCurrent] = useState<DemoStage>('qualified')
  return (
    <AguilaStagePills
      stages={[
        { value: 'new', label: 'Nuevo' },
        { value: 'contacted', label: 'Contactado' },
        { value: 'qualified', label: 'Calificado' },
        { value: 'demo', label: 'Demo visto' },
        { value: 'won', label: 'Ganado', sub: '2' },
      ]}
      current={current}
      onChange={(next) => setCurrent(next)}
    />
  )
}
