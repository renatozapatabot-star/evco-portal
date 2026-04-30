'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import {
  GlassCard,
  AguilaInput,
  AguilaTextarea,
  AguilaSelect,
} from '@/components/aguila'
import { LEAD_SOURCES, LEAD_SOURCE_LABELS, type LeadSource } from '@/lib/leads/types'

/**
 * Admin/broker-only "add lead" collapsible form for /admin/leads.
 *
 * Posts to the same /api/leads POST endpoint the public /pitch form
 * uses — keeps one canonical capture path. Defaults source='referral'
 * so internal entries don't pollute the demo-attribution metric.
 *
 * Starts collapsed so the pipeline table stays the visual focus. Admin
 * hits "+ Nuevo lead" to expand, fills, submits — form closes + the
 * list refreshes via router.refresh().
 */
export function NewLeadForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [firmName, setFirmName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [rfc, setRfc] = useState('')
  const [source, setSource] = useState<LeadSource>('referral')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setFirmName('')
    setContactName('')
    setContactEmail('')
    setContactPhone('')
    setRfc('')
    setSource('referral')
    setNotes('')
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (firmName.trim().length < 2 || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const csrfToken =
        typeof document !== 'undefined'
          ? document.cookie.match(/csrf_token=([^;]+)/)?.[1] ?? ''
          : ''
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          firm_name: firmName.trim(),
          contact_name: contactName.trim() || undefined,
          contact_email: contactEmail.trim() || undefined,
          contact_phone: contactPhone.trim() || undefined,
          rfc: rfc.trim() || undefined,
          notes: notes.trim() || undefined,
          source,
          source_campaign: 'manual-admin-entry',
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || body?.error) {
        setError(body?.error?.message ?? 'submit_failed')
        return
      }
      reset()
      setOpen(false)
      router.refresh()
    } catch {
      setError('network_error')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="portal-btn portal-btn--primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 44,
          }}
        >
          <Plus size={16} strokeWidth={2.4} />
          Nuevo lead
        </button>
      </div>
    )
  }

  return (
    <GlassCard tier="hero" padding={20} style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div
          className="portal-eyebrow"
          style={{
            fontSize: 'var(--portal-fs-label)',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--portal-fg-4)',
          }}
        >
          Nuevo lead
        </div>
        <button
          type="button"
          onClick={() => {
            reset()
            setOpen(false)
          }}
          aria-label="Cerrar"
          className="portal-btn portal-btn--ghost portal-btn--icon"
        >
          <X size={16} />
        </button>
      </div>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <AguilaInput
          label="Firma"
          required
          placeholder="Empresa S.A. de C.V."
          value={firmName}
          onChange={(e) => setFirmName(e.target.value)}
          autoFocus
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
          }}
        >
          <AguilaInput
            label="Contacto"
            placeholder="Juan García López"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
          <AguilaInput
            label="Correo"
            type="email"
            placeholder="juan@empresa.com"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
          <AguilaInput
            label="Teléfono"
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
          />
          <AguilaInput
            label="RFC"
            mono
            maxLength={13}
            value={rfc}
            onChange={(e) => setRfc(e.target.value.toUpperCase())}
          />
        </div>
        <AguilaSelect
          label="Fuente"
          value={source}
          onChange={(e) => setSource(e.target.value as LeadSource)}
          options={LEAD_SOURCES.map((s) => ({
            value: s,
            label: LEAD_SOURCE_LABELS[s],
          }))}
        />
        <AguilaTextarea
          label="Contexto / notas iniciales"
          rows={3}
          placeholder="Cómo llegaron, qué buscan, volumen estimado…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {error ? (
          <div
            role="alert"
            style={{
              color: 'var(--portal-status-red-fg)',
              fontSize: 'var(--portal-fs-sm)',
              background: 'var(--portal-status-red-bg)',
              border: '1px solid var(--portal-status-red-ring)',
              borderRadius: 10,
              padding: '10px 14px',
            }}
          >
            {error === 'firm_name_required'
              ? 'El nombre de la firma es requerido.'
              : 'No se pudo guardar. Intenta de nuevo.'}
          </div>
        ) : null}
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 4,
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={() => {
              reset()
              setOpen(false)
            }}
            className="portal-btn portal-btn--ghost portal-btn--lg"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={firmName.trim().length < 2 || submitting}
            className="portal-btn portal-btn--primary portal-btn--lg"
            style={{
              opacity: firmName.trim().length >= 2 && !submitting ? 1 : 0.6,
              cursor:
                firmName.trim().length >= 2 && !submitting ? 'pointer' : 'wait',
            }}
          >
            {submitting ? 'Guardando…' : 'Guardar lead'}
          </button>
        </div>
      </form>
    </GlassCard>
  )
}
