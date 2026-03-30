'use client'
import { useState } from 'react'

interface SortState { column: string; direction: 'asc' | 'desc' }

export function useSort(storageKey: string, defaultSort: SortState) {
  const [sort, setSort] = useState<SortState>(() => {
    if (typeof window === 'undefined') return defaultSort
    const saved = localStorage.getItem(`cruz-sort-${storageKey}`)
    if (saved) { try { return JSON.parse(saved) } catch { /* ignore */ } }
    return defaultSort
  })

  const toggleSort = (column: string) => {
    setSort(prev => {
      const next: SortState = prev.column === column
        ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: 'desc' }
      localStorage.setItem(`cruz-sort-${storageKey}`, JSON.stringify(next))
      return next
    })
  }

  return { sort, toggleSort }
}
