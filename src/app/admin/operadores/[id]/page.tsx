/**
 * ZAPATA AI · V1.5 F10 — /admin/operadores/[id]
 *
 * Operator detail — header, last 50 authored actions + per-action-type counts.
 * Admin/broker only.
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_BRIGHT,
  BORDER,
  BORDER_HAIRLINE,
  GLASS_SHADOW,
  SILVER_GRADIENT,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'
import { fmtDateTime } from '@/lib/format-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MONO = 'var(--font-jetbrains-mono)'
const SANS = 'var(--font-geist-sans)'

interface ActionRow {
  id: string
  action_type: string | null
  target_table: string | null
  target_id: string | null
  created_at: string
}

interface OperatorRow {
  id: string
  full_name: string | null
  role: string | null
  email: string | null
  company_id: string | null
  active: boolean | null
}

export default async function OperatorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')
  if (!['admin', 'broker'].includes(session.role)) redirect('/inicio')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const opResp = await supabase
    .from('operators')
    .select('id, full_name, role, email, company_id, active')
    .eq('id', id)
    .eq('company_id', session.companyId)
    .maybeSingle()

  const operator = (opResp.data ?? null) as OperatorRow | null

  if (!operator) {
    return (
      <main className="aduana-dark" style={{ padding: 24, minHeight: '100vh', color: TEXT_PRIMARY }}>
        <p style={{ fontSize: 'var(--aguila-fs-section)' }}>Operador no encontrado.</p>
        <Link href="/admin/operadores" style={{ color: ACCENT_SILVER_BRIGHT }}>
          ← Regresar
        </Link>
      </main>
    )
  }

  const actionsResp = await supabase
    .from('operator_actions')
    .select('id, action_type, target_table, target_id, created_at')
    .eq('operator_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  const actions = (actionsResp.data ?? []) as ActionRow[]

  const countsByType = new Map<string, number>()
  for (const a of actions) {
    const k = a.action_type ?? '—'
    countsByType.set(k, (countsByType.get(k) ?? 0) + 1)
  }
  const countsSorted = Array.from(countsByType.entries()).sort((a, b) => b[1] - a[1])

  return (
    <main
      className="aduana-dark"
      style={{
        padding: 24,
        minHeight: '100vh',
        color: TEXT_PRIMARY,
        maxWidth: 1100,
        margin: '0 auto',
      }}
    >
      <Link
        href="/admin/operadores"
        style={{ fontSize: 'var(--aguila-fs-body)', color: TEXT_SECONDARY, textDecoration: 'none' }}
      >
        ← Equipo
      </Link>

      <header
        style={{
          marginTop: 12,
          background: 'rgba(255,255,255,0.045)',
          backdropFilter: 'blur(20px)',
          border: `1px solid ${BORDER}`,
          borderRadius: 20,
          padding: 20,
          boxShadow: GLASS_SHADOW,
          marginBottom: 16,
        }}
      >
        <h1
          style={{
            fontFamily: SANS,
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            margin: 0,
            background: SILVER_GRADIENT,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {operator.full_name ?? '—'}
        </h1>
        <div style={{ marginTop: 6, display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 'var(--aguila-fs-compact)' }}>
          <span style={{ color: ACCENT_SILVER, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {operator.role ?? 'operator'}
          </span>
          {operator.email && (
            <span style={{ fontFamily: MONO, color: TEXT_SECONDARY }}>{operator.email}</span>
          )}
          <span style={{ color: operator.active ? '#22C55E' : '#EF4444' }}>
            {operator.active ? '● Activo' : '○ Inactivo'}
          </span>
        </div>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 320px) 1fr',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* Per-action-type counts */}
        <aside
          style={{
            background: 'rgba(255,255,255,0.045)',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${BORDER}`,
            borderRadius: 20,
            padding: 20,
            boxShadow: GLASS_SHADOW,
          }}
        >
          <h2 style={{
            fontSize: 'var(--aguila-fs-label)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: TEXT_MUTED,
            margin: 0,
            marginBottom: 12,
          }}>
            Acciones por tipo (últimas 50)
          </h2>
          {countsSorted.length === 0 ? (
            <p style={{ fontSize: 'var(--aguila-fs-body)', color: TEXT_SECONDARY, margin: 0 }}>
              Sin actividad reciente.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {countsSorted.map(([type, count]) => (
                <li
                  key={type}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: `1px solid ${BORDER_HAIRLINE}`,
                    minHeight: 32,
                  }}
                >
                  <span style={{ fontSize: 'var(--aguila-fs-body)', color: TEXT_PRIMARY, fontFamily: SANS }}>
                    {type}
                  </span>
                  <span style={{ fontFamily: MONO, color: ACCENT_SILVER_BRIGHT, fontSize: 'var(--aguila-fs-body)' }}>
                    {count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Recent action feed */}
        <div
          style={{
            background: 'rgba(255,255,255,0.045)',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${BORDER}`,
            borderRadius: 20,
            padding: 20,
            boxShadow: GLASS_SHADOW,
          }}
        >
          <h2 style={{
            fontSize: 'var(--aguila-fs-label)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: TEXT_MUTED,
            margin: 0,
            marginBottom: 12,
          }}>
            Últimas 50 acciones
          </h2>
          {actions.length === 0 ? (
            <p style={{ fontSize: 'var(--aguila-fs-body)', color: TEXT_SECONDARY, margin: 0 }}>
              Este operador no tiene acciones registradas.
            </p>
          ) : (
            <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {actions.map((a) => (
                <li
                  key={a.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: `1px solid ${BORDER_HAIRLINE}`,
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 8,
                    alignItems: 'center',
                    minHeight: 44,
                  }}
                >
                  <div>
                    <div style={{ fontFamily: SANS, fontSize: 'var(--aguila-fs-body)', fontWeight: 600, color: TEXT_PRIMARY }}>
                      {a.action_type ?? '—'}
                    </div>
                    {a.target_table && (
                      <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_SECONDARY, marginTop: 2, fontFamily: MONO }}>
                        {a.target_table}
                        {a.target_id ? ` · ${a.target_id}` : ''}
                      </div>
                    )}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED }}>
                    {fmtDateTime(a.created_at)}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </main>
  )
}
