'use client'

import { useMemo, useState } from 'react'

/**
 * CRUZChatSuggestions — contextual prompt chips rendered below the
 * CRUZ AI chat input. Each chip, when tapped, pre-fills the input
 * (does NOT auto-send) so Ursula can review or edit before submitting.
 *
 * Chips disappear after the user's first keystroke — they're a
 * learn-the-shape hint, not persistent chrome.
 *
 * 60 × minimum tap target per CLAUDE.md mobile rule. Horizontal scroll
 * on narrow viewports so all suggestions remain reachable without
 * forcing wrap.
 */

export interface ChatSuggestionContext {
  activeShipmentsCount: number
  incompleteExpedientes: number
  hasRecentPedimentos: boolean
  tmecSavingsAvailable: boolean
}

interface Props {
  context: ChatSuggestionContext
  /** Called with the chip text when the user taps one. Caller is
   *  responsible for setting the input value + focusing it. */
  onPick: (text: string) => void
  /** When the input becomes non-empty the chips are suppressed —
   *  parent tracks input state and flips this flag. */
  hidden: boolean
}

export function CRUZChatSuggestions({ context, onPick, hidden }: Props) {
  const [tappedIdx, setTappedIdx] = useState<number | null>(null)

  const suggestions = useMemo(() => {
    const items: string[] = []
    if (context.activeShipmentsCount > 0) {
      items.push('¿Dónde están mis embarques activos?')
    }
    if (context.incompleteExpedientes > 0) {
      items.push('¿Qué documentos me faltan?')
    }
    if (context.tmecSavingsAvailable) {
      items.push('¿Cuánto ahorré con T-MEC este año?')
    }
    if (context.hasRecentPedimentos) {
      items.push('Muéstrame mi último pedimento')
    }
    // Always offer a calm, generic fallback so the UI never renders 0 chips
    if (items.length === 0) {
      items.push('¿Hay algo pendiente por revisar?')
    }
    return items
  }, [context])

  if (hidden || suggestions.length === 0) return null

  return (
    <div
      role="group"
      aria-label="Preguntas sugeridas"
      style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        padding: '12px 4px',
        // Hide scrollbar on webkit while keeping scroll behavior
        scrollbarWidth: 'none',
      }}
    >
      {suggestions.map((text, i) => (
        <button
          key={i}
          type="button"
          onClick={() => {
            setTappedIdx(i)
            onPick(text)
          }}
          aria-pressed={tappedIdx === i}
          style={{
            flexShrink: 0,
            minHeight: 60,
            padding: '0 20px',
            display: 'inline-flex',
            alignItems: 'center',
            background: 'rgba(192,197,206,0.06)',
            border: '1px solid rgba(192,197,206,0.18)',
            borderRadius: 999,
            color: 'var(--portal-fg-1)',
            fontSize: 'var(--aguila-fs-body, 13px)',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            boxSizing: 'border-box',
          }}
        >
          {text}
        </button>
      ))}
    </div>
  )
}
