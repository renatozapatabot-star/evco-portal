'use client'

/**
 * V1 Polish Pack · Block 7 — Comment thread with @mention autocomplete.
 *
 * Hosts the comment composer on the Comunicación tab. Reuses the
 * existing `trafico_notes` table and `addTraficoNote` server action
 * so notifications + decision logging + revalidation already work.
 *
 * What's new vs NotasTab:
 *   - Author avatars (initials from the `{companyId}:{role}` composite)
 *   - @mention autocomplete via MentionAutocomplete
 *   - `comment_added` / `mention_created` telemetry (union already defined)
 */

import { useRef, useState, useTransition } from 'react'
import { fmtDateTime } from '@/lib/format-utils'
import {
  ACCENT_SILVER,
  BORDER,
  GOLD,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'
import { useToast } from '@/components/Toast'
import { useTrack } from '@/lib/telemetry/useTrack'
import { addTraficoNote } from '@/app/embarques/[id]/legacy/actions'
import { MentionAutocomplete, type AvailableUser } from './MentionAutocomplete'

export interface TraficoNote {
  id: string
  author_id: string
  content: string
  mentions: string[]
  created_at: string
}

interface CommentThreadProps {
  traficoId: string
  notes: TraficoNote[]
  currentUserId: string
  availableUsers: AvailableUser[]
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

function renderWithMentions(body: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let lastIdx = 0
  let key = 0
  for (const m of body.matchAll(MENTION_RE)) {
    const start = m.index ?? 0
    if (start > lastIdx) parts.push(body.slice(lastIdx, start))
    parts.push(
      <span key={`m-${key++}`} style={{ color: ACCENT_SILVER, fontWeight: 600 }}>
        @{m[1]}
      </span>,
    )
    lastIdx = start + m[0].length
  }
  if (lastIdx < body.length) parts.push(body.slice(lastIdx))
  return parts
}

function initialsFor(authorId: string): string {
  // `evco:client` → "EC"; `renato-iv:admin` → "RA"; fallback first 2 chars.
  const [company, role] = authorId.split(':')
  if (company && role) {
    return `${company[0] ?? ''}${role[0] ?? ''}`.toUpperCase()
  }
  return authorId.slice(0, 2).toUpperCase()
}

export function CommentThread({ traficoId, notes, currentUserId, availableUsers }: CommentThreadProps) {
  const [draft, setDraft] = useState('')
  const [pendingMentions, setPendingMentions] = useState<string[]>([])
  const [pending, startTransition] = useTransition()
  const { toast } = useToast()
  const track = useTrack()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  function recordMention(id: string) {
    setPendingMentions((prev) => (prev.includes(id) ? prev : [...prev, id]))
    track('mention_created', {
      entityType: 'trafico',
      entityId: traficoId,
      metadata: { mentioned: id, source: 'autocomplete' },
    })
  }

  function submit() {
    const body = draft.trim()
    if (!body) {
      toast('Escribe un comentario antes de enviar', 'error')
      return
    }
    // Merge autocomplete-captured mentions with anything typed manually.
    const typed = extractMentions(body)
    const allMentions = Array.from(new Set([...pendingMentions, ...typed])).filter((m) =>
      body.includes(`@${m}`),
    )

    startTransition(async () => {
      const res = await addTraficoNote(traficoId, body, allMentions)
      if (!res.ok) {
        toast(`No se pudo enviar: ${res.error}`, 'error')
        return
      }
      track('comment_added', {
        entityType: 'trafico',
        entityId: traficoId,
        metadata: { length: body.length, mention_count: allMentions.length },
      })
      // Typed-only mentions not already tracked via autocomplete:
      for (const m of allMentions) {
        if (!pendingMentions.includes(m)) {
          track('mention_created', {
            entityType: 'trafico',
            entityId: traficoId,
            metadata: { mentioned: m, source: 'typed' },
          })
        }
      }
      setDraft('')
      setPendingMentions([])
      toast('Comentario enviado', 'success')
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Composer */}
      <div>
        <label
          htmlFor="comment-textarea"
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
          Escribiendo como{' '}
          <span style={{ color: ACCENT_SILVER, fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>
            {currentUserId}
          </span>
        </label>
        <textarea
          id="comment-textarea"
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            availableUsers.length > 0
              ? 'Escribe un comentario. Usa @ para mencionar a alguien.'
              : 'Escribe un comentario. Usa @companyId:role para mencionar.'
          }
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
            boxSizing: 'border-box',
          }}
        />
        <MentionAutocomplete
          textareaRef={textareaRef}
          value={draft}
          onChange={setDraft}
          onMentionSelected={recordMention}
          availableUsers={availableUsers}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED }}>
            {draft.length} / 4000
            {availableUsers.length === 0 && (
              <span style={{ marginLeft: 8, color: TEXT_MUTED }}>
                · sin directorio de usuarios (menciones en texto plano)
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !draft.trim()}
            style={{
              minHeight: 60,
              minWidth: 140,
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
            {pending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>

      {/* Thread */}
      <div>
        {notes.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)' }}>
            Sin comentarios todavía. Inicia la conversación.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {notes.map((n, i) => (
              <div
                key={n.id}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '14px 0',
                  borderBottom: i < notes.length - 1 ? `1px solid ${BORDER}` : 'none',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'rgba(192,197,206,0.1)',
                    border: `1px solid ${ACCENT_SILVER}`,
                    color: ACCENT_SILVER,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--aguila-fs-compact)',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                  }}
                >
                  {initialsFor(n.author_id)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
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
                        fontSize: 'var(--aguila-fs-compact)',
                        fontWeight: 700,
                        color: TEXT_PRIMARY,
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
                    {renderWithMentions(n.content)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
