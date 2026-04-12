import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

async function approveSignup(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  if (!id) return

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: signup } = await sb.from('pending_signups').select('*').eq('id', id).single()
  if (!signup || signup.status !== 'pending') return

  // Create auth user
  const { data: authData, error: authErr } = await sb.auth.admin.createUser({
    email: signup.email, email_confirm: true,
    user_metadata: { full_name: signup.full_name, firm_name: signup.firm_name },
  })
  if (authErr || !authData.user) return

  // Create company
  const { error: coErr } = await sb.from('companies').insert({
    company_id: signup.firm_slug, name: signup.firm_name,
    patente: signup.patente, aduana: signup.aduana, active: true,
  })
  if (coErr) { await sb.auth.admin.deleteUser(authData.user.id); return }

  // Create operator
  const { error: opErr } = await sb.from('operators').insert({
    auth_user_id: authData.user.id, email: signup.email,
    full_name: signup.full_name, role: 'admin',
    company_id: signup.firm_slug, active: true,
  })
  if (opErr) {
    await sb.from('companies').delete().eq('company_id', signup.firm_slug)
    await sb.auth.admin.deleteUser(authData.user.id)
    return
  }

  // Mark approved
  await sb.from('pending_signups').update({
    status: 'approved', reviewed_at: new Date().toISOString(),
  }).eq('id', id)

  revalidatePath('/admin/signups')
}

async function rejectSignup(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  if (!id) return

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  await sb.from('pending_signups').update({
    status: 'rejected', reviewed_at: new Date().toISOString(),
    rejection_reason: 'Rechazado por administrador',
  }).eq('id', id)

  revalidatePath('/admin/signups')
}

export default async function AdminSignupsPage() {
  const cookieStore = await cookies()
  const role = cookieStore.get('user_role')?.value
  if (role !== 'admin') redirect('/login')

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: signups } = await sb.from('pending_signups')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  const pending = (signups || []).filter((s: Record<string, string>) => s.status === 'pending')
  const resolved = (signups || []).filter((s: Record<string, string>) => s.status !== 'pending')

  return (
    <div style={{ padding: '24px 48px', maxWidth: 900 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
        Solicitudes de acceso
      </h1>

      {pending.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
          Sin solicitudes pendientes
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {pending.map((s: Record<string, string>) => (
            <div key={s.id} style={{
              padding: '16px 20px', borderRadius: 12,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{s.firm_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.full_name} · {s.email}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Patente {s.patente} · {s.aduana} · {s.telefono || 'Sin teléfono'}
                </div>
              </div>
              <form action={approveSignup} style={{ display: 'inline' }}>
                <input type="hidden" name="id" value={s.id} />
                <button type="submit" style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  background: 'var(--gold, #E8EAED)', color: 'rgba(255,255,255,0.03)', border: 'none', cursor: 'pointer',
                }}>
                  Aprobar
                </button>
              </form>
              <form action={rejectSignup} style={{ display: 'inline' }}>
                <input type="hidden" name="id" value={s.id} />
                <button type="submit" style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer',
                }}>
                  Rechazar
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Historial</h2>
          {resolved.map((s: Record<string, string>) => (
            <div key={s.id} style={{
              padding: '12px 16px', borderRadius: 10,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12,
              opacity: 0.6,
            }}>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                background: s.status === 'approved' ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)',
                color: s.status === 'approved' ? '#16A34A' : '#DC2626',
              }}>
                {s.status === 'approved' ? 'Aprobado' : 'Rechazado'}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{s.firm_name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.email}</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
