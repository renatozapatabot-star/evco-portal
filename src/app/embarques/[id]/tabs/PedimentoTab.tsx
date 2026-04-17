'use client'

import Link from 'next/link'
import { CreditCard, Download, Calendar, FileCheck, AlertCircle } from 'lucide-react'
import { fmtDate, fmtUSDCompact } from '@/lib/format-utils'
import { formatPedimento } from '@/lib/format/pedimento'
import type { TraficoRow } from '../types'

interface Props {
  traficoId: string
  trafico: TraficoRow
  /** Fecha del pago del pedimento — pulled from globalpc_facturas by the
   *  server page and forwarded via chain data. */
  fechaPago: string | null
  /** Whether at least one factura has a pago registrado. */
  pedimentoPaid: boolean
  /** Required + uploaded counts — drive the next-action CTA when the
   *  pedimento isn't paid yet. */
  missingDocsCount: number
  /** Raw importe from trafico (may be null when aduanet hasn't synced). */
  importeTotalUsd: number | null
}

/**
 * Pedimento tab — the SAT-audit answer for this embarque.
 *
 * Content decisions (per Renato v3 unification):
 *   · Pedimento number shown with canonical spacing (DD AA PPPP SSSSSSS).
 *   · Prominent "Descargar PDF" CTA (gold gradient, invariant #2 OK —
 *     this is a true action CTA).
 *   · Payment status + date (fecha_pago from facturas).
 *   · Fecha de cruce when crossed.
 *   · Importe total USD when aduanet has synced.
 *   · When missing docs: subtle amber hint "N documentos pendientes antes
 *     del pago" linking to the Documentos tab.
 *
 * The DTA/IGI/IVA breakdown isn't surfaced here — that's in the
 * auto-generated PDF and the operator-only breakdown tab. Client
 * surfaces stay calm per invariant #24.
 */
export function PedimentoTab({
  traficoId,
  trafico,
  fechaPago,
  pedimentoPaid,
  missingDocsCount,
  importeTotalUsd,
}: Props) {
  const pedimentoPretty = trafico.pedimento ? formatPedimento(trafico.pedimento) : null
  const crossed = !!trafico.fecha_cruce

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Primary card — pedimento identity + PDF CTA */}
      <section
        style={{
          padding: '20px 22px',
          borderRadius: 16,
          background: 'rgba(0,0,0,0.32)',
          border: `1px solid ${trafico.pedimento ? 'rgba(192,197,206,0.16)' : 'rgba(251,191,36,0.22)'}`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div
            aria-hidden
            style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(192,197,206,0.08)',
              border: '1px solid rgba(192,197,206,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              color: '#C0C5CE',
            }}
          >
            <CreditCard size={20} strokeWidth={1.8} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 'var(--aguila-fs-meta, 11px)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(148,163,184,0.78)',
              marginBottom: 4,
            }}>
              Pedimento
            </div>
            {pedimentoPretty ? (
              <div
                className="font-mono"
                style={{
                  fontSize: 'var(--aguila-fs-title, 22px)',
                  fontWeight: 700,
                  color: '#E6EDF3',
                  letterSpacing: '-0.005em',
                  marginBottom: 8,
                }}
              >
                {pedimentoPretty}
              </div>
            ) : (
              <div
                style={{
                  fontSize: 'var(--aguila-fs-section, 15px)',
                  color: 'rgba(251,191,36,0.88)',
                  marginBottom: 8,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <AlertCircle size={16} strokeWidth={1.8} />
                Pedimento pendiente de asignar
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: 16,
                flexWrap: 'wrap',
                fontSize: 'var(--aguila-fs-body, 13px)',
                color: 'rgba(205,214,224,0.82)',
              }}
            >
              {trafico.regimen && (
                <span>
                  <strong style={{ color: '#E6EDF3' }}>Régimen:</strong>{' '}
                  <span className="font-mono">{trafico.regimen}</span>
                </span>
              )}
              {importeTotalUsd != null && importeTotalUsd > 0 && (
                <span>
                  <strong style={{ color: '#E6EDF3' }}>Valor:</strong>{' '}
                  <span className="font-mono">{fmtUSDCompact(importeTotalUsd)}</span>
                </span>
              )}
            </div>
          </div>

          {trafico.pedimento && (
            <a
              href={`/api/pedimento-pdf?trafico=${encodeURIComponent(traficoId)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Descargar pedimento en PDF"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 60,
                padding: '0 22px',
                borderRadius: 14,
                background: 'linear-gradient(135deg, #F4D47A 0%, #C9A74A 50%, #8F7628 100%)',
                color: '#0A0A0C',
                fontSize: 'var(--aguila-fs-body, 13px)',
                fontWeight: 700,
                letterSpacing: '0.02em',
                textDecoration: 'none',
                boxShadow: '0 10px 30px rgba(201,167,74,0.25), 0 0 20px rgba(201,167,74,0.12), inset 0 1px 0 rgba(255,255,255,0.22)',
                flexShrink: 0,
                transition: 'all var(--dur-fast, 150ms) var(--ease-brand, cubic-bezier(0.22, 1, 0.36, 1))',
              }}
            >
              <Download size={16} strokeWidth={2} />
              Descargar PDF
            </a>
          )}
        </div>
      </section>

      {/* Status grid — 3 facts that Ursula wants at a glance */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 10,
        }}
      >
        <StatusCard
          icon={<FileCheck size={16} strokeWidth={1.8} />}
          label="Pago"
          value={pedimentoPaid ? 'Pagado' : 'Pendiente'}
          sub={pedimentoPaid && fechaPago ? fmtDate(fechaPago) : 'Aún no registrado'}
          tone={pedimentoPaid ? 'success' : 'warning'}
        />
        <StatusCard
          icon={<Calendar size={16} strokeWidth={1.8} />}
          label="Cruce"
          value={crossed ? 'Cruzado' : 'Pendiente'}
          sub={crossed && trafico.fecha_cruce ? fmtDate(trafico.fecha_cruce) : 'Sin fecha'}
          tone={crossed ? 'success' : 'neutral'}
        />
        <StatusCard
          icon={<AlertCircle size={16} strokeWidth={1.8} />}
          label="Documentos"
          value={missingDocsCount === 0 ? 'Completos' : `${missingDocsCount} pendientes`}
          sub={missingDocsCount === 0 ? 'Expediente listo' : 'Ver en la pestaña Documentos'}
          tone={missingDocsCount === 0 ? 'success' : 'warning'}
        />
      </section>

      {missingDocsCount > 0 && !pedimentoPaid && (
        <section
          role="status"
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            background: 'rgba(251,191,36,0.06)',
            border: '1px solid rgba(251,191,36,0.22)',
            fontSize: 'var(--aguila-fs-body, 13px)',
            color: 'rgba(230,237,243,0.82)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <span>
            <strong style={{ color: '#FBBF24' }}>{missingDocsCount} documento{missingDocsCount === 1 ? '' : 's'}</strong> {missingDocsCount === 1 ? 'falta' : 'faltan'} antes de que se pueda pagar el pedimento.
          </span>
          <Link
            href={`#docs-tab`}
            style={{
              color: '#F4D47A',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
              fontWeight: 600,
            }}
          >
            Ver documentos →
          </Link>
        </section>
      )}
    </div>
  )
}

function StatusCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  tone: 'success' | 'warning' | 'neutral'
}) {
  const accent =
    tone === 'success' ? 'rgba(34,197,94,0.55)'
      : tone === 'warning' ? 'rgba(251,191,36,0.55)'
      : 'rgba(192,197,206,0.4)'
  const pillColor =
    tone === 'success' ? '#86EFAC'
      : tone === 'warning' ? '#FBBF24'
      : 'rgba(192,197,206,0.85)'
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        background: 'rgba(0,0,0,0.22)',
        border: `1px solid rgba(192,197,206,0.12)`,
        borderLeft: `3px solid ${accent}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(192,197,206,0.78)' }}>
        {icon}
        <span style={{
          fontSize: 'var(--aguila-fs-meta, 11px)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'rgba(148,163,184,0.75)',
          fontWeight: 600,
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: 'var(--aguila-fs-section, 15px)',
        fontWeight: 700,
        color: pillColor,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontSize: 'var(--aguila-fs-meta, 11px)',
          color: 'rgba(148,163,184,0.75)',
          fontFamily: 'var(--font-mono)',
        }}>
          {sub}
        </div>
      )}
    </div>
  )
}
