import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { logOperatorAction, getOperatorContext } from '@/lib/operator-actions'
import { fmtDateTime } from '@/lib/format-utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ── Server Actions ──

async function asignarTrafico(formData: FormData) {
  'use server'
  const traficoId = formData.get('traficoId') as string
  const operatorId = formData.get('operatorId') as string
  if (!traficoId || !operatorId) return

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  await sb.from('traficos').update({ assigned_to_operator_id: operatorId }).eq('id', traficoId)

  logOperatorAction({
    operatorId,
    actionType: 'assign_trafico',
    targetTable: 'traficos',
    targetId: traficoId,
  })

  const { revalidatePath } = await import('next/cache')
  revalidatePath('/operador')
}

async function liberarTrafico(formData: FormData) {
  'use server'
  const traficoId = formData.get('traficoId') as string
  const operatorId = formData.get('operatorId') as string
  if (!traficoId) return

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  await sb.from('traficos').update({ assigned_to_operator_id: null }).eq('id', traficoId)

  logOperatorAction({
    operatorId,
    actionType: 'release_trafico',
    targetTable: 'traficos',
    targetId: traficoId,
  })

  const { revalidatePath } = await import('next/cache')
  revalidatePath('/operador')
}

// ── Helpers ──

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diffMs / 3600000)
  if (hours < 1) return 'hace menos de 1h'
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `hace ${days}d`
}

const SEMAFORO_COLORS: Record<string, string> = {
  verde: '#16A34A', green: '#16A34A',
  amarillo: '#D97706', yellow: '#D97706',
  rojo: '#DC2626', red: '#DC2626',
}

// ── Page Component ──

export default async function OperadorPage() {
  const cookieStore = await cookies()
  const role = cookieStore.get('user_role')?.value
  const opId = cookieStore.get('operator_id')?.value

  // Gate: operator or admin only
  if (!role || (role !== 'admin' && role !== 'broker')) {
    redirect('/')
  }

  // Log page view
  if (opId) {
    logOperatorAction({ operatorId: opId, actionType: 'view_page', targetId: '/operador' })
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Operator identity
  let operatorName = 'Operador'
  let operatorCompany: string | null = null
  if (opId) {
    const { data: op } = await sb.from('operators').select('full_name, company_id, role').eq('id', opId).maybeSingle()
    if (op) {
      operatorName = op.full_name
      operatorCompany = op.role === 'admin' ? null : op.company_id
    }
  }

  // Fetch 4 columns in parallel
  const entradasQ = sb.from('entradas').select('id, cve_entrada, descripcion_mercancia, cve_proveedor, fecha_llegada_mercancia, company_id, trafico, cantidad_bultos', { count: 'exact' })
    .is('trafico', null)
    .order('fecha_llegada_mercancia', { ascending: false }).limit(20)
  if (operatorCompany) entradasQ.eq('company_id', operatorCompany)

  const enProcesoQ = sb.from('traficos').select('id, trafico, company_id, descripcion_mercancia, importe_total, semaforo, fecha_llegada, predicted_fraccion, prediction_confidence, assigned_to_operator_id, estatus')
    .eq('estatus', 'En Proceso').order('fecha_llegada', { ascending: false })
  if (operatorCompany) enProcesoQ.eq('company_id', operatorCompany)

  const pagadoQ = sb.from('traficos').select('id, trafico, company_id, descripcion_mercancia, importe_total, fecha_pago', { count: 'exact' })
    .eq('estatus', 'Pedimento Pagado').order('fecha_pago', { ascending: false }).limit(30)
  if (operatorCompany) pagadoQ.eq('company_id', operatorCompany)

  const cruzadoCountQ = sb.from('traficos').select('id', { count: 'exact', head: true })
    .ilike('estatus', '%cruz%')
  if (operatorCompany) cruzadoCountQ.eq('company_id', operatorCompany)

  const [entradasRes, enProcesoRes, pagadoRes, cruzadoRes] = await Promise.all([entradasQ, enProcesoQ, pagadoQ, cruzadoCountQ])

  const entradas = entradasRes.data || []
  const entradasTotal = entradasRes.count || 0
  const enProceso = enProcesoRes.data || []
  const pagados = pagadoRes.data || []
  const pagadosTotal = pagadoRes.count || 0
  const cruzadosTotal = cruzadoRes.count || 0

  // Split En Proceso by assignment
  const misTraficos = enProceso.filter((t: Record<string, string | number | boolean | null>) => t.assigned_to_operator_id === opId)
  const sinAsignar = enProceso.filter((t: Record<string, string | number | boolean | null>) => !t.assigned_to_operator_id)
  const otrosAsignados = enProceso.filter((t: Record<string, string | number | boolean | null>) => t.assigned_to_operator_id && t.assigned_to_operator_id !== opId)

  // Status strip numbers
  const assignedCount = misTraficos.length
  const unassignedCount = sinAsignar.length

  // ── Styles ──
  const colStyle: React.CSSProperties = {
    background: 'var(--bg-card, #1A1A1A)',
    borderRadius: 12,
    border: '1px solid var(--border, rgba(255,255,255,0.06))',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }
  const colHeaderStyle: React.CSSProperties = {
    padding: '14px 16px',
    borderBottom: '1px solid var(--border, rgba(255,255,255,0.06))',
    position: 'sticky' as const,
    top: 0,
    background: 'var(--bg-card, #1A1A1A)',
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }
  const cardStyle: React.CSSProperties = {
    padding: '12px 14px',
    borderRadius: 8,
    background: 'var(--bg-elevated, #222222)',
    border: '1px solid rgba(255,255,255,0.06)',
    marginBottom: 8,
  }
  const btnGold: React.CSSProperties = {
    padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 700,
    background: 'var(--gold, #C9A84C)', color: '#1A1A1A', border: 'none', cursor: 'pointer',
  }
  const btnOutline: React.CSSProperties = {
    padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 700,
    background: 'transparent', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
  }

  return (
    <div style={{ padding: '16px 24px 60px', minHeight: 'calc(100vh - 60px)' }}>
      {/* Status strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        padding: '12px 16px', borderRadius: 10,
        background: 'var(--bg-card, #1A1A1A)', border: '1px solid var(--border)',
        marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)',
      }}>
        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
          {operatorName}
        </span>
        <span>⚡ {assignedCount} asignados a mí</span>
        <span>📥 {unassignedCount} sin asignar</span>
        <span>💰 {pagadosTotal.toLocaleString()} pagados</span>
        <span>✅ {cruzadosTotal.toLocaleString()} cruzados</span>
      </div>

      {/* Kanban grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(260px, 1fr) minmax(300px, 1.3fr) minmax(260px, 1fr) minmax(180px, 0.5fr)',
        gap: 12,
        alignItems: 'start',
      }}>
        {/* ── Column 1: ENTRADAS ── */}
        <div style={colStyle}>
          <div style={colHeaderStyle}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              📥 Entradas
            </span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {entradasTotal.toLocaleString()}
            </span>
          </div>
          <div style={{ padding: '8px 12px', overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
            {entradas.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                Sin entradas pendientes
              </div>
            )}
            {entradas.map((e: Record<string, string | number | boolean | null>) => (
              <div key={String(e.id)} style={cardStyle}>
                <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {String(e.cve_entrada)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {String(e.descripcion_mercancia || 'Sin descripción').substring(0, 50)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  {e.cantidad_bultos ? `${e.cantidad_bultos} bultos` : ''} · {String(e.company_id)}
                </div>
              </div>
            ))}
            {entradasTotal > 20 && (
              <Link href="/entradas" style={{ display: 'block', textAlign: 'center', padding: 8, fontSize: 11, fontWeight: 600, color: 'var(--gold)', textDecoration: 'none' }}>
                Ver todas ({entradasTotal.toLocaleString()}) →
              </Link>
            )}
          </div>
        </div>

        {/* ── Column 2: EN PROCESO (the main one) ── */}
        <div style={colStyle}>
          <div style={colHeaderStyle}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              ⚡ En Proceso
            </span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {enProceso.length}
            </span>
          </div>
          <div style={{ padding: '8px 12px', overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
            {/* Sub-section: Asignados a mí */}
            {misTraficos.length > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--gold)', marginBottom: 6, marginTop: 4 }}>
                  Asignados a mí ({misTraficos.length})
                </div>
                {misTraficos.map((t: Record<string, string | number | boolean | null>) => (
                  <div key={String(t.id)} style={{ ...cardStyle, borderLeft: '3px solid var(--gold)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                        {String(t.trafico)}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{String(t.company_id)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {String(t.descripcion_mercancia || '').substring(0, 40)}
                    </div>
                    {t.importe_total && (
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginTop: 2 }}>
                        ${Number(t.importe_total).toLocaleString()} USD
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      {t.semaforo && (
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: SEMAFORO_COLORS[String(t.semaforo).toLowerCase()] || '#888' }} />
                      )}
                      {t.fecha_llegada && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{relativeTime(String(t.fecha_llegada))}</span>
                      )}
                      {t.predicted_fraccion && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          🤖 {String(t.predicted_fraccion)} ({Math.round(Number(t.prediction_confidence || 0) * 100)}%)
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <form action={liberarTrafico}>
                        <input type="hidden" name="traficoId" value={String(t.id)} />
                        <input type="hidden" name="operatorId" value={opId || ''} />
                        <button type="submit" style={btnOutline}>Liberar</button>
                      </form>
                      <Link href={`/traficos/${t.id}`} style={{ ...btnGold, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                        Ver →
                      </Link>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Sub-section: Sin asignar */}
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 6, marginTop: misTraficos.length > 0 ? 16 : 4 }}>
              Sin asignar ({sinAsignar.length})
            </div>
            {sinAsignar.length === 0 && (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                Todo asignado · sin trabajo nuevo
              </div>
            )}
            {sinAsignar.map((t: Record<string, string | number | boolean | null>) => (
              <div key={String(t.id)} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {String(t.trafico)}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{String(t.company_id)}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {String(t.descripcion_mercancia || '').substring(0, 40)}
                </div>
                {t.importe_total && (
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginTop: 2 }}>
                    ${Number(t.importe_total).toLocaleString()} USD
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  {t.semaforo && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: SEMAFORO_COLORS[String(t.semaforo).toLowerCase()] || '#888' }} />
                  )}
                  {t.fecha_llegada && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{relativeTime(String(t.fecha_llegada))}</span>
                  )}
                  {t.predicted_fraccion && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      🤖 {String(t.predicted_fraccion)} ({Math.round(Number(t.prediction_confidence || 0) * 100)}%)
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <form action={asignarTrafico}>
                    <input type="hidden" name="traficoId" value={String(t.id)} />
                    <input type="hidden" name="operatorId" value={opId || ''} />
                    <button type="submit" style={btnGold}>Asignar a mí</button>
                  </form>
                  <Link href={`/traficos/${t.id}`} style={{ ...btnOutline, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                    Ver →
                  </Link>
                </div>
              </div>
            ))}

            {/* Others assigned */}
            {otrosAsignados.length > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 6, marginTop: 16 }}>
                  Asignados a otros ({otrosAsignados.length})
                </div>
                {otrosAsignados.map((t: Record<string, string | number | boolean | null>) => (
                  <div key={String(t.id)} style={{ ...cardStyle, opacity: 0.6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      {String(t.trafico)}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8 }}>Asignado</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ── Column 3: PEDIMENTO PAGADO ── */}
        <div style={colStyle}>
          <div style={colHeaderStyle}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              💰 Pagado
            </span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {pagadosTotal.toLocaleString()}
            </span>
          </div>
          <div style={{ padding: '8px 12px', overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
            {pagados.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                Sin pedimentos pagados recientes
              </div>
            )}
            {pagados.map((t: Record<string, string | number | boolean | null>) => (
              <div key={String(t.id)} style={cardStyle}>
                <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {String(t.trafico)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {String(t.descripcion_mercancia || '').substring(0, 40)}
                </div>
                {t.fecha_pago && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    Pagado: {fmtDateTime(String(t.fecha_pago))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Column 4: CRUZADO (collapsed) ── */}
        <div style={colStyle}>
          <div style={colHeaderStyle}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              ✅ Cruzado
            </span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {cruzadosTotal.toLocaleString()}
            </span>
          </div>
          <div style={{ padding: 16, textAlign: 'center' }}>
            <Link href="/traficos?estatus=Cruzado" style={{
              fontSize: 11, fontWeight: 600, color: 'var(--gold)',
              textDecoration: 'none',
            }}>
              Mostrar últimos 20 cruzados →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
