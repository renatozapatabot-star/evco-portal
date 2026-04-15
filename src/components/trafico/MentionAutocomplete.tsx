'use client'

/**
 * V1 Polish Pack · Block 7 — @mention autocomplete.
 *
 * Watches a textarea for `@` triggers and pops a small floating list
 * filtered by the typed substring. On selection, inserts the composite
 * `{companyId}:{role}` key at the cursor and calls onMentionSelected so
 * the parent can track it for the note's mentions[] array.
 *
 * If `availableUsers` is empty (no users table yet), the list never
 * opens — plaintext `@text` in the textarea still works and is parsed
 * for mentions by the server action's MENTION_RE.
 *
 * Design: dark glass, 60px row tap targets.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import type { RefObject } from 'react'
import {
  ACCENT_SILVER,
  BG_CARD,
  BORDER,
  GLASS_BLUR,
  GLASS_SHADOW,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'

export interface AvailableUser {
  /** Composite {companyId}:{role} — this is what goes into the textarea + mentions[]. */
  id: string
  /** Human label for the row: "Renato IV (admin)" etc. */
  label: string
}

interface MentionAutocompleteProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (next: string) => void
  onMentionSelected?: (mentionId: string) => void
  availableUsers: AvailableUser[]
}

interface TriggerState {
  open: boolean
  start: number
  query: string
}

function findTrigger(value: string, caret: number): TriggerState {
  // Walk back from the caret to find the nearest `@` that begins a
  // mention segment. A mention starts when `@` is at position 0 or
  // preceded by whitespace and the segment has no whitespace.
  let i = caret - 1
  while (i >= 0) {
    const ch = value[i]
    if (ch === '@') {
      const before = i === 0 ? ' ' : value[i - 1]
      if (/\s/.test(before)) {
        const query = value.slice(i + 1, caret)
        // Abort if query contains whitespace — means we walked past a mention.
        if (/\s/.test(query)) return { open: false, start: -1, query: '' }
        return { open: true, start: i, query }
      }
      return { open: false, start: -1, query: '' }
    }
    if (/\s/.test(ch)) return { open: false, start: -1, query: '' }
    i--
  }
  return { open: false, start: -1, query: '' }
}

export function MentionAutocomplete({
  textareaRef,
  value,
  onChange,
  onMentionSelected,
  availableUsers,
}: MentionAutocompleteProps) {
  const [trigger, setTrigger] = useState<TriggerState>({ open: false, start: -1, query: '' })
  const [highlight, setHighlight] = useState(0)
  const listRef = useRef<HTMLDivElement | null>(null)

  const filtered = trigger.open
    ? availableUsers
        .filter((u) => {
          if (!trigger.query) return true
          const q = trigger.query.toLowerCase()
          return u.id.toLowerCase().includes(q) || u.label.toLowerCase().includes(q)
        })
        .slice(0, 8)
    : []

  // Recompute the trigger whenever value or caret changes.
  const refresh = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    const caret = ta.selectionStart ?? value.length
    setTrigger(findTrigger(value, caret))
    setHighlight(0)
  }, [textareaRef, value])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    const onSel = () => refresh()
    ta.addEventListener('keyup', onSel)
    ta.addEventListener('click', onSel)
    return () => {
      ta.removeEventListener('keyup', onSel)
      ta.removeEventListener('click', onSel)
    }
  }, [textareaRef, refresh])

  const applySelection = useCallback(
    (user: AvailableUser) => {
      const ta = textareaRef.current
      if (!ta || !trigger.open) return
      const caret = ta.selectionStart ?? value.length
      const before = value.slice(0, trigger.start)
      const after = value.slice(caret)
      const inserted = `@${user.id} `
      const next = `${before}${inserted}${after}`
      onChange(next)
      onMentionSelected?.(user.id)
      // Restore caret just after the inserted mention.
      const newCaret = before.length + inserted.length
      window.requestAnimationFrame(() => {
        ta.focus()
        ta.setSelectionRange(newCaret, newCaret)
      })
      setTrigger({ open: false, start: -1, query: '' })
    },
    [textareaRef, trigger, value, onChange, onMentionSelected],
  )

  // Keyboard handling on the textarea — arrow navigation + Enter to pick.
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    function onKey(e: KeyboardEvent) {
      if (!trigger.open || filtered.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlight((h) => (h + 1) % filtered.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlight((h) => (h - 1 + filtered.length) % filtered.length)
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        applySelection(filtered[highlight])
      } else if (e.key === 'Escape') {
        setTrigger({ open: false, start: -1, query: '' })
      }
    }
    ta.addEventListener('keydown', onKey)
    return () => ta.removeEventListener('keydown', onKey)
  }, [textareaRef, trigger, filtered, highlight, applySelection])

  if (!trigger.open || filtered.length === 0) return null

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Personas a mencionar"
      style={{
        marginTop: 6,
        background: BG_CARD,
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        boxShadow: GLASS_SHADOW,
        overflow: 'hidden',
        maxHeight: 260,
        overflowY: 'auto',
      }}
    >
      {filtered.map((user, idx) => {
        const active = idx === highlight
        return (
          <button
            type="button"
            key={user.id}
            role="option"
            aria-selected={active}
            onMouseDown={(e) => {
              // Prevent textarea blur before the click lands.
              e.preventDefault()
              applySelection(user)
            }}
            onMouseEnter={() => setHighlight(idx)}
            style={{
              all: 'unset',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              minHeight: 60,
              padding: '0 14px',
              background: active ? 'rgba(192,197,206,0.08)' : 'transparent',
              cursor: 'pointer',
              borderBottom: idx < filtered.length - 1 ? `1px solid ${BORDER}` : 'none',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--aguila-fs-compact)',
                fontWeight: 700,
                color: ACCENT_SILVER,
                letterSpacing: '0.02em',
              }}
            >
              @{user.id}
            </span>
            <span style={{ fontSize: 'var(--aguila-fs-compact)', color: TEXT_SECONDARY }}>{user.label}</span>
          </button>
        )
      })}
      <div
        style={{
          padding: '8px 14px',
          fontSize: 'var(--aguila-fs-label)',
          color: TEXT_MUTED,
          borderTop: `1px solid ${BORDER}`,
          background: 'rgba(0,0,0,0.2)',
        }}
      >
        <span style={{ color: TEXT_PRIMARY }}>↑↓</span> navegar ·{' '}
        <span style={{ color: TEXT_PRIMARY }}>Enter</span> seleccionar ·{' '}
        <span style={{ color: TEXT_PRIMARY }}>Esc</span> cerrar
      </div>
    </div>
  )
}
