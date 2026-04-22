'use client'

import { useEffect } from 'react'

/**
 * Listens for Cmd/Ctrl+K (open), "/" (open), and Escape (close) at
 * the window level. Single listener, detaches on unmount.
 *
 * The "/" shortcut is skipped when focus is inside a text input /
 * textarea / contenteditable element, so typing a literal slash in
 * a search box or form field never hijacks the keystroke.
 */
export function useCmdK(onOpen: () => void, onClose?: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpen()
        return
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null
        const tag = target?.tagName
        const isEditing =
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target?.isContentEditable === true
        if (!isEditing) {
          e.preventDefault()
          onOpen()
          return
        }
      }
      if (e.key === 'Escape' && onClose) {
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onOpen, onClose])
}
