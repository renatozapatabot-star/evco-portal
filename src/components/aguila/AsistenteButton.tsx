'use client'

import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import {
  ACCENT_SILVER, ACCENT_SILVER_DIM, BG_ELEVATED, BORDER_HAIRLINE,
  GLASS_BLUR, GLASS_SHADOW, TEXT_PRIMARY,
} from '@/lib/design-system'

export type AsistenteRoleTag = 'trafico' | 'contabilidad' | 'warehouse' | 'operator' | 'client' | 'owner'

const DEFAULT_HELLO: Record<AsistenteRoleTag, string> = {
  trafico:      'Estoy con los tráficos activos. Puedo actualizar estatus, solicitar documentos, o vincular pedimentos. ¿Qué necesitas?',
  contabilidad: 'Revisando econta y cartera. Puedo marcar pagos, exportar IIF, o rastrear CxC. ¿Qué hacemos?',
  warehouse:    'En bodega. Puedo recibir, asignar ubicación, subir foto, o autorizar salida. ¿Qué llegó?',
  operator:     'Listo para ayudar con el flujo operativo. ¿Qué necesitas?',
  client:       '¿En qué te puedo apoyar hoy?',
  owner:        'Vista ejecutiva lista. ¿Qué necesitas revisar?',
}

export interface AsistenteButtonProps {
  roleTag: AsistenteRoleTag
  /** Override the default first message for this role. */
  firstMessage?: string
  /** Route override. Default: `/mensajeria`. */
  href?: string
  /** Visible label on the button. Default: 'Asistente AGUILA'. */
  label?: string
}

/**
 * Role-aware floating assistant button.
 *
 * Sits bottom-right, 60px touch target, composes inline glass chrome
 * (does NOT wrap GlassCard — sits outside card flow). Links to
 * `/mensajeria?ctx={roleTag}&hello={firstMessage}` so the chat surface
 * can prepend the role-specific first message to the system prompt.
 */
export function AsistenteButton({
  roleTag,
  firstMessage,
  href = '/mensajeria',
  label = 'Asistente AGUILA',
}: AsistenteButtonProps) {
  const hello = firstMessage ?? DEFAULT_HELLO[roleTag]
  const params = new URLSearchParams({ ctx: roleTag, hello })
  const target = `${href}?${params.toString()}`

  return (
    <Link
      href={target}
      aria-label={`${label} — contexto ${roleTag}`}
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        zIndex: 50,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        minHeight: 60,
        padding: '0 20px',
        background: BG_ELEVATED,
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        border: `1px solid ${BORDER_HAIRLINE}`,
        borderRadius: 30,
        boxShadow: GLASS_SHADOW,
        color: TEXT_PRIMARY,
        fontSize: 'var(--aguila-fs-body, 13px)',
        fontWeight: 600,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <MessageSquare size={18} color={ACCENT_SILVER} aria-hidden />
      <span>{label}</span>
      <span
        aria-hidden
        style={{
          fontSize: 'var(--aguila-fs-meta, 11px)',
          color: ACCENT_SILVER_DIM,
          textTransform: 'uppercase',
          letterSpacing: 'var(--aguila-ls-label, 0.08em)',
          marginLeft: 4,
        }}
      >
        {roleTag}
      </span>
    </Link>
  )
}
