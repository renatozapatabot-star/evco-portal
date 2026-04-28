'use client'

import Link from 'next/link'
import { useState } from 'react'
import { X } from 'lucide-react'

/**
 * MorningBriefing — 3-sentence personalized briefing at the top of
 * /inicio. Hydrates from `client_briefings` table, rendered
 * server-side and passed in as a prop so there's no loading state
 * and no flash of empty content.
 *
 * If the caller passes `briefing={null}` (no briefing for today yet
 * OR user dismissed it this session) the component returns null —
 * it is absent, never showing a placeholder.
 *
 * Dismissal is optimistic: the UI hides the briefing immediately
 * and fires POST /api/briefings/:id/dismiss in the background. If
 * the dismiss write fails the briefing re-appears on next page load
 * (server will still include it). Good enough; no toast spam on the
 * calm surface.
 *
 * Defensive sanitizer: any 6+ digit standalone number is stripped.
 * Sonnet has historically hallucinated pedimento serial numbers
 * (7 digits) and trafico IDs into the briefing text. Until the
 * generator prompt is locked down + verified, we strip them at
 * render time. Real money figures keep their formatting (commas,
 * $) and survive. Counts ≤4 digits also survive.
 */
const HALLUCINATED_ID_PATTERN = /\b\d{6,}\b/g

function sanitizeBriefingText(raw: string): string {
  return raw
    .replace(HALLUCINATED_ID_PATTERN, '')
    .replace(/\(\s*[,\s]*\)/g, '')
    .replace(/[ \t]+([.,;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export interface MorningBriefingData {
  id: string
  briefing_text: string
  action_item: string | null
  action_url: string | null
  /** Display name for the greeting — first name of the client contact
   *  if known, otherwise the company name. Passed in by the caller
   *  rather than queried client-side so the greeting is correct even
   *  during optimistic hides. */
  greeting_name: string
}

interface Props {
  briefing: MorningBriefingData | null
}

export function MorningBriefing({ briefing }: Props) {
  const [hidden, setHidden] = useState(false)

  if (!briefing || hidden) return null

  function dismiss() {
    setHidden(true)
    // Fire-and-forget — network failure isn't fatal, server will
    // surface the briefing again on next render.
    fetch(`/api/briefings/${briefing!.id}/dismiss`, {
      method: 'POST',
      credentials: 'same-origin',
    }).catch(() => {})
  }

  const sanitizedText = sanitizeBriefingText(briefing.briefing_text)
  if (!sanitizedText) return null

  return (
    <section
      aria-label="Briefing de la mañana"
      style={{
        position: 'relative',
        padding: 24,
        paddingRight: 56,
        marginBottom: 'var(--aguila-gap-section, 32px)',
        borderRadius: 20,
        borderLeft: '4px solid rgba(201,168,76,0.7)',
        border: '1px solid rgba(30,41,59,1)',
        background: 'linear-gradient(120deg, rgba(201,168,76,0.06) 0%, rgba(15,23,42,0) 60%)',
      }}
    >
      <div
        style={{
          fontSize: 'var(--aguila-fs-meta, 11px)',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'rgba(201,168,76,0.8)',
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        Resumen del día
      </div>

      <p
        style={{
          fontSize: 'var(--aguila-fs-body, 13px)',
          lineHeight: 1.55,
          color: 'var(--portal-fg-1)',
          margin: 0,
          maxWidth: 680,
        }}
      >
        {sanitizedText}
      </p>

      {briefing.action_item && briefing.action_url && (
        <Link
          href={briefing.action_url}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            marginTop: 16,
            minHeight: 60,
            minWidth: 120,
            padding: '0 20px',
            borderRadius: 12,
            background: 'rgba(201,168,76,0.14)',
            border: '1px solid rgba(201,168,76,0.3)',
            color: 'var(--portal-fg-1)',
            fontSize: 'var(--aguila-fs-body, 13px)',
            fontWeight: 600,
            textDecoration: 'none',
            boxSizing: 'border-box',
          }}
        >
          {briefing.action_item} →
        </Link>
      )}

      <button
        type="button"
        onClick={dismiss}
        aria-label="Descartar briefing"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 60,
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          borderRadius: 12,
          color: 'rgba(148,163,184,0.55)',
          cursor: 'pointer',
        }}
      >
        <X size={16} aria-hidden />
      </button>
    </section>
  )
}
