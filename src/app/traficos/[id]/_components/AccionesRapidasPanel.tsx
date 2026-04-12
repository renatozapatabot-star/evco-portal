'use client'

import { useState, useTransition } from 'react'
import { Send, RefreshCw } from 'lucide-react'
import {
  ACCENT_CYAN,
  BG_CARD,
  BORDER,
  GLASS_BLUR,
  GLASS_SHADOW,
  GOLD,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '@/lib/design-system'
import { useToast } from '@/components/Toast'
import { useTrack } from '@/lib/telemetry/useTrack'
import { updateTraficoStatus } from '../actions'

const STATUS_OPTIONS = [
  'En Proceso',
  'Documentacion',
  'En Aduana',
  'Pedimento Pagado',
  'Cruzado',
]

export function AccionesRapidasPanel({
  traficoId,
  currentStatus,
  canEdit,
}: {
  traficoId: string
  currentStatus: string
  canEdit: boolean
}) {
  const [status, setStatus] = useState(currentStatus)
  const [pending, startTransition] = useTransition()
  const { toast } = useToast()
  const track = useTrack()

  function commit(next: string) {
    if (next === currentStatus) return
    startTransition(async () => {
      const res = await updateTraficoStatus(traficoId, next)
      if (!res.ok) {
        toast(`No se pudo actualizar el estatus: ${res.error}`, 'error')
        setStatus(currentStatus)
        return
      }
      track('trafico_status_changed', {
        entityType: 'trafico',
        entityId: traficoId,
        metadata: { from: currentStatus, to: next },
      })
      toast(`Estatus actualizado a ${next}`, 'success')
    })
  }

  function requestDocs() {
    track('page_view', {
      entityType: 'trafico_action',
      entityId: traficoId,
      metadata: { action: 'solicitar_documentos_stub' },
    })
    toast('Disponible próximamente — Bloque 5', 'info')
  }

  return (
    <div
      style={{
        background: BG_CARD,
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        border: `1px solid ${BORDER}`,
        borderRadius: 20,
        padding: '16px 20px',
        boxShadow: GLASS_SHADOW,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: TEXT_MUTED,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 14,
        }}
      >
        Acciones rápidas
      </div>

      <label
        htmlFor="status-select"
        style={{ display: 'block', fontSize: 11, color: TEXT_MUTED, marginBottom: 6 }}
      >
        Estatus
      </label>
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <select
          id="status-select"
          value={status}
          disabled={!canEdit || pending}
          onChange={(e) => {
            const next = e.target.value
            setStatus(next)
            commit(next)
          }}
          style={{
            width: '100%',
            minHeight: 60,
            padding: '0 14px',
            background: 'rgba(0,0,0,0.3)',
            color: TEXT_PRIMARY,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            fontSize: 13,
            cursor: canEdit && !pending ? 'pointer' : 'not-allowed',
            opacity: canEdit ? 1 : 0.6,
            appearance: 'none',
          }}
        >
          {!STATUS_OPTIONS.includes(status) && status && (
            <option value={status}>{status}</option>
          )}
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {pending && (
          <RefreshCw
            size={14}
            style={{
              position: 'absolute',
              right: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: ACCENT_CYAN,
              animation: 'spin 1s linear infinite',
            }}
          />
        )}
      </div>

      <button
        type="button"
        onClick={requestDocs}
        style={{
          width: '100%',
          minHeight: 60,
          padding: '0 16px',
          background: GOLD,
          color: '#0B1220',
          border: 'none',
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          letterSpacing: '0.02em',
        }}
      >
        <Send size={14} />
        Solicitar documentos
      </button>
      <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 8, textAlign: 'center' }}>
        Envío por correo con plantilla (Bloque 5)
      </div>
      <style>{`@keyframes spin { from { transform: translateY(-50%) rotate(0deg); } to { transform: translateY(-50%) rotate(360deg); } }`}</style>
    </div>
  )
}
