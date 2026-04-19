'use client'

import { useState } from 'react'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_BRIGHT,
  BG_ELEVATED,
  BORDER_HAIRLINE,
  GREEN,
  RED,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '@/lib/design-system'
import { useTrack } from '@/lib/telemetry/useTrack'
import { saveConfig } from '@/app/actions/classification'
import type { ClassificationSheetConfig } from '@/types/classification'

interface Props {
  traficoId: string
  config: ClassificationSheetConfig
  onConfigReplace: (c: ClassificationSheetConfig) => void
}

type Status = { kind: 'idle' } | { kind: 'ok'; msg: string } | { kind: 'error'; msg: string }

export function ActionBar({ traficoId, config, onConfigReplace: _onConfigReplace }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const track = useTrack()

  async function handleGenerate(format: 'pdf' | 'excel') {
    setBusy(format)
    setStatus({ kind: 'idle' })
    try {
      const res = await fetch(
        `/api/classification/${encodeURIComponent(traficoId)}/generate`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ config }),
        },
      )
      const body = (await res.json()) as {
        data?: { pdfUrl?: string; excelUrl?: string }
        error?: { message?: string }
      }
      if (!res.ok || !body.data) {
        setStatus({
          kind: 'error',
          msg: body.error?.message ?? 'Generación fallida',
        })
        return
      }
      const url = format === 'pdf' ? body.data.pdfUrl : body.data.excelUrl
      if (url) {
        const a = document.createElement('a')
        a.href = url
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        document.body.appendChild(a)
        a.click()
        a.remove()
      }
      track('page_view', {
        entityType: 'trafico_classification',
        entityId: traficoId,
        metadata: {
          event:
            format === 'pdf'
              ? 'classification_pdf_generated'
              : 'classification_excel_generated',
        },
      })
      setStatus({
        kind: 'ok',
        msg: format === 'pdf' ? 'PDF generado' : 'Excel generado',
      })
    } finally {
      setBusy(null)
    }
  }

  async function handleEmail() {
    if (config.email_recipients.length === 0) {
      setStatus({
        kind: 'error',
        msg: 'Agrega al menos un destinatario antes de enviar',
      })
      return
    }
    setBusy('email')
    setStatus({ kind: 'idle' })
    try {
      // Ensure a sheet exists (generate) then email it.
      await fetch(`/api/classification/${encodeURIComponent(traficoId)}/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      const res = await fetch(
        `/api/classification/${encodeURIComponent(traficoId)}/email`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ recipients: config.email_recipients }),
        },
      )
      const body = (await res.json()) as {
        data?: { ok?: boolean }
        error?: { message?: string }
      }
      if (!res.ok || !body.data?.ok) {
        setStatus({
          kind: 'error',
          msg: body.error?.message ?? 'Envío fallido',
        })
        return
      }
      track('page_view', {
        entityType: 'trafico_classification',
        entityId: traficoId,
        metadata: { event: 'classification_email_sent' },
      })
      setStatus({ kind: 'ok', msg: 'Correo enviado' })
    } finally {
      setBusy(null)
    }
  }

  async function handleSaveConfig() {
    setBusy('save')
    setStatus({ kind: 'idle' })
    try {
      const result = await saveConfig(config)
      if (!result.ok) {
        setStatus({ kind: 'error', msg: result.error ?? 'No se pudo guardar' })
        return
      }
      track('page_view', {
        entityType: 'trafico_classification',
        entityId: traficoId,
        metadata: { event: 'classification_config_saved' },
      })
      setStatus({ kind: 'ok', msg: 'Configuración guardada' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: BG_ELEVATED,
        borderTop: `1px solid ${BORDER_HAIRLINE}`,
        padding: '12px 16px',
        display: 'flex',
        gap: 10,
        justifyContent: 'flex-end',
        alignItems: 'center',
        zIndex: 40,
      }}
    >
      {status.kind !== 'idle' && (
        <div
          style={{
            fontSize: 'var(--aguila-fs-compact)',
            color: status.kind === 'ok' ? GREEN : RED,
            marginRight: 12,
          }}
        >
          {status.msg}
        </div>
      )}
      <Btn
        disabled={busy !== null}
        onClick={handleSaveConfig}
        label={busy === 'save' ? 'Guardando…' : 'Guardar configuración'}
        variant="ghost"
      />
      <Btn
        disabled={busy !== null}
        onClick={() => handleGenerate('excel')}
        label={busy === 'excel' ? 'Generando…' : 'Generar Excel'}
        variant="ghost"
      />
      <Btn
        disabled={busy !== null}
        onClick={() => handleGenerate('pdf')}
        label={busy === 'pdf' ? 'Generando…' : 'Generar PDF'}
        variant="primary"
      />
      <Btn
        disabled={busy !== null}
        onClick={handleEmail}
        label={busy === 'email' ? 'Enviando…' : 'Enviar por correo'}
        variant="primary"
      />
    </div>
  )
}

function Btn({
  label,
  onClick,
  disabled,
  variant,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  variant: 'primary' | 'ghost'
}) {
  const primary = variant === 'primary'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: 60,
        padding: '0 20px',
        background: primary ? ACCENT_SILVER : 'rgba(255,255,255,0.04)',
        color: primary ? 'var(--portal-ink-0)' : TEXT_PRIMARY,
        border: `1px solid ${primary ? ACCENT_SILVER_BRIGHT : BORDER_HAIRLINE}`,
        borderRadius: 12,
        fontSize: 'var(--aguila-fs-body)',
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        letterSpacing: '0.02em',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  )
}

// Keep TEXT_MUTED referenced to avoid unused-import noise on stricter configs.
void TEXT_MUTED
