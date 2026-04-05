'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getCookieValue } from '@/lib/client-config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const OPTIONS = [
  { id: 'missing', label: 'Datos faltantes' },
  { id: 'unclear', label: 'No entiendo' },
  { id: 'broken', label: 'Parece roto' },
  { id: 'other', label: 'Otro' },
]

export function FeedbackButton({ context }: { context: string }) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (answer: string) => {
    setSent(true)
    // Fire-and-forget — non-fatal
    supabase.from('user_feedback').insert({
      context,
      answer,
      url: typeof window !== 'undefined' ? window.location.pathname : null,
      company_id: getCookieValue('company_id') ?? '',
    }).then(() => {})
    setTimeout(() => { setOpen(false); setSent(false) }, 1500)
  }

  if (sent) {
    return (
      <div style={{ fontSize: 12, color: '#2D8540', fontWeight: 600, marginTop: 12, textAlign: 'center' }}>
        Gracias por tu retroalimentación
      </div>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          marginTop: 12, fontSize: 11, color: '#9C9890',
          background: 'none', border: 'none', cursor: 'pointer',
          textDecoration: 'underline', padding: 4,
        }}
      >
        ¿Qué buscabas aquí?
      </button>
    )
  }

  return (
    <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
      {OPTIONS.map(opt => (
        <button
          key={opt.id}
          onClick={() => submit(opt.id)}
          style={{
            padding: '6px 12px', fontSize: 11, fontWeight: 600,
            border: '1px solid #E8E5E0', borderRadius: 6,
            background: 'var(--card-bg)', color: 'var(--text-secondary)',
            cursor: 'pointer', minHeight: 32,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
