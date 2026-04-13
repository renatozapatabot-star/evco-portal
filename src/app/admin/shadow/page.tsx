import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import { computeAgreementStats } from '@/lib/shadow-analysis'
import {
  ACCENT_CYAN, BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW,
  TEXT_MUTED, TEXT_PRIMARY,
} from '@/lib/design-system'
import { HeroStrip, type HeroTile } from '@/app/traficos/[id]/legacy/_components/HeroStrip'
import { AgreementChart } from './_components/AgreementChart'
import { PageOpenTracker } from './_components/PageOpenTracker'

export const dynamic = 'force-dynamic'

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

function getWeekAgoISO(): string {
  return new Date(Date.now() - 7 * 86_400_000).toISOString()
}

function GlassShell({ title, children }: { title: string; children: React.ReactNode }) {
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
          fontSize: 11, fontWeight: 700, color: TEXT_MUTED,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

export default async function AdminShadowPage() {
  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('portal_session')?.value ?? '')
  if (!session) redirect('/login')
  if (session.role !== 'broker' && session.role !== 'admin') {
    redirect('/')
  }

  const supabase = createServerClient()
  const [stats7, stats30] = await Promise.all([
    computeAgreementStats(7, supabase),
    computeAgreementStats(30, supabase),
  ])

  const heroTiles: HeroTile[] = [
    { label: 'Decisiones comparadas', value: String(stats7.totalCompared), mono: true, hint: 'últimos 7 días' },
    { label: 'Tasa de acuerdo', value: stats7.totalCompared > 0 ? pct(stats7.agreementRate) : '—', mono: true },
    { label: 'Operadores acertaron', value: String(stats7.humanWinsWhenDisagree), mono: true, hint: 'cuando discreparon' },
    { label: 'AGUILA acertó', value: String(stats7.systemWinsWhenDisagree), mono: true, hint: 'cuando discrepó' },
  ]

  // Top disagreements this week — re-scan the same window with full detail.
  // Kept simple: pick rows without was_optimal resolution as a proxy for
  // "unresolved" until the `actor` column lands.
  const sinceWeek = getWeekAgoISO()
  const { data: weekRows } = await supabase
    .from('operational_decisions')
    .select('trafico, decision_type, decision, reasoning, created_at')
    .gte('created_at', sinceWeek)
    .order('created_at', { ascending: false })
    .limit(2000)

  interface WeekRow {
    trafico: string | null
    decision_type: string
    decision: string
    reasoning: string | null
    created_at: string
  }

  const topDisagreements: Array<{ trafico: string; decision_type: string; human: string; system: string; created_at: string }> = []
  if (Array.isArray(weekRows)) {
    const groups = new Map<string, WeekRow[]>()
    for (const r of weekRows as WeekRow[]) {
      if (!r.trafico) continue
      const key = `${r.trafico}::${r.decision_type}`
      const arr = groups.get(key) ?? []
      arr.push(r)
      groups.set(key, arr)
    }
    for (const [, pair] of groups) {
      if (pair.length < 2) continue
      const human = pair.find((x) => (x.reasoning ?? '').trim().length >= 40)
      const system = pair.find((x) => (x.reasoning ?? '').trim().length < 40)
      if (!human || !system) continue
      if (human.decision.trim().toLowerCase() === system.decision.trim().toLowerCase()) continue
      topDisagreements.push({
        trafico: human.trafico ?? '—',
        decision_type: human.decision_type,
        human: human.decision,
        system: system.decision,
        created_at: human.created_at,
      })
      if (topDisagreements.length >= 10) break
    }
  }

  return (
    <div style={{ padding: '8px 0', maxWidth: 1400, margin: '0 auto' }}>
      <PageOpenTracker />

      <Link
        href="/admin"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: TEXT_MUTED, textDecoration: 'none',
          marginBottom: 16, minHeight: 60, lineHeight: '60px',
        }}
      >
        <ArrowLeft size={14} /> Admin
      </Link>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          fontSize: 28, fontWeight: 800, color: TEXT_PRIMARY,
          margin: 0, letterSpacing: '-0.02em',
        }}>
          Inteligencia del Sistema
        </h1>
        <p style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 6 }}>
          Estado de AGUILA vs Operadores · ventana de 7 días para titulares, 30 días para la serie
        </p>
      </div>

      {stats7.insufficient ? (
        <div style={{
          background: BG_CARD,
          backdropFilter: `blur(${GLASS_BLUR})`,
          WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
          border: `1px solid ${BORDER}`,
          borderRadius: 20,
          padding: '32px 24px',
          boxShadow: GLASS_SHADOW,
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: ACCENT_CYAN,
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
          }}>
            Recolectando datos
          </div>
          <div style={{ fontSize: 18, color: TEXT_PRIMARY, fontWeight: 600, marginBottom: 8 }}>
            Necesitamos 100+ comparaciones para empezar a publicar métricas
          </div>
          <div style={{ fontSize: 13, color: TEXT_MUTED, fontFamily: 'var(--font-mono)' }}>
            Actual: {stats7.progress}/100
          </div>
        </div>
      ) : (
        <HeroStrip tiles={heroTiles} />
      )}

      <div
        className="shadow-main-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: 16,
          marginTop: 16,
          alignItems: 'start',
        }}
      >
        <GlassShell title="Concordancia diaria · últimos 30 días">
          <AgreementChart rows={stats30.byDay} />
        </GlassShell>

        <GlassShell title="Tasa de acuerdo por tipo">
          {Object.keys(stats30.byAction).length === 0 ? (
            <div style={{ fontSize: 12, color: TEXT_MUTED }}>
              Sin comparaciones registradas en este período.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: TEXT_MUTED, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  <th style={{ padding: '6px 4px' }}>Tipo</th>
                  <th style={{ padding: '6px 4px', textAlign: 'right' }}>Tasa</th>
                  <th style={{ padding: '6px 4px', textAlign: 'right' }}>n</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats30.byAction)
                  .sort((a, b) => b[1].n - a[1].n)
                  .slice(0, 12)
                  .map(([action, s]) => (
                    <tr key={action}>
                      <td style={{ padding: '6px 4px', color: TEXT_PRIMARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{action}</td>
                      <td style={{ padding: '6px 4px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: TEXT_PRIMARY }}>{pct(s.rate)}</td>
                      <td style={{ padding: '6px 4px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: TEXT_MUTED }}>{s.n}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </GlassShell>
      </div>

      <div style={{ marginTop: 16 }}>
        <GlassShell title="Principales discrepancias esta semana">
          {topDisagreements.length === 0 ? (
            <div style={{ fontSize: 12, color: TEXT_MUTED }}>
              Sin discrepancias registradas esta semana.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topDisagreements.map((d, i) => (
                <Link
                  key={`${d.trafico}-${i}`}
                  href={`/traficos/${encodeURIComponent(d.trafico)}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '140px 1fr 1fr 120px',
                    gap: 12,
                    padding: '10px 12px',
                    border: `1px solid ${BORDER}`,
                    borderRadius: 12,
                    textDecoration: 'none',
                    minHeight: 60,
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: ACCENT_CYAN }}>
                    {d.trafico}
                  </span>
                  <span style={{ fontSize: 12, color: TEXT_PRIMARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ color: TEXT_MUTED, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 6 }}>Operador:</span>
                    {d.human}
                  </span>
                  <span style={{ fontSize: 12, color: TEXT_PRIMARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ color: TEXT_MUTED, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 6 }}>Portal:</span>
                    {d.system}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: TEXT_MUTED, textAlign: 'right' }}>
                    {d.decision_type}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </GlassShell>
      </div>

      <div style={{
        textAlign: 'center', padding: '20px 0',
        fontSize: 11, color: TEXT_MUTED,
      }}>
        Renato Zapata &amp; Company · Patente 3596 · Aduana 240
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .shadow-main-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
