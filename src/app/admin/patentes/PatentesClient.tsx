'use client'

import { useMemo } from 'react'
import {
  BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW,
  TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY,
} from '@/lib/design-system'
import { SectionHeader } from '@/components/aguila'

export interface PatenteRow {
  id: string
  numero: string
  nombre: string
  efirma_expiry: string | null
  fiel_expiry: string | null
  patent_renewal_date: string | null
  authorized_offices: string[] | null
  certificate_file_url: string | null
  notes: string | null
  active: boolean
  updated_at: string
}

type Severity = 'expired' | 'red' | 'amber' | 'yellow' | 'plum' | 'green' | 'none'

function severityFor(expiryIso: string | null): { severity: Severity; days: number | null; label: string } {
  if (!expiryIso) return { severity: 'none', days: null, label: '—' }
  const today = new Date()
  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  const expiryMs = Date.UTC(
    Number(expiryIso.slice(0, 4)),
    Number(expiryIso.slice(5, 7)) - 1,
    Number(expiryIso.slice(8, 10)),
  )
  const days = Math.floor((expiryMs - todayMs) / 86_400_000)
  if (days < 0) return { severity: 'expired', days, label: `${Math.abs(days)}d vencido` }
  if (days <= 30) return { severity: 'red', days, label: `${days}d` }
  if (days <= 60) return { severity: 'amber', days, label: `${days}d` }
  if (days <= 90) return { severity: 'yellow', days, label: `${days}d` }
  return { severity: 'green', days, label: `${days}d` }
}

const SEV_STYLE: Record<Severity, { bg: string; fg: string }> = {
  expired: { bg: 'rgba(239,68,68,0.24)', fg: '#FCA5A5' },
  red:     { bg: 'rgba(239,68,68,0.14)', fg: '#FCA5A5' },
  amber:   { bg: 'rgba(251,146,60,0.14)', fg: '#FDBA74' },
  yellow:  { bg: 'rgba(251,191,36,0.14)', fg: '#FDE68A' },
  plum:    { bg: 'rgba(126,34,206,0.14)', fg: '#C4B5FD' },
  green:   { bg: 'rgba(34,197,94,0.14)', fg: '#86EFAC' },
  none:    { bg: 'rgba(148,163,184,0.08)', fg: TEXT_MUTED },
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Chicago' })
  } catch {
    return iso
  }
}

export function PatentesClient({ initialRows }: { initialRows: PatenteRow[] }) {
  const criticalCount = useMemo(() => {
    let n = 0
    for (const p of initialRows) {
      const efirma = severityFor(p.efirma_expiry).severity
      const fiel = severityFor(p.fiel_expiry).severity
      if (['expired', 'red'].includes(efirma) || ['expired', 'red'].includes(fiel)) n++
    }
    return n
  }, [initialRows])

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 20 }}>
      <SectionHeader title="Patentes registradas" count={initialRows.length} />
      {criticalCount > 0 && (
        <div style={{
          padding: 16, marginTop: 16, marginBottom: 16, borderRadius: 14,
          background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.35)',
          color: '#FCA5A5', fontSize: 13, fontWeight: 600,
        }}>
          {criticalCount} certificado{criticalCount === 1 ? '' : 's'} vencido{criticalCount === 1 ? '' : 's'} o próximo{criticalCount === 1 ? '' : 's'} a vencer (≤30 días). Renovar urgente.
        </div>
      )}

      <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
        {initialRows.map((p) => {
          const efirma = severityFor(p.efirma_expiry)
          const fiel = severityFor(p.fiel_expiry)
          const renew = severityFor(p.patent_renewal_date)
          const cards: Array<{ label: string; expiry: string | null; sev: ReturnType<typeof severityFor> }> = [
            { label: 'E_FIRMA', expiry: p.efirma_expiry, sev: efirma },
            { label: 'FIEL', expiry: p.fiel_expiry, sev: fiel },
            { label: 'Renovación patente', expiry: p.patent_renewal_date, sev: renew },
          ]
          return (
            <section key={p.id} style={{
              background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 20,
              padding: 24, backdropFilter: `blur(${GLASS_BLUR})`, boxShadow: GLASS_SHADOW,
              opacity: p.active ? 1 : 0.5,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: TEXT_MUTED, fontWeight: 700 }}>
                    Patente
                  </div>
                  <h2 style={{ margin: '4px 0 0 0', fontSize: 22, fontWeight: 700, color: TEXT_PRIMARY, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                    {p.numero}
                  </h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: 13, color: TEXT_SECONDARY }}>
                    {p.nombre}
                  </p>
                </div>
                <div style={{ fontSize: 11, color: TEXT_MUTED, textAlign: 'right' }}>
                  {(p.authorized_offices ?? []).join(' · ') || 'Sin oficinas asignadas'}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {cards.map((c) => {
                  const st = SEV_STYLE[c.sev.severity]
                  return (
                    <div key={c.label} style={{
                      padding: 14, borderRadius: 14,
                      background: 'rgba(255,255,255,0.02)',
                      border: `1px solid ${BORDER}`,
                    }}>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: TEXT_MUTED, fontWeight: 700 }}>
                        {c.label}
                      </div>
                      <div style={{
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                        fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY,
                        marginTop: 6,
                      }}>
                        {fmtDate(c.expiry)}
                      </div>
                      <span style={{
                        display: 'inline-block', marginTop: 8,
                        padding: '2px 10px', borderRadius: 20,
                        background: st.bg, color: st.fg,
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                        fontSize: 11, fontWeight: 700,
                      }}>
                        {c.sev.label}
                      </span>
                    </div>
                  )
                })}
              </div>

              {p.certificate_file_url && (
                <div style={{ marginTop: 16, fontSize: 12 }}>
                  <a href={p.certificate_file_url} target="_blank" rel="noopener noreferrer" style={{ color: '#C0C5CE' }}>
                    Ver certificado actual →
                  </a>
                </div>
              )}

              {p.notes && (
                <div style={{ marginTop: 12, fontSize: 12, color: TEXT_SECONDARY, fontStyle: 'italic' }}>
                  {p.notes}
                </div>
              )}
            </section>
          )
        })}
      </div>

      <p style={{ marginTop: 20, fontSize: 11, color: TEXT_MUTED }}>
        Alertas automáticas en Chat: 90 · 60 · 30 días · vencimiento.
      </p>
    </div>
  )
}
