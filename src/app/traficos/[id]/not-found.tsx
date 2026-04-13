import Link from 'next/link'
import { ArrowLeft, Search } from 'lucide-react'

export default function TraficoNotFound() {
  return (
    <div className="aduana-dark" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', gap: 24 }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 1px rgba(0,229,255,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Search size={28} strokeWidth={1.5} style={{ color: '#94a3b8' }} />
      </div>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 style={{ color: '#E6EDF3', fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
          Tráfico no encontrado
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 14, margin: 0, maxWidth: 420 }}>
          La clave solicitada no existe o no está disponible para tu cuenta.
        </p>
      </div>
      <Link href="/traficos" style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        color: '#E6EDF3',
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(0,229,255,0.3)',
        padding: '10px 18px', borderRadius: 10,
        fontSize: 13, fontWeight: 600,
        textDecoration: 'none',
        minHeight: 44,
      }}>
        <ArrowLeft size={16} strokeWidth={2} />
        Volver a Tráficos
      </Link>
    </div>
  )
}
