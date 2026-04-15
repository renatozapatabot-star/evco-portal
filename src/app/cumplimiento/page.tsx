'use client'

import { useEffect, useState } from 'react'
import { Calendar, FileText, Phone, Shield, AlertTriangle, FileCheck } from 'lucide-react'
import { getClientClaveCookie, getCompanyIdCookie, getCookieValue } from '@/lib/client-config'
import { daysUntilMVE } from '@/lib/compliance-dates'
import { fmtDate } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'

/* ── Light tokens (DESIGN_SYSTEM.md v6) ── */
const T = {
  card: 'var(--bg-card)',
  border: 'var(--border)',
  gold: 'var(--gold)',
  textPrimary: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  red: 'var(--danger-500)',
  redBg: 'rgba(239,68,68,0.1)',
  redBorder: '#FECACA',
  green: 'var(--success)',
  greenBg: 'rgba(34,197,94,0.1)',
  greenBorder: 'rgba(34,197,94,0.2)',
  amber: 'var(--warning-500, #D97706)',
  amberBg: 'rgba(192,197,206,0.08)',
  amberBorder: 'rgba(192,197,206,0.2)',
  radius: 8,
} as const

/* ══════════════════════════════════════════
   BROKER / ADMIN VIEW — full compliance data
   ══════════════════════════════════════════ */

function BrokerCumplimientoView() {
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [semaforoRojo, setSemaforoRojo] = useState(0)
  const [blockingDocs, setBlockingDocs] = useState(0)
  const [usmcaExpiring, setUsmcaExpiring] = useState<{ trafico: string; fecha: string }[]>([])

  const mveDays = daysUntilMVE()
  const mveUrgent = mveDays <= 7

  useEffect(() => {
    const companyId = getCompanyIdCookie()
    Promise.all([
      // Semáforo rojo: filtered by company_id from cookie
      fetch(`/api/data?table=traficos&company_id=${companyId}&limit=500&order_by=updated_at&order_dir=desc`)
        .then(r => r.json()),
    ])
      .then(([traficoRes]) => {
        const traficos = traficoRes.data ?? []

        // semáforo rojo = semaforo === 1, not yet crossed
        const rojos = traficos.filter(
          (t: Record<string, unknown>) =>
            Number(t.semaforo) === 1 && !t.fecha_cruce
        )
        setSemaforoRojo(rojos.length)

        // Blocking docs = no pedimento, not completed
        const blocking = traficos.filter(
          (t: Record<string, unknown>) => {
            const s = String(t.estatus || '').toLowerCase()
            return !t.pedimento && !s.includes('cruz') && !s.includes('complet') && !s.includes('cancel')
          }
        )
        setBlockingDocs(blocking.length)

        // USMCA expiry: traficos with usmca/t-mec tag and fecha_cruce in next 30 days
        const now = Date.now()
        const thirtyDays = 30 * 86400000
        const expiring = traficos
          .filter((t: Record<string, unknown>) => {
            const desc = String(t.descripcion_mercancia || '').toLowerCase()
            const hasUsmca = desc.includes('t-mec') || desc.includes('tmec') || desc.includes('usmca')
            if (!hasUsmca || !t.fecha_cruce) return false
            const cruceTime = new Date(String(t.fecha_cruce)).getTime()
            return cruceTime > now && cruceTime - now < thirtyDays
          })
          .map((t: Record<string, unknown>) => ({
            trafico: String(t.trafico),
            fecha: String(t.fecha_cruce),
          }))
        setUsmcaExpiring(expiring)
      })
      .catch((err: unknown) => console.error('[cumplimiento] fetch failed:', (err as Error).message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 32, minHeight: '100vh' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{
              background: T.card, border: `1px solid ${T.border}`,
              borderRadius: T.radius, height: 120, marginBottom: 16, opacity: 0.5,
            }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: isMobile ? 16 : 32, minHeight: '100vh' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 'var(--aguila-fs-title)', fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>
            Cumplimiento — Panel Interno
          </h1>
          <p style={{ fontSize: 'var(--aguila-fs-section)', color: T.textSecondary }}>
            Estado regulatorio y alertas operativas
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16, marginBottom: 24,
        }}>

          {/* ── MVE Countdown ── */}
          <div style={{
            background: mveUrgent ? T.redBg : T.card,
            border: `1px solid ${mveUrgent ? T.redBorder : T.border}`,
            borderRadius: T.radius, padding: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Shield size={20} style={{ color: mveUrgent ? T.red : T.gold }} />
              <span style={{
                fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.06em', color: mveUrgent ? T.red : T.gold,
              }}>
                MVE Formato E2
              </span>
            </div>
            <div style={{
              fontSize: 'var(--aguila-fs-kpi-hero)', fontWeight: 900, lineHeight: 1,
              fontFamily: 'var(--font-mono)',
              color: mveUrgent ? T.red : T.textPrimary,
            }}>
              {mveDays}
            </div>
            <div style={{ fontSize: 'var(--aguila-fs-body)', color: T.textSecondary, marginTop: 8 }}>
              {mveDays === 0
                ? 'Vence hoy — acción inmediata requerida'
                : `día${mveDays !== 1 ? 's' : ''} para vencimiento`}
            </div>
          </div>

          {/* ── Semáforo Rojo ── */}
          <div style={{
            background: semaforoRojo > 0 ? T.redBg : T.card,
            border: `1px solid ${semaforoRojo > 0 ? T.redBorder : T.border}`,
            borderRadius: T.radius, padding: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <AlertTriangle size={20} style={{ color: semaforoRojo > 0 ? T.red : T.gold }} />
              <span style={{
                fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.06em', color: semaforoRojo > 0 ? T.red : T.gold,
              }}>
                Semáforo Rojo
              </span>
            </div>
            <div style={{
              fontSize: 'var(--aguila-fs-kpi-hero)', fontWeight: 900, lineHeight: 1,
              fontFamily: 'var(--font-mono)',
              color: semaforoRojo > 0 ? T.red : T.textMuted,
            }}>
              {semaforoRojo}
            </div>
            <div style={{ fontSize: 'var(--aguila-fs-body)', color: T.textSecondary, marginTop: 8 }}>
              {semaforoRojo === 0
                ? 'Sin inspecciones pendientes'
                : `embarque${semaforoRojo !== 1 ? 's' : ''} en revisión aduanera`}
            </div>
          </div>

          {/* ── Blocking Docs ── */}
          <div style={{
            background: blockingDocs > 0 ? T.amberBg : T.card,
            border: `1px solid ${blockingDocs > 0 ? T.amberBorder : T.border}`,
            borderRadius: T.radius, padding: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <FileText size={20} style={{ color: blockingDocs > 0 ? T.amber : T.gold }} />
              <span style={{
                fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.06em', color: blockingDocs > 0 ? T.amber : T.gold,
              }}>
                Documentos Bloqueantes
              </span>
            </div>
            <div style={{
              fontSize: 'var(--aguila-fs-kpi-hero)', fontWeight: 900, lineHeight: 1,
              fontFamily: 'var(--font-mono)',
              color: blockingDocs > 0 ? T.amber : T.textMuted,
            }}>
              {blockingDocs}
            </div>
            <div style={{ fontSize: 'var(--aguila-fs-body)', color: T.textSecondary, marginTop: 8 }}>
              {blockingDocs === 0
                ? 'Todos los embarques con documentación completa'
                : `embarque${blockingDocs !== 1 ? 's' : ''} sin pedimento asignado`}
            </div>
          </div>

          {/* ── USMCA Expiry ── */}
          <div style={{
            background: usmcaExpiring.length > 0 ? T.amberBg : T.card,
            border: `1px solid ${usmcaExpiring.length > 0 ? T.amberBorder : T.border}`,
            borderRadius: T.radius, padding: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <FileCheck size={20} style={{ color: usmcaExpiring.length > 0 ? T.amber : T.gold }} />
              <span style={{
                fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.06em', color: usmcaExpiring.length > 0 ? T.amber : T.gold,
              }}>
                Certificados USMCA
              </span>
            </div>
            {usmcaExpiring.length === 0 ? (
              <>
                <div style={{
                  fontSize: 'var(--aguila-fs-kpi-hero)', fontWeight: 900, lineHeight: 1,
                  fontFamily: 'var(--font-mono)', color: T.textMuted,
                }}>
                  0
                </div>
                <div style={{ fontSize: 'var(--aguila-fs-body)', color: T.textSecondary, marginTop: 8 }}>
                  Sin vencimientos en los próximos 30 días
                </div>
              </>
            ) : (
              <>
                <div style={{
                  fontSize: 'var(--aguila-fs-kpi-hero)', fontWeight: 900, lineHeight: 1,
                  fontFamily: 'var(--font-mono)', color: T.amber,
                }}>
                  {usmcaExpiring.length}
                </div>
                <div style={{ fontSize: 'var(--aguila-fs-body)', color: T.textSecondary, marginTop: 8 }}>
                  certificado{usmcaExpiring.length !== 1 ? 's' : ''} por vencer en 30 días
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                  {usmcaExpiring.slice(0, 5).map(item => (
                    <div key={item.trafico} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 6,
                    }}>
                      <span style={{
                        fontSize: 'var(--aguila-fs-body)', fontWeight: 700, color: T.gold,
                        fontFamily: 'var(--font-mono)',
                      }}>
                        {item.trafico}
                      </span>
                      <span style={{
                        fontSize: 12, color: T.textSecondary,
                        fontFamily: 'var(--font-mono)',
                      }}>
                        {fmtDate(item.fecha)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   CLIENT VIEW — safe, no internal data exposed
   ══════════════════════════════════════════ */

function ClientCumplimientoView() {
  const isMobile = useIsMobile()
  const [deadlineCount, setDeadlineCount] = useState(0)
  const [pendingDocsCount, setPendingDocsCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const companyId = getCompanyIdCookie()
    fetch(`/api/data?table=traficos&company_id=${companyId}&limit=500&order_by=fecha_llegada&order_dir=desc`)
      .then(r => r.json())
      .then(res => {
        const traficos = res.data || []
        const now = new Date()
        const oneWeekMs = 7 * 86400000

        const activeThisWeek = traficos.filter((t: Record<string, string>) => {
          if (t.estatus === 'Despachado' || t.estatus === 'Cancelado') return false
          if (!t.fecha_llegada) return false
          const diff = new Date(t.fecha_llegada).getTime() - now.getTime()
          return diff >= 0 && diff < oneWeekMs
        })
        setDeadlineCount(activeThisWeek.length)

        const pendingDocs = traficos.filter((t: Record<string, string>) => {
          if (t.estatus === 'Despachado' || t.estatus === 'Cancelado') return false
          return !t.expediente_id || t.estatus === 'En proceso'
        })
        setPendingDocsCount(pendingDocs.length)
      })
      .catch(() => {
        setDeadlineCount(0)
        setPendingDocsCount(0)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: isMobile ? 16 : 32, background: 'var(--bg-main)', minHeight: '100vh' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 'var(--aguila-fs-title)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          Cumplimiento
        </h1>
        <p style={{ fontSize: 'var(--aguila-fs-section)', color: 'var(--text-secondary)' }}>
          Resumen de obligaciones y documentos pendientes
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)' }}>Cargando...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8,
            padding: 24, borderTop: '4px solid var(--gold, #E8EAED)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Calendar size={20} style={{ color: 'var(--gold-dark)' }} />
              <span style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 600, color: 'var(--gold-dark)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Vencimientos esta semana
              </span>
            </div>
            <div className="mono" style={{ fontSize: 40, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
              {deadlineCount}
            </div>
            <p style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-secondary)', marginTop: 8 }}>
              {deadlineCount === 0
                ? 'Sin vencimientos programados esta semana.'
                : `${deadlineCount} vencimiento${deadlineCount > 1 ? 's' : ''} próximo${deadlineCount > 1 ? 's' : ''} esta semana.`}
            </p>
          </div>

          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8,
            padding: 24, borderTop: '4px solid var(--gold, #E8EAED)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <FileText size={20} style={{ color: 'var(--gold-dark)' }} />
              <span style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 600, color: 'var(--gold-dark)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Documentos pendientes
              </span>
            </div>
            <div className="mono" style={{ fontSize: 40, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
              {pendingDocsCount}
            </div>
            <p style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-secondary)', marginTop: 8 }}>
              {pendingDocsCount === 0
                ? 'Todos los documentos al corriente.'
                : `${pendingDocsCount} operación${pendingDocsCount > 1 ? 'es' : ''} con documentación pendiente.`}
            </p>
          </div>

          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8,
            padding: 24, borderTop: '4px solid var(--gold, #E8EAED)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Phone size={20} style={{ color: 'var(--gold-dark)' }} />
              <span style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 600, color: 'var(--gold-dark)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Acción requerida
              </span>
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5 }}>
              Contacte a su agente aduanal
            </p>
            <p style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-secondary)', marginTop: 8 }}>
              Para cualquier duda sobre sus obligaciones de cumplimiento, comuníquese directamente con su agente.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════
   PAGE — role gate
   ══════════════════════════════════════════ */

export default function CumplimientoPage() {
  const role = getCookieValue('user_role')

  if (role === 'broker' || role === 'admin') {
    return <BrokerCumplimientoView />
  }

  return <ClientCumplimientoView />
}
