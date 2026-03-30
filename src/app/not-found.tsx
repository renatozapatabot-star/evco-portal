import Link from 'next/link'
import { GOLD } from '@/lib/design-system'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', background: '#0D0D0C',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 24,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: 28, fontWeight: 700, fontFamily: 'Georgia, serif', color: '#1A1710',
      }} className="z-mark-coin">Z</div>
      <h1 style={{ color: GOLD, fontFamily: 'var(--font-mono, monospace)', fontSize: 48, fontWeight: 800, margin: 0 }}>
        404
      </h1>
      <p style={{ color: '#888', fontSize: 14, margin: 0 }}>
        Esta página no existe
      </p>
      <Link href="/" style={{
        color: GOLD, fontSize: 13, textDecoration: 'none',
        border: `1px solid ${GOLD}`, padding: '8px 16px', borderRadius: 3,
      }}>
        Volver al dashboard
      </Link>
    </div>
  )
}
