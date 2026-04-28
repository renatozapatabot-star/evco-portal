'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function useKeyboardShortcuts() {
  const router = useRouter()

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target.isContentEditable ||
          target.closest('[contenteditable]') ||
          target.closest('.cruz-input')) return

      if (e.key === 'Escape') {
        document.dispatchEvent(new CustomEvent('cruz:close-modal'))
        return
      }

      if (e.metaKey || e.ctrlKey) {
        if (e.key === '/') { e.preventDefault(); document.dispatchEvent(new CustomEvent('cruz:open-chat')) }
        return
      }
      if (e.altKey) return

      const routes: Record<string, string> = {
        '1':'/', '2':'/embarques', '3':'/entradas', '4':'/pedimentos',
        '5':'/expedientes', '6':'/reportes', '7':'/cuentas', '8':'/anexo-24',
      }
      if (routes[e.key]) { e.preventDefault(); router.push(routes[e.key]); return }
      if (e.key === '9') { e.preventDefault(); document.dispatchEvent(new CustomEvent('cruz:open-chat')); return }

      // J/K row navigation
      if (e.key === 'j' || e.key === 'k') {
        const rows = document.querySelectorAll('.data-table tbody tr')
        if (!rows.length) return
        const cur = document.querySelector('.data-table tbody tr.row-selected')
        let idx = cur ? Array.from(rows).indexOf(cur) : -1
        if (e.key === 'j') idx = Math.min(idx + 1, rows.length - 1)
        if (e.key === 'k') idx = Math.max(idx - 1, 0)
        cur?.classList.remove('row-selected')
        rows[idx]?.classList.add('row-selected')
        rows[idx]?.scrollIntoView({ block: 'nearest' })
      }
      if (e.key === 'Enter') {
        (document.querySelector('.data-table tbody tr.row-selected') as HTMLElement)?.click()
      }
    }

    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [router])
}
