'use client'

import { useEffect, useState } from 'react'

interface InsightWhisperProps {
  text: string | null
  delay?: number
  duration?: number
}

const COOLDOWN_KEY = 'cruz-whisper-cooldown'
const COOLDOWN_DAYS = 7

function getSeenWhispers(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(COOLDOWN_KEY) || '{}') } catch { return {} }
}

function markWhisperSeen(text: string) {
  if (typeof window === 'undefined') return
  const seen = getSeenWhispers()
  seen[text] = Date.now()
  // Clean old entries
  const cutoff = Date.now() - COOLDOWN_DAYS * 86400000
  for (const key of Object.keys(seen)) {
    if (seen[key] < cutoff) delete seen[key]
  }
  localStorage.setItem(COOLDOWN_KEY, JSON.stringify(seen))
}

function isWhisperFresh(text: string): boolean {
  const seen = getSeenWhispers()
  if (!seen[text]) return true
  return Date.now() - seen[text] > COOLDOWN_DAYS * 86400000
}

/**
 * Insight Whisper — thin gold bar with one-line contextual insight.
 * Slides in after delay, stays for duration, fades out.
 * Never repeats the same whisper within 7 days.
 * Only positive/neutral insights. Bad news goes to alerts.
 */
export function InsightWhisper({ text, delay = 1500, duration = 8000 }: InsightWhisperProps) {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!text || dismissed) return
    if (!isWhisperFresh(text)) return

    const showTimer = setTimeout(() => {
      setVisible(true)
      markWhisperSeen(text)
    }, delay)

    const hideTimer = setTimeout(() => {
      setVisible(false)
    }, delay + duration)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
    }
  }, [text, delay, duration, dismissed])

  if (!text || dismissed || !visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={() => setDismissed(true)}
      style={{
        position: 'relative',
        padding: '10px 20px',
        background: 'linear-gradient(135deg, rgba(196,150,60,0.06) 0%, rgba(196,150,60,0.02) 100%)',
        borderBottom: '1px solid rgba(196,150,60,0.15)',
        fontSize: 13,
        color: 'var(--gold-dark, #7A7E86)',
        textAlign: 'center',
        fontWeight: 500,
        cursor: 'pointer',
        animation: 'whisperSlideIn 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        lineHeight: 1.5,
      }}
    >
      <span style={{ marginRight: 6, opacity: 0.6 }}>✦</span>
      {text}
      <style>{`
        @keyframes whisperSlideIn {
          from { opacity: 0; transform: translateY(-100%); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
