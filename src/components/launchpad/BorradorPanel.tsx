'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { fmtUSD } from '@/lib/format-utils'
import type { BorradorDetail } from '@/lib/launchpad-actions'

interface Props {
  detail: BorradorDetail
  onComplete: (actionType: string) => void
  loading: boolean
}

type PanelState = 'idle' | 'countdown' | 'blessing' | 'done'

function ConfidenceBadge({ value }: { value: number }) {
  const color = value >= 85 ? '#16A34A' : value >= 70 ? '#D4952A' : '#DC2626'
  const bg = value >= 85 ? 'rgba(34,197,94,0.1)' : value >= 70 ? 'rgba(192,197,206,0.08)' : 'rgba(239,68,68,0.1)'
  return (
    <span
      className="font-mono"
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 'var(--aguila-fs-body)',
        fontWeight: 600,
        color,
        background: bg,
      }}
    >
      {value}%
    </span>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
      <span style={{ fontSize: 'var(--aguila-fs-section)', color: '#6B6B6B' }}>{label}</span>
      <span
        className={mono ? 'font-mono' : undefined}
        style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 600, color: '#1A1A1A' }}
      >
        {value}
      </span>
    </div>
  )
}

export function BorradorPanel({ detail, onComplete, loading }: Props) {
  const router = useRouter()
  const [state, setState] = useState<PanelState>('idle')
  const [countdown, setCountdown] = useState(5)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)

  // Countdown logic
  useEffect(() => {
    if (state !== 'countdown') return

    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          setState('blessing')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [state])

  // Blessing → done
  useEffect(() => {
    if (state !== 'blessing') return
    const timer = setTimeout(() => {
      onComplete('approve')
      setState('done')
    }, 2000)
    return () => clearTimeout(timer)
  }, [state, onComplete])

  const handleCancel = () => {
    clearInterval(intervalRef.current)
    setCountdown(5)
    setState('idle')
  }

  // Countdown view
  if (state === 'countdown') {
    const circumference = 2 * Math.PI * 34
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <svg width={80} height={80} viewBox="0 0 80 80">
          <circle cx={40} cy={40} r={34} fill="none" stroke="#E8E5E0" strokeWidth={4} />
          <circle
            cx={40} cy={40} r={34}
            fill="none" stroke="#E8EAED" strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (countdown / 5)}
            transform="rotate(-90 40 40)"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
          <text
            x={40} y={44}
            textAnchor="middle"
            style={{ fontSize: 'var(--aguila-fs-title)', fontWeight: 700, fill: '#E8EAED', fontFamily: 'var(--font-jetbrains-mono)' }}
          >
            {countdown}
          </text>
        </svg>
        <button
          onClick={handleCancel}
          style={{
            display: 'block',
            margin: '16px auto 0',
            minHeight: 60,
            minWidth: 200,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.045)',
            color: '#DC2626',
            border: '1px solid #DC2626',
            fontSize: 'var(--aguila-fs-body-lg)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
        <p style={{ margin: '12px 0 0', fontSize: 'var(--aguila-fs-section)', color: '#6B6B6B' }}>
          Se aprobará en {countdown} segundo{countdown !== 1 ? 's' : ''}
        </p>
      </div>
    )
  }

  // Blessing view
  if (state === 'blessing') {
    return (
      <div style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 'var(--aguila-fs-kpi-hero)', marginBottom: 12, color: '#E8EAED' }}>&#10003;</div>
        <p style={{ fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
          Patente 3596 honrada.
        </p>
        <p style={{ fontSize: 'var(--aguila-fs-section)', color: '#6B6B6B', margin: '4px 0 0' }}>
          Gracias, Tito.
        </p>
      </div>
    )
  }

  // Done view
  if (state === 'done') {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 'var(--aguila-fs-kpi-compact)', color: '#16A34A', marginBottom: 8 }}>&#10003;</div>
        <p style={{ fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
          Borrador aprobado
        </p>
      </div>
    )
  }

  // Idle view — show draft summary
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span
          className="font-mono"
          style={{
            fontSize: 'var(--aguila-fs-compact)',
            padding: '2px 8px',
            borderRadius: 6,
            background: '#F5F4F0',
            color: '#6B6B6B',
            fontWeight: 600,
          }}
        >
          Tier {detail.tier}
        </span>
        <ConfidenceBadge value={detail.confidence} />
      </div>

      {/* Summary */}
      <div style={{ borderTop: '1px solid #E8E5E0', paddingTop: 12 }}>
        <InfoRow label="Proveedor" value={detail.supplier} />
        <InfoRow label="País" value={detail.country} />
        {detail.invoice_number && (
          <InfoRow label="Factura" value={detail.invoice_number} mono />
        )}
        <InfoRow label="Valor" value={fmtUSD(detail.valor_total_usd)} mono />
        <InfoRow label="Régimen" value={detail.regimen} />
        <InfoRow
          label="Productos"
          value={`${detail.products_count} línea${detail.products_count !== 1 ? 's' : ''}`}
          mono
        />
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button
          onClick={() => setState('countdown')}
          disabled={loading}
          style={{
            flex: 1,
            minHeight: 60,
            borderRadius: 12,
            background: '#E8EAED',
            color: '#FFFFFF',
            border: 'none',
            fontSize: 'var(--aguila-fs-body-lg)',
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          &#10003; Aprobar
        </button>
        <button
          onClick={() => router.push(`/drafts/${detail.draft_id}`)}
          disabled={loading}
          style={{
            flex: 1,
            minHeight: 60,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.045)',
            color: '#1A1A1A',
            border: '1px solid #E8E5E0',
            fontSize: 'var(--aguila-fs-body-lg)',
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          &#9998; Editar
        </button>
      </div>
    </div>
  )
}
