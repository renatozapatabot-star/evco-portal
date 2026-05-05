'use client'

import Link from 'next/link'
import { MessageSquare, Tags } from 'lucide-react'
import {
  ACCENT_SILVER, ACCENT_SILVER_DIM, GLASS_BLUR, TEXT_PRIMARY, TEXT_SECONDARY,
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
  /** Visible label on the button. Default: 'Asistente PORTAL'. */
  label?: string
}

/**
 * Role-aware floating assistant button.
 *
 * Sits bottom-right, 60px touch target, composes inline glass chrome
 * (does NOT wrap GlassCard — sits outside card flow). Links to
 * `/cruz?ctx={roleTag}&hello={firstMessage}` so the natural-language
 * chat surface can prepend the role-specific first message to the
 * system prompt. `/cruz` consumes the Phase 3 #1 agent tools
 * (analyze_trafico, tenant_anomalies, etc.) + Phase 3 #4
 * draft_mensajeria. Callers may pass `href='/mensajeria'` to keep
 * the legacy thread-based chat destination.
 */
export function AsistenteButton({
  roleTag,
  firstMessage,
  href = '/cruz',
  label = 'Asistente PORTAL',
}: AsistenteButtonProps) {
  const hello = firstMessage ?? DEFAULT_HELLO[roleTag]
  const params = new URLSearchParams({ ctx: roleTag, hello })
  const target = `${href}?${params.toString()}`

  return (
    <>
    {/* Clasificador companion — sibling fab. Hidden on very small screens so it
        doesn't crowd the primary Asistente pill. */}
    <Link
      href="/clasificar"
      aria-label="Abrir clasificador arancelario"
      className="zapata-clasificador-btn"
      style={{
        position: 'fixed',
        right: 280,
        bottom: 20,
        zIndex: 49,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 60,
        padding: '0 18px',
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        border: '1px solid rgba(192,197,206,0.18)',
        borderRadius: 30,
        boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
        color: TEXT_SECONDARY,
        fontSize: 'var(--aguila-fs-body, 13px)',
        fontWeight: 600,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        transition: 'transform 150ms ease, box-shadow 200ms ease, border-color 200ms ease, color 200ms ease',
      }}
    >
      <Tags size={16} aria-hidden />
      <span>Clasificador</span>
      <style precedence="default">{`
        .zapata-clasificador-btn:hover {
          transform: translateY(-1px);
          color: #E8EAED !important;
          border-color: rgba(244,212,122,0.35) !important;
        }
        @media (max-width: 720px) {
          .zapata-clasificador-btn { display: none !important; }
        }
      `}</style>
    </Link>
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
        boxShadow: '0 10px 30px rgba(0,0,0,0.6), 0 0 20px rgba(192,197,206,0.08)',
        color: TEXT_PRIMARY,
        fontSize: 'var(--aguila-fs-body, 13px)',
        fontWeight: 600,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        transition: 'transform 150ms ease, box-shadow 200ms ease, border-color 200ms ease',
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
      <style precedence="default">{`
        .zapata-asistente-btn:hover {
          transform: translateY(-1px);
          border-color: rgba(244,212,122,0.45) !important;
          box-shadow: 0 14px 40px rgba(0,0,0,0.7), 0 0 32px rgba(244,212,122,0.32) !important;
        }
        /* Audit Cluster F (2026-05-05): pill overlapped cards on 640px.
           Lift it higher and shrink the role-tag pad so it sits cleanly
           above the bottom-stacked cards on phones. */
        @media (max-width: 720px) {
          .zapata-asistente-btn {
            bottom: 16px !important;
            right: 16px !important;
            padding: 0 16px !important;
          }
        }
      `}</style>
    </Link>
    </>
  )
}
