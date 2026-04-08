import { CruzMark } from '@/components/command-center/CruzMark'
import Link from 'next/link'

export default function SignupPendingPage() {
  return (
    <div style={{
      minHeight: '100vh', background: '#0D0D0C',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 480, background: '#1A1A1A',
        borderRadius: 20, padding: 40, border: '1px solid rgba(255,255,255,0.06)',
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, justifyContent: 'center' }}>
          <CruzMark size={40} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.08em' }}>
            CRUZ
          </span>
        </div>

        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(22,163,74,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>
          ✓
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#FFFFFF', marginBottom: 12 }}>
          Solicitud recibida
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 24 }}>
          Gracias. Tu solicitud fue recibida. Renato Zapata & Company revisará tu información en las próximas horas y te contactará por email.
        </p>

        <div style={{
          padding: '16px 20px', borderRadius: 12,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
          fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6,
        }}>
          Mientras tanto, puedes preparar tu información de GlobalPC y acceso al portal de ANAM — los necesitarás durante la configuración.
        </div>

        <Link href="/login" style={{
          display: 'inline-block', marginTop: 24, fontSize: 13,
          color: 'var(--gold, #C9A84C)', textDecoration: 'none',
        }}>
          ← Volver al inicio
        </Link>
      </div>
    </div>
  )
}
