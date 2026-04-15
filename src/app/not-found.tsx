import Link from 'next/link'
import { GOLD } from '@/lib/design-system'
import { AguilaMark } from '@/components/brand/AguilaMark'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', background: '#05070B',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 24,
    }}>
      <AguilaMark size={64} />
      <h1 style={{ color: GOLD, fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--aguila-fs-kpi-hero)', fontWeight: 800, margin: 0 }}>
        404
      </h1>
      <p style={{ color: '#888', fontSize: 'var(--aguila-fs-section)', margin: 0 }}>
        Esta página no existe
      </p>
      <Link href="/" style={{
        color: GOLD, fontSize: 'var(--aguila-fs-body)', textDecoration: 'none',
        border: `1px solid ${GOLD}`, padding: '8px 16px', borderRadius: 3,
      }}>
        Volver al dashboard
      </Link>
    </div>
  )
}
