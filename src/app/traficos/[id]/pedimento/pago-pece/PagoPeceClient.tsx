'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BankSelector } from '@/components/banks/BankSelector'
import {
  ACCENT_SILVER,
  TEXT_PRIMARY,
  TEXT_MUTED,
} from '@/lib/design-system'

const BORDER_SILVER = 'rgba(192,197,206,0.22)'
const RED = '#EF4444'
const GREEN = '#22C55E'

type Status = 'intent' | 'submitted' | 'confirmed' | 'rejected'

export interface PagoPeceClientProps {
  pedimentoId: string
  traficoId: string
  existing: {
    id: string
    status: Status
    bank_code: string
    amount: number
    reference: string
    confirmation_number: string | null
    created_at: string
  } | null
}

export function PagoPeceClient({
  pedimentoId,
  traficoId,
  existing,
}: PagoPeceClientProps) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Intent form state
  const [bankCode, setBankCode] = useState<string | null>(
    existing?.bank_code ?? null,
  )
  const [amountStr, setAmountStr] = useState<string>(
    existing?.amount ? String(existing.amount) : '',
  )
  const [reference, setReference] = useState<string>(existing?.reference ?? '')

  // Confirm form state
  const [confirmation, setConfirmation] = useState<string>('')

  const payment = existing
  const status: Status = payment?.status ?? 'intent'
  const hasIntent = payment !== null && status !== 'rejected'

  async function submitIntent() {
    setError(null)
    const amt = Number.parseFloat(amountStr)
    if (!bankCode) {
      setError('Selecciona un banco.')
      return
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Monto inválido.')
      return
    }
    if (reference.trim().length < 3) {
      setError('Referencia requerida (mínimo 3 caracteres).')
      return
    }
    start(async () => {
      const res = await fetch('/api/pece/create-intent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pedimento_id: pedimentoId,
          trafico_id: traficoId,
          bank_code: bankCode,
          amount: amt,
          reference: reference.trim(),
        }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        error?: { message: string } | null
      }
      if (!res.ok) {
        setError(body.error?.message ?? `HTTP ${res.status}`)
        return
      }
      router.refresh()
    })
  }

  async function transition(action: 'submit' | 'confirm' | 'reject') {
    if (!payment) return
    setError(null)
    if (action === 'confirm' && confirmation.trim().length === 0) {
      setError('Folio de confirmación requerido.')
      return
    }
    start(async () => {
      const res = await fetch('/api/pece/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          payment_id: payment.id,
          action,
          confirmation_number:
            action === 'confirm' ? confirmation.trim() : undefined,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        error?: { message: string } | null
      }
      if (!res.ok) {
        setError(body.error?.message ?? `HTTP ${res.status}`)
        return
      }
      router.refresh()
    })
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        padding: 24,
        borderRadius: 20,
        background: 'rgba(9,9,11,0.75)',
        border: `1px solid ${BORDER_SILVER}`,
        backdropFilter: 'blur(20px)',
      }}
    >
      {error && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: `1px solid ${RED}66`,
            background: 'rgba(239,68,68,0.08)',
            color: RED,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {status === 'confirmed' && (
        <div
          role="status"
          style={{
            padding: '12px 14px',
            borderRadius: 10,
            border: `1px solid ${GREEN}66`,
            background: 'rgba(34,197,94,0.08)',
            color: GREEN,
            fontSize: 13,
          }}
        >
          Pago confirmado. Folio:{' '}
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            {payment?.confirmation_number}
          </span>
        </div>
      )}

      {!hasIntent ? (
        <>
          <FieldBlock label="Banco">
            <BankSelector
              value={bankCode}
              onChange={setBankCode}
              onlyPece
              disabled={pending}
            />
          </FieldBlock>

          <FieldBlock label="Monto (MXN)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={amountStr}
              onChange={e => setAmountStr(e.target.value)}
              disabled={pending}
              placeholder="0.00"
              style={fieldStyle({ mono: true })}
            />
          </FieldBlock>

          <FieldBlock label="Referencia">
            <input
              type="text"
              value={reference}
              onChange={e => setReference(e.target.value)}
              disabled={pending}
              placeholder="Folio bancario"
              style={fieldStyle({ mono: true })}
            />
          </FieldBlock>

          <button
            type="button"
            onClick={submitIntent}
            disabled={pending}
            style={primaryBtn(pending)}
          >
            Registrar intento de pago
          </button>
        </>
      ) : status === 'intent' || status === 'submitted' ? (
        <>
          <SubmittedSummary payment={payment!} />
          {status === 'intent' && (
            <button
              type="button"
              onClick={() => transition('submit')}
              disabled={pending}
              style={secondaryBtn(pending)}
            >
              Marcar como enviado al banco
            </button>
          )}
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: TEXT_MUTED,
              lineHeight: 1.5,
            }}
          >
            Pago registrado. Submita en el portal del banco y regresa para
            confirmar.
          </p>

          <FieldBlock label="Folio de confirmación">
            <input
              type="text"
              value={confirmation}
              onChange={e => setConfirmation(e.target.value)}
              disabled={pending}
              placeholder="Folio bancario final"
              style={fieldStyle({ mono: true })}
            />
          </FieldBlock>

          <button
            type="button"
            onClick={() => transition('confirm')}
            disabled={pending}
            style={primaryBtn(pending)}
          >
            Confirmar pago
          </button>

          <button
            type="button"
            onClick={() => transition('reject')}
            disabled={pending}
            style={{
              ...secondaryBtn(pending),
              color: RED,
              borderColor: `${RED}66`,
            }}
          >
            Rechazar intento
          </button>
        </>
      ) : (
        <SubmittedSummary payment={payment!} />
      )}
    </div>
  )
}

function SubmittedSummary({
  payment,
}: {
  payment: NonNullable<PagoPeceClientProps['existing']>
}) {
  return (
    <dl
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 12,
        margin: 0,
      }}
    >
      <SummaryItem label="Banco" value={payment.bank_code} mono />
      <SummaryItem
        label="Monto"
        value={`${payment.amount.toFixed(2)} MXN`}
        mono
      />
      <SummaryItem label="Referencia" value={payment.reference} mono />
      <SummaryItem label="Estado" value={payment.status} />
    </dl>
  )
}

function SummaryItem({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <dt
        style={{
          fontSize: 10,
          color: TEXT_MUTED,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          margin: '4px 0 0',
          fontSize: 14,
          color: TEXT_PRIMARY,
          fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        }}
      >
        {value}
      </dd>
    </div>
  )
}

function FieldBlock({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        style={{
          fontSize: 11,
          color: TEXT_MUTED,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

function fieldStyle({ mono }: { mono?: boolean }): React.CSSProperties {
  return {
    minHeight: 60,
    padding: '10px 14px',
    width: '100%',
    background: 'rgba(9,9,11,0.55)',
    color: TEXT_PRIMARY,
    border: `1px solid ${BORDER_SILVER}`,
    borderRadius: 10,
    fontSize: 14,
    fontFamily: mono ? 'var(--font-mono)' : 'inherit',
    outline: 'none',
  }
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    padding: '0 20px',
    fontSize: 14,
    fontWeight: 600,
    color: '#0A0A0C',
    background: ACCENT_SILVER,
    border: 'none',
    borderRadius: 10,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  }
}

function secondaryBtn(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    padding: '0 20px',
    fontSize: 14,
    fontWeight: 600,
    color: ACCENT_SILVER,
    background: 'rgba(192,197,206,0.08)',
    border: `1px solid ${BORDER_SILVER}`,
    borderRadius: 10,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  }
}
