import { useState, useEffect } from 'react'

export type Density = 'comfortable' | 'compact' | 'dense'
const CYCLE: Density[] = ['comfortable', 'compact', 'dense']
const KEY = 'cruz-density'
const CLASSES = {
  comfortable: { row: 'py-4 text-base', gap: 'gap-4' },
  compact:     { row: 'py-2.5 text-sm', gap: 'gap-2' },
  dense:       { row: 'py-1.5 text-xs', gap: 'gap-1' },
}

export function useDensity() {
  const [density, setDensity] = useState<Density>('compact')

  useEffect(() => {
    const stored = localStorage.getItem(KEY) as Density | null
    if (stored && CYCLE.includes(stored)) setDensity(stored)
    else if (window.innerWidth < 768) setDensity('compact')
    else setDensity('comfortable')
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault()
        setDensity(prev => {
          const next = CYCLE[(CYCLE.indexOf(prev) + 1) % CYCLE.length]
          localStorage.setItem(KEY, next)
          return next
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const update = (d: Density) => {
    setDensity(d)
    localStorage.setItem(KEY, d)
  }

  return { density, update, classes: CLASSES[density] }
}
