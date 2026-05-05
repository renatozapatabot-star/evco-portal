'use client'

import { useEffect, useState } from 'react'

export interface LiveWireItem {
  label: string
  value: string
  tone?: 'neutral' | 'live' | 'warn'
}

// Pre-auth status strip — descriptive states only, never specific numbers.
// Specific marketing values (e.g. "PEDIMENTOS MES · 1,248") read as
// claims about the user's account before they sign in and pair with
// other rotating values into apparent contradictions (audit Cluster B1
// 2026-05-05). Status descriptors keep the live-wire feel without
// promising data the user hasn't verified.
const DEFAULT_ITEMS: LiveWireItem[] = [
  { label: 'CRUCES',             value: 'EN CURSO',  tone: 'live' },
  { label: 'PEDIMENTOS',         value: 'EN PROCESO', tone: 'neutral' },
  { label: 'ANEXO 24',           value: 'ACTIVO',    tone: 'live' },
  { label: 'PUENTES',            value: 'FLUIDOS',   tone: 'live' },
  { label: 'CBP',                value: 'CONECTADO', tone: 'neutral' },
  { label: 'SAT · SESIÓN',       value: 'ACTIVA',    tone: 'live' },
]

/**
 * Rotating border-status strip. Cycles through ~6 live metrics every
 * 2.6s. Animated fade-up on each rotation. Sits below the submit
 * button on the login card.
 *
 * Port of the "LiveWire" element from
 * .planning/design-handoff/cruz-portal/project/src/screen-login.jsx:481-482.
 */
export function PortalLoginLiveWire({ items = DEFAULT_ITEMS }: { items?: LiveWireItem[] }) {
  const [idx, setIdx] = useState(0)
  const [seed, setSeed] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setIdx((i) => (i + 1) % items.length)
      setSeed((s) => s + 1)
    }, 2600)
    return () => clearInterval(interval)
  }, [items.length])

  const it = items[idx]
  const tone =
    it.tone === 'live' ? 'var(--portal-green-2)' :
    it.tone === 'warn' ? 'var(--portal-amber)' :
    'var(--portal-fg-2)'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '10px 14px',
        marginTop: 14,
        borderTop: '1px solid var(--portal-line-1)',
        fontFamily: 'var(--portal-font-mono)',
        fontSize: 10,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
      }}
      aria-live="polite"
    >
      <span
        aria-hidden
        style={{
          width: 5,
          height: 5,
          borderRadius: 999,
          background: 'var(--portal-green-2)',
          boxShadow: '0 0 6px var(--portal-green-glow)',
          animation: 'portalDotPulse 2s ease-in-out infinite',
        }}
      />
      <span
        key={seed}
        style={{
          color: 'var(--portal-fg-5)',
          animation: 'loginWireTick 400ms var(--portal-ease-out) both',
        }}
      >
        {it.label}
      </span>
      <span
        key={`${seed}-v`}
        style={{
          color: tone,
          letterSpacing: '0.1em',
          animation: 'loginWireTick 400ms var(--portal-ease-out) both',
        }}
      >
        {it.value}
      </span>
    </div>
  )
}
