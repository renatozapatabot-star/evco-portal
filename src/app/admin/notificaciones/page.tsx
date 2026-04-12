import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AguilaMark } from '@/components/brand/AguilaMark'
import { AguilaWordmark } from '@/components/brand/AguilaWordmark'
import { NotificacionesClient } from './_components/NotificacionesClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function NotificacionesPage() {
  const c = await cookies()
  const role = c.get('user_role')?.value ?? ''
  if (!role) redirect('/login')

  return (
    <main
      className="aduana-dark"
      style={{ padding: 24, minHeight: '100vh', color: '#E6EDF3' }}
    >
      <header style={{ marginBottom: 20 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
            opacity: 0.8,
          }}
        >
          <AguilaMark size={18} tone="silver" />
          <AguilaWordmark size={14} tone="silver" />
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Notificaciones Telegram</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#94a3b8' }}>
          Configura qué eventos te llegan y a qué chat.
        </p>
      </header>
      <NotificacionesClient role={role} />
    </main>
  )
}
