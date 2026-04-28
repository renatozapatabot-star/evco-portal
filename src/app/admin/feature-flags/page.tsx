/**
 * PORTAL · /admin/feature-flags — admin-only flag console.
 *
 * Reads env truth + admin-session override cookie, composes the
 * effective state table, renders one `<FlagRow>` per flag with a
 * client-island toggle. The toggle posts to /api/admin/feature-flags
 * which writes the override cookie on the admin's browser — production
 * truth (env var on Vercel) is untouched.
 *
 * Access: admin + broker only. Client role redirects to /inicio.
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { PageShell, GlassCard, SectionHeader } from '@/components/aguila'
import {
  FEATURE_FLAGS,
  FEATURE_FLAG_OVERRIDE_COOKIE,
  isInternalRole,
  parseOverrideCookie,
  resolveFlagState,
  type FlagState,
  type FeatureFlagDefinition,
} from '@/lib/admin/feature-flags'
import { FeatureFlagsClient } from './FeatureFlagsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function FeatureFlagsAdminPage() {
  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('portal_session')?.value ?? '')
  if (!session) redirect('/login')
  if (!isInternalRole(session.role)) redirect('/inicio')
  if (session.role !== 'admin' && session.role !== 'broker') redirect('/inicio')

  const overrides = parseOverrideCookie(cookieStore.get(FEATURE_FLAG_OVERRIDE_COOKIE)?.value)

  const rows: Array<{ def: FeatureFlagDefinition; state: FlagState }> = FEATURE_FLAGS.map(def => ({
    def,
    state: resolveFlagState({ def, overrides, role: session.role }),
  }))

  return (
    <PageShell
      title="Feature flags"
      subtitle="Consola de banderas · env + preview admin"
    >
      <GlassCard padding={20}>
        <SectionHeader title="Cómo funcionan" />
        <div
          style={{
            marginTop: 12,
            display: 'grid',
            gap: 8,
            fontSize: 'var(--aguila-fs-body, 13px)',
            color: 'var(--aguila-text-muted)',
            lineHeight: 1.6,
          }}
        >
          <p style={{ margin: 0 }}>
            <strong style={{ color: 'var(--aguila-text-primary)' }}>Env (producción)</strong>
            {' — la verdad. Vive en variables de entorno de Vercel, requiere redeploy para cambiar.'}
          </p>
          <p style={{ margin: 0 }}>
            <strong style={{ color: 'var(--aguila-text-primary)' }}>Preview admin</strong>
            {' — cookie local solo para tu sesión. Sirve para caminar la superficie antes del deploy real. Los clientes nunca la leen.'}
          </p>
          <p style={{ margin: 0 }}>
            <strong style={{ color: 'var(--aguila-text-primary)' }}>Efectivo</strong>
            {' — lo que las rutas evalúan ahora mismo. Env=ON gana siempre; si env=OFF, el preview se aplica solo a roles internos.'}
          </p>
        </div>
      </GlassCard>

      <div style={{ height: 'var(--aguila-gap-section, 32px)' }} />

      <FeatureFlagsClient initialRows={rows} />
    </PageShell>
  )
}
