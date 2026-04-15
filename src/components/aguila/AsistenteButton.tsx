'use client'

import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import {
  ACCENT_SILVER_DIM, GLASS_BLUR, TEXT_PRIMARY,
  ZAPATA_GOLD_BRIGHT, ZAPATA_GOLD_GLOW,
} from '@/lib/design-system'

export type AsistenteRoleTag = 'trafico' | 'contabilidad' | 'warehouse' | 'operator' | 'client' | 'owner'

const DEFAULT_HELLO: Record<AsistenteRoleTag, string> = {
  trafico:      'Estoy con los embarques activos. Puedo actualizar estatus, solicitar documentos, o vincular pedimentos. ¿Qué necesitas?',
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
  /** Visible label on the button. Default: 'Asistente ZAPATA AI'. */
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
  label = 'Asistente ZAPATA AI',
}: AsistenteButtonProps) {
  const hello = firstMessage ?? DEFAULT_HELLO[roleTag]
  const params = new URLSearchParams({ ctx: roleTag, hello })
  const target = `${href}?${params.toString()}`

  return (
    <Link
      href={target}
      aria-label={`${label} — contexto ${roleTag}`}
      className="zapata-asistente-btn"
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        zIndex: 50,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        minHeight: 60,
        padding: '0 22px',
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        border: '1px solid rgba(192,197,206,0.18)',
        borderRadius: 30,
        boxShadow: `0 10px 30px rgba(0,0,0,0.6), 0 0 24px ${ZAPATA_GOLD_GLOW}`,
        color: TEXT_PRIMARY,
        fontSize: 'var(--aguila-fs-body, 13px)',
        fontWeight: 600,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        transition: 'transform 150ms ease, box-shadow 200ms ease, border-color 200ms ease',
      }}
    >
      <MessageSquare size={18} color={ZAPATA_GOLD_BRIGHT} aria-hidden />
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
      <style>{`
        .zapata-asistente-btn:hover {
          transform: translateY(-1px);
          border-color: rgba(244,212,122,0.45) !important;
          box-shadow: 0 14px 40px rgba(0,0,0,0.7), 0 0 32px rgba(244,212,122,0.32) !important;
        }
      `}</style>
    </Link>
  )
}
