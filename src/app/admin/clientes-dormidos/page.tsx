/**
 * ZAPATA AI · V1.5 F7 — /admin/clientes-dormidos
 *
 * Tito/Renato IV review list of clientes without recent embarque activity.
 * Every row can one-click generate a Spanish follow-up message for review
 * before dispatch. Silver glass, es-MX, role-gated to admin/broker.
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { detectDormantClients } from '@/lib/dormant/detect'
import { AguilaMark } from '@/components/brand/AguilaMark'
import { AguilaWordmark } from '@/components/brand/AguilaWordmark'
import { BG_DEEP, TEXT_MUTED, TEXT_SECONDARY } from '@/lib/design-system'
import { ClientesDormidosClient } from './ClientesDormidosClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ClientesDormidosPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')
  if (!['admin', 'broker'].includes(session.role)) redirect('/')

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const initial = await detectDormantClients(sb, null, 14)

  return (
    <div style={{ background: BG_DEEP, minHeight: '100vh', padding: '32px 24px 48px' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <AguilaMark size={36} tone="silver" />
          <div>
            <AguilaWordmark />
            <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 4 }}>
              Clientes sin movimiento
            </div>
          </div>
        </div>
      </header>
      <p style={{ fontSize: 13, color: TEXT_SECONDARY, margin: '0 0 20px', maxWidth: 640 }}>
        Clientes con historial operativo que no han registrado un nuevo embarque
        en el umbral elegido. Una acción — un mensaje listo para revisión.
      </p>
      <ClientesDormidosClient initial={initial} initialThreshold={14} />
    </div>
  )
}
