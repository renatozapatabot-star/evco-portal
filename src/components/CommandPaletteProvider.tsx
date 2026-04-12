'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'

const CommandPalette = dynamic(
  () => import('./CommandPalette').then(m => ({ default: m.CommandPalette })),
  { ssr: false },
)

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return false
}

export function CommandPaletteProvider() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey
      if (isMeta && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setOpen(v => !v)
        return
      }
      if (e.key === '/' && !isTypingTarget(e.target) && !open) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const onClose = useCallback(() => setOpen(false), [])

  return <CommandPalette open={open} onClose={onClose} />
}

export default CommandPaletteProvider
