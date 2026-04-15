'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
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
  pedimentoNumber: string | null
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
  pedimentoNumber,
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

  // Hero success state — unmistakable confirmation when payment is registered.
  if (status === 'confirmed' && payment) {
    return (
      <PaymentSuccessHero
        traficoId={traficoId}
        pedimentoNumber={pedimentoNumber}
        confirmationNumber={payment.confirmation_number ?? ''}
        reference={payment.reference}
        amount={payment.amount}
        bankCode={payment.bank_code}
      />
    )
  }

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
        background: 'rgba(255,255,255,0.045)',
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
            fontSize: 'var(--aguila-fs-body)',
          }}
        >
          {error}
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
              fontSize: 'var(--aguila-fs-body)',
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
          fontSize: 'var(--aguila-fs-label)',
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
          fontSize: 'var(--aguila-fs-section)',
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
          fontSize: 'var(--aguila-fs-meta)',
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
    background: 'rgba(255,255,255,0.045)',
    color: TEXT_PRIMARY,
    border: `1px solid ${BORDER_SILVER}`,
    borderRadius: 10,
    fontSize: 'var(--aguila-fs-section)',
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
    fontSize: 'var(--aguila-fs-section)',
    fontWeight: 600,
    color: '#0A0A0C',
    background: ACCENT_SILVER,
    border: 'none',
    borderRadius: 10,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  }
}

function PaymentSuccessHero({
  traficoId,
  pedimentoNumber,
  confirmationNumber,
  reference,
  amount,
  bankCode,
}: {
  traficoId: string
  pedimentoNumber: string | null
  confirmationNumber: string
  reference: string
  amount: number
  bankCode: string
}) {
  const fmtAmount = amount.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        padding: 32,
        borderRadius: 20,
        background: 'rgba(255,255,255,0.045)',
        border: `1px solid ${GREEN}55`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: `0 0 40px ${GREEN}22`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(34,197,94,0.14)',
            border: `1px solid ${GREEN}66`,
            flexShrink: 0,
          }}
        >
          <CheckCircle2 size={36} color={GREEN} strokeWidth={2.25} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span
            style={{
              fontSize: 'var(--aguila-fs-meta)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: GREEN,
              fontWeight: 700,
            }}
          >
            Pago PECE confirmado
          </span>
          <span style={{ fontSize: 'var(--aguila-fs-body)', color: TEXT_MUTED }}>
            La intención de pago quedó registrada en el sistema.
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 20,
          padding: '20px 0',
          borderTop: `1px solid ${BORDER_SILVER}`,
          borderBottom: `1px solid ${BORDER_SILVER}`,
        }}
      >
        <HeroField label="Pedimento" value={pedimentoNumber ?? 'Sin asignar'} />
        <HeroField label="Folio de confirmación" value={confirmationNumber || '—'} />
        <HeroField label="Referencia bancaria" value={reference} />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span
            style={{
              fontSize: 'var(--aguila-fs-label)',
              color: TEXT_MUTED,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Monto pagado · Banco {bankCode}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--aguila-fs-kpi-mid)',
              fontWeight: 700,
              color: TEXT_PRIMARY,
              letterSpacing: '-0.01em',
            }}
          >
            {fmtAmount} <span style={{ fontSize: 'var(--aguila-fs-body-lg)', color: TEXT_MUTED, fontWeight: 500 }}>MXN</span>
          </span>
        </div>
        <Link
          href={`/embarques/${encodeURIComponent(traficoId)}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 60,
            padding: '0 24px',
            fontSize: 'var(--aguila-fs-section)',
            fontWeight: 600,
            color: '#0A0A0C',
            background: ACCENT_SILVER,
            border: 'none',
            borderRadius: 10,
            textDecoration: 'none',
          }}
        >
          Volver al embarque
        </Link>
      </div>
    </div>
  )
}

function HeroField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span
        style={{
          fontSize: 'var(--aguila-fs-label)',
          color: TEXT_MUTED,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--aguila-fs-kpi-small)',
          fontWeight: 700,
          color: TEXT_PRIMARY,
          wordBreak: 'break-all',
        }}
      >
        {value}
      </span>
    </div>
  )
}

function secondaryBtn(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    padding: '0 20px',
    fontSize: 'var(--aguila-fs-section)',
    fontWeight: 600,
    color: ACCENT_SILVER,
    background: 'rgba(192,197,206,0.08)',
    border: `1px solid ${BORDER_SILVER}`,
    borderRadius: 10,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  }
}
