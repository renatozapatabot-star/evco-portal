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
        e.stopPropagation()
        setMode('advanced')
        setOpen(true)
        return
      }
      // ⌘K / Ctrl+K — quick mode.
      if (isMeta && !e.shiftKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        e.stopPropagation()
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
    // WHY capture phase: downstream inputs (/proveedores search box, table filters)
    // were swallowing Cmd+K. Capture phase guarantees the palette shortcut is
    // heard first, regardless of focused child handlers.
    window.addEventListener('keydown', onKey, true)

    // TopBar search icon dispatches this. Keep it in sync with keyboard path.
    const onOpenSearch = (e: Event) => {
      const isAdvanced = (e as CustomEvent<{ mode?: string }>).detail?.mode === 'advanced'
      setMode(isAdvanced ? 'advanced' : 'quick')
      setOpen(true)
    }
    document.addEventListener('cruz:open-search', onOpenSearch)

    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('cruz:open-search', onOpenSearch)
    }
  }, [open])

  const onClose = useCallback(() => setOpen(false), [])

  return <CommandPalette open={open} onClose={onClose} initialMode={mode} />
}

export default CommandPaletteProvider
