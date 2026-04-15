'use client'

import { useState, useTransition } from 'react'
import { fmtDateTime } from '@/lib/format-utils'
import { ACCENT_CYAN, BORDER, GOLD, TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/design-system'
import { useToast } from '@/components/Toast'
import { useTrack } from '@/lib/telemetry/useTrack'
import { addTraficoNote } from '../actions'

export interface NoteRow {
  id: string
  author_id: string
  content: string
  mentions: string[]
  created_at: string
}

const MENTION_RE = /@([a-z0-9_-]+:[a-z0-9_-]+)/gi

function extractMentions(body: string): string[] {
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = MENTION_RE.exec(body)) !== null) {
    if (!out.includes(m[1])) out.push(m[1])
  }
  return out
}

function renderContent(body: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let lastIdx = 0
  let key = 0
  for (const m of body.matchAll(MENTION_RE)) {
    const start = m.index ?? 0
    if (start > lastIdx) parts.push(body.slice(lastIdx, start))
    parts.push(
      <span key={`m-${key++}`} style={{ color: ACCENT_CYAN, fontWeight: 600 }}>
        @{m[1]}
      </span>,
    )
    lastIdx = start + m[0].length
  }
  if (lastIdx < body.length) parts.push(body.slice(lastIdx))
  return parts
}

export function NotasTab({ traficoId, notes }: { traficoId: string; notes: NoteRow[] }) {
  const [draft, setDraft] = useState('')
  const [pending, startTransition] = useTransition()
  const { toast } = useToast()
  const track = useTrack()

  function submit() {
    const body = draft.trim()
    if (!body) {
      toast('Escribe una nota antes de guardar', 'error')
      return
    }
    const mentions = extractMentions(body)
    startTransition(async () => {
      const res = await addTraficoNote(traficoId, body, mentions)
      if (!res.ok) {
        toast(`No se pudo guardar la nota: ${res.error}`, 'error')
        return
      }
      track('trafico_note_added', {
        entityType: 'trafico',
        entityId: traficoId,
        metadata: { length: body.length, mention_count: mentions.length },
      })
      for (const m of mentions) {
        track('mention_created', {
          entityType: 'trafico',
          entityId: traficoId,
          metadata: { mentioned: m },
        })
      }
      setDraft('')
      toast('Nota agregada', 'success')
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label
          htmlFor="nota-textarea"
          style={{
            display: 'block',
            fontSize: 'var(--aguila-fs-meta)',
            fontWeight: 700,
            color: TEXT_MUTED,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 8,
          }}
        >
          Nueva nota
        </label>
        <textarea
          id="nota-textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escribe aquí. Usa @companyId:role para mencionar a alguien."
          rows={3}
          maxLength={4000}
          style={{
            width: '100%',
            minHeight: 80,
            padding: 12,
            background: 'rgba(0,0,0,0.3)',
            color: TEXT_PRIMARY,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            fontSize: 'var(--aguila-fs-body)',
            fontFamily: 'inherit',
            resize: 'vertical',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED }}>{draft.length} / 4000</span>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !draft.trim()}
            style={{
              minHeight: 60,
              minWidth: 120,
              padding: '0 20px',
              background: pending || !draft.trim() ? 'rgba(192,197,206,0.35)' : GOLD,
              color: '#0B1220',
              border: 'none',
              borderRadius: 12,
              fontSize: 'var(--aguila-fs-body)',
              fontWeight: 700,
              cursor: pending || !draft.trim() ? 'not-allowed' : 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            {pending ? 'Guardando…' : 'Guardar nota'}
          </button>
        </div>
      </div>

      <div>
        {notes.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)' }}>
            Sin notas todavía. Sé el primero en documentar algo.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {notes.map((n, i) => (
              <div
                key={n.id}
                style={{
                  padding: '12px 0',
                  borderBottom: i < notes.length - 1 ? `1px solid ${BORDER}` : 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--aguila-fs-meta)',
                      fontWeight: 700,
                      color: ACCENT_CYAN,
                      letterSpacing: '0.02em',
                    }}
                  >
                    {n.author_id}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--aguila-fs-meta)',
                      color: TEXT_MUTED,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {fmtDateTime(n.created_at)}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--aguila-fs-body)', color: TEXT_SECONDARY, marginTop: 6, whiteSpace: 'pre-wrap' }}>
                  {renderContent(n.content)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
