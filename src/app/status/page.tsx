import { createClient } from '@supabase/supabase-js'

import { GlassCard, PageShell, SectionHeader } from '@/components/aguila'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { fmtDateTime } from '@/lib/format-utils'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export const dynamic = 'force-dynamic'

// Client-friendly label mapping — hide internal service names from a public
// status board. Any upstream name not in this map falls through unchanged.
const FRIENDLY_NAME: Record<string, string> = {
  'Portal PORTAL': 'PORTAL Web',
  'Base de Datos': 'Sincronización de Datos',
  'GlobalPC MySQL': 'Sincronización de Datos',
  'Supabase': 'Sincronización de Datos',
  'ADUANA Intelligence': 'PORTAL',
  'Telegram Bot': 'Notificaciones',
  'Ollama': 'PORTAL',
}

type HealthKind = 'operational' | 'degraded' | 'down' | 'pending'

interface SystemRow {
  name: string
  status: HealthKind
  detail: string
}

function mapStatus(raw: string): HealthKind {
  if (raw === 'healthy' || raw === 'operational') return 'operational'
  if (raw === 'degraded') return 'degraded'
  if (raw === 'down') return 'down'
  return 'pending'
}

// Map health-kind → StatusBadge status so every pill renders through the
// canonical dark-variant palette.
const BADGE_STATUS: Record<HealthKind, Parameters<typeof StatusBadge>[0]['status']> = {
  operational: 'cruzado',
  degraded: 'retrasado',
  down: 'error',
  pending: 'borrador',
}

const BADGE_LABEL: Record<HealthKind, string> = {
  operational: 'Operacional',
  degraded: 'Degradado',
  down: 'Caído',
  pending: 'Pendiente',
}

export default async function StatusPage() {
  const healthRes = await supabase
    .from('integration_health')
    .select('*')
    .order('checked_at', { ascending: false })

  const integrations = healthRes.data || []
  const now = fmtDateTime(new Date())

  const systems: SystemRow[] =
    integrations.length > 0
      ? integrations.map((i) => ({
          name: FRIENDLY_NAME[i.integration_name as string] ?? (i.integration_name as string),
          status: mapStatus(i.status as string),
          detail: (i.status as string) === 'healthy' ? 'Activo' : 'Sin conexión',
        }))
      : [
          { name: 'PORTAL Web', status: 'operational', detail: 'Activo' },
          { name: 'Sincronización de Datos', status: 'operational', detail: 'Activo' },
          { name: 'PORTAL', status: 'operational', detail: 'Activo' },
        ]

  const allOp = systems.every((s) => s.status === 'operational')
  const systemStatus = allOp
    ? 'healthy'
    : systems.some((s) => s.status === 'down')
      ? 'critical'
      : 'warning'

  return (
    <PageShell
      title="Estado del Sistema"
      subtitle="PORTAL Intelligence Platform"
      systemStatus={systemStatus}
      maxWidth={720}
    >
      <div style={{ display: 'grid', gap: 16 }}>
        <GlassCard tier="hero">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--portal-fs-md, 16px)' }}>
                {allOp
                  ? 'Todos los sistemas operacionales'
                  : 'Algunos sistemas requieren atención'}
              </div>
              <div
                style={{
                  color: 'var(--portal-fg-4)',
                  fontSize: 'var(--portal-fs-tiny, 11px)',
                  marginTop: 2,
                }}
              >
                Actualizado:{' '}
                <span
                  style={{
                    fontFamily: 'var(--portal-font-mono, "Geist Mono", monospace)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {now}
                </span>{' '}
                CST
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard tier="secondary">
          <SectionHeader title="Integraciones" count={systems.length} />
          <div style={{ display: 'grid', gap: 0, marginTop: 8 }}>
            {systems.map((sys, i) => (
              <div
                key={sys.name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 0',
                  borderBottom:
                    i < systems.length - 1 ? '1px solid var(--portal-line-1)' : 'none',
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 'var(--portal-fs-sm, 13px)',
                      color: 'var(--portal-fg-2)',
                    }}
                  >
                    {sys.name}
                  </div>
                  <div
                    style={{
                      color: 'var(--portal-fg-4)',
                      fontSize: 'var(--portal-fs-tiny, 11px)',
                      marginTop: 2,
                    }}
                  >
                    {sys.detail}
                  </div>
                </div>
                <StatusBadge
                  status={BADGE_STATUS[sys.status]}
                  label={BADGE_LABEL[sys.status]}
                />
              </div>
            ))}
          </div>
        </GlassCard>

        <div
          style={{
            textAlign: 'center',
            color: 'var(--portal-fg-5)',
            fontSize: 'var(--portal-fs-micro, 10px)',
            letterSpacing: '0.08em',
            marginTop: 12,
          }}
        >
          Auto-refresh cada 60 segundos
        </div>
      </div>
    </PageShell>
  )
}
