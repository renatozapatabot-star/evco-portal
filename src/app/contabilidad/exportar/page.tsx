import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import {
  BORDER,
  GLASS_BLUR,
  GLASS_SHADOW,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ContabilidadExportarPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)

  if (!session) redirect('/login')
  if (!['contabilidad', 'admin', 'broker'].includes(session.role)) redirect('/inicio')

  return (
    <div style={{ padding: '24px 0', maxWidth: 720, margin: '0 auto', color: TEXT_PRIMARY }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          fontFamily: 'var(--font-geist-sans)',
          fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', margin: 0,
        }}>
          Exportar contabilidad
        </h1>
        <p style={{ fontSize: 14, color: TEXT_SECONDARY, marginTop: 6, marginBottom: 0 }}>
          CSV / Excel para conciliación externa.
        </p>
      </div>

      <div
        style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: `blur(${GLASS_BLUR})`,
          WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
          border: `1px solid ${BORDER}`,
          borderRadius: 20,
          padding: 20,
          boxShadow: GLASS_SHADOW,
        }}
      >
        <div style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: TEXT_MUTED, marginBottom: 8,
        }}>
          Próximamente
        </div>
        <p style={{ fontSize: 14, color: TEXT_SECONDARY, lineHeight: 1.55, margin: 0 }}>
          Exportación masiva en construcción — contacta a Renato IV para generar un CSV manual de facturas,
          cartera o estados de cuenta mientras tanto.
        </p>
      </div>
    </div>
  )
}
