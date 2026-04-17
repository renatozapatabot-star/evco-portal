'use client'

import { useEffect } from 'react'

/**
 * Listens for Cmd/Ctrl+K (open) and Escape (close) at the window level.
 * Single listener, detaches on unmount.
 */
export function useCmdK(onOpen: () => void, onClose?: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpen()
      } else if (e.key === 'Escape' && onClose) {
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onOpen, onClose])
}
