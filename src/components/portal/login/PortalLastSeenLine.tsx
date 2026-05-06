'use client'

import { useEffect, useState } from 'react'
import { parseLastSeenUnsafe, type LastSeenPayload } from '@/lib/auth/last-seen'

/**
 * Trust line rendered below the wordmark on /login. Reads the
 * `last_seen` cookie set by the previous successful login and
 * displays:
 *
 *   Último acceso · 27 abr 2026 · 14:32 · Nuevo Laredo · Chrome/macOS
 *
 * Renders nothing on first login (no cookie) — graceful empty state.
 * The cookie is HMAC-signed server-side; client-side we parse the
 * payload only (display is not security-relevant — a tampered cookie
 * would just show a fake last-seen line, fooling no one but the
 * tamperer).
 *
 * Per chat1.md: "A 'last seen' line that earns trust ... Below the
 * form, in tiny mono ... Real-feeling personalization. Says 'we know
 * you, we remember you, your data is safe.'"
 */
export function PortalLastSeenLine() {
  // SSR sees no `document`, so the initial state is null and the
  // component renders nothing on the server. After hydration, useEffect
  // reads the cookie and populates the payload — a lazy useState
  // initializer doesn't work here because React preserves the
  // server-pass null on hydration and never re-runs the initializer.
  const [payload, setPayload] = useState<LastSeenPayload | null>(null)

  useEffect(() => {
    const match = document.cookie
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('last_seen='))
    if (!match) return
    const value = decodeURIComponent(match.slice('last_seen='.length))
    const parsed = parseLastSeenUnsafe(value)
    if (parsed) setPayload(parsed)
  }, [])

  if (!payload) return null

  const display = formatLastSeen(payload)
  if (!display) return null

  return (
    <div
      style={{
        marginTop: 14,
        fontFamily: 'var(--portal-font-mono)',
        fontSize: 10, // WHY: handoff micro label scale (chat1.md)
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--portal-fg-5)',
        animation: 'portalFadeUp 900ms var(--portal-ease-out) 1500ms both',
      }}
      aria-label="Último acceso"
    >
      {display}
    </div>
  )
}

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function formatLastSeen(p: LastSeenPayload): string {
  const d = new Date(p.iso_ts)
  if (isNaN(d.getTime())) return ''
  // Render in America/Chicago (broker locale); intl.DateTimeFormat
  // gives consistent output across server/client.
  const dateFmt = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Chicago',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const timeFmt = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Chicago',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  // es-MX abbreviates months with periods ("abr.") — strip for the
  // mono-uppercase house style.
  const dateStr = dateFmt.format(d).replace(/\./g, '').toLowerCase()
  const timeStr = timeFmt.format(d)
  const parts: string[] = ['Último acceso', dateStr, timeStr]
  if (p.city) parts.push(p.city)
  // Audit Cluster M (2026-05-05): OS/browser fingerprint dropped from
  // pre-auth display — leaking ua_brief before login lets a thief on
  // the device confirm the prior session's environment. City stays
  // (coarse enough) and date/time stay (date is the trust signal).
  return parts.join(' · ')
}

// Fallback month formatter exported for tests in environments where
// Intl.DateTimeFormat behaves differently — the rule is small enough
// to inline if needed. Currently unused at runtime; Intl is reliable
// in Node 18+/browsers we target. Kept to make the date shape stable
// in the test if Intl ever drops the locale.
export function formatLastSeenStable(p: LastSeenPayload): string {
  const d = new Date(p.iso_ts)
  if (isNaN(d.getTime())) return ''
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mon = MONTHS_ES[d.getUTCMonth()]
  const yy = d.getUTCFullYear()
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mi = String(d.getUTCMinutes()).padStart(2, '0')
  const parts: string[] = ['Último acceso', `${dd} ${mon} ${yy}`, `${hh}:${mi}`]
  if (p.city) parts.push(p.city)
  // ua_brief intentionally omitted — see formatLastSeen() above.
  return parts.join(' · ')
}
