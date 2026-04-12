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
  const [mode, setMode] = useState<'quick' | 'advanced'>('quick')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey
      // Shift+⌘K / Shift+Ctrl+K — advanced mode.
      if (isMeta && e.shiftKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setMode('advanced')
        setOpen(true)
        return
      }
      // ⌘K / Ctrl+K — quick mode.
      if (isMeta && !e.shiftKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setMode('quick')
        setOpen(v => !v)
        return
      }
      if (e.key === '/' && !isTypingTarget(e.target) && !open) {
        e.preventDefault()
        setMode('quick')
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const onClose = useCallback(() => setOpen(false), [])

  return <CommandPalette open={open} onClose={onClose} initialMode={mode} />
}

export default CommandPaletteProvider
