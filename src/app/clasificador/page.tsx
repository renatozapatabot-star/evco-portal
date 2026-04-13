import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ScanLine } from 'lucide-react'
import { verifySession } from '@/lib/session'
import {
  COCKPIT_CANVAS, BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ACCENT_SILVER, GOLD,
} from '@/lib/design-system'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ClasificadorPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')

  return (
    <div className="aguila-dark" style={{
      position: 'relative', minHeight: '100vh', background: COCKPIT_CANVAS,
      color: TEXT_PRIMARY, fontFamily: 'var(--font-sans)', padding: '32px 24px',
    }}>
      <div style={{
        maxWidth: 720, margin: '96px auto 0 auto',
        background: BG_CARD,
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        border: `1px solid ${BORDER}`,
        borderRadius: 20, boxShadow: GLASS_SHADOW,
        padding: '40px 36px',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'rgba(192,197,206,0.10)',
          border: '1px solid rgba(192,197,206,0.20)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
        }}>
          <ScanLine size={24} color={ACCENT_SILVER} strokeWidth={1.8} />
        </div>
        <h1 style={{
          fontSize: 'var(--aguila-fs-title, 24px)', fontWeight: 800,
          color: TEXT_PRIMARY, letterSpacing: 'var(--aguila-ls-tight, -0.03em)',
          margin: 0,
        }}>
          Clasificador
        </h1>
        <p style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 8, lineHeight: 1.5 }}>
          Sube · auto-clasifica · valida contra TIGIE.
          La pantalla de subida + OCR + clasificación automática se libera en
          el siguiente build. Mientras tanto, el flujo de clasificación manual
          sigue disponible desde el tráfico.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          <Link href="/clasificar" style={{
            minHeight: 44, padding: '10px 20px', borderRadius: 12,
            background: GOLD, color: '#0D0D0C',
            fontWeight: 700, fontSize: 13, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center',
          }}>
            Clasificar manualmente →
          </Link>
          <Link href="/" style={{
            minHeight: 44, padding: '10px 20px', borderRadius: 12,
            background: 'rgba(255,255,255,0.06)', color: TEXT_PRIMARY,
            fontWeight: 600, fontSize: 13, textDecoration: 'none',
            border: `1px solid ${BORDER}`, display: 'inline-flex', alignItems: 'center',
          }}>
            Volver al cockpit
          </Link>
        </div>
        <div style={{
          marginTop: 32, fontSize: 11, color: TEXT_MUTED,
          fontFamily: 'var(--font-jetbrains-mono), monospace',
        }}>
          {session.role} · {session.companyId}
        </div>
      </div>
    </div>
  )
}
