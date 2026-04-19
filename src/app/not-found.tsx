import Link from 'next/link'
import { GOLD } from '@/lib/design-system'
import { AguilaMark } from '@/components/brand/AguilaMark'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--portal-ink-0)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 24,
      position: 'relative',
    }}>
      <AguilaMark size={64} />
      <h1 style={{ color: GOLD, fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--aguila-fs-kpi-hero)', fontWeight: 800, margin: 0 }}>
        404
      </h1>
      <p style={{ color: 'var(--portal-fg-4)', fontSize: 'var(--aguila-fs-section)', margin: 0 }}>
        Esta página no existe
      </p>

      {/* Three-link "¿Buscabas?" recovery list — Chrome audit ADD.
       * Recovers the broken click without forcing a dashboard round-trip. */}
      <nav
        aria-label="Buscabas"
        style={{
          display: 'flex', gap: 18, marginTop: 4,
          fontSize: 'var(--aguila-fs-body, 13px)',
          color: 'var(--portal-fg-3)',
        }}
      >
        <Link href="/inicio" style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px solid var(--portal-line-2)' }}>Inicio</Link>
        <Link href="/embarques" style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px solid var(--portal-line-2)' }}>Embarques</Link>
        <Link href="/anexo-24" style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px solid var(--portal-line-2)' }}>Anexo 24</Link>
      </nav>

      <Link href="/" style={{
        color: GOLD, fontSize: 'var(--aguila-fs-body)', textDecoration: 'none',
        border: `1px solid ${GOLD}`, padding: '8px 16px', borderRadius: 3,
      }}>
        Volver al dashboard
      </Link>

      {/* Identity footer — Chrome audit FAIL #3: footer was missing on 404.
       * Now matches every other page. Patente 3596 is on every surface. */}
      <p
        data-identity-footer
        style={{
          position: 'absolute', bottom: 24, left: 0, right: 0,
          margin: 0, fontSize: 9,
          color: 'var(--portal-fg-5)',
          letterSpacing: '0.12em',
          fontFamily: 'var(--portal-font-mono), monospace',
          opacity: 0.85,
          textAlign: 'center',
        }}
      >
        Patente 3596 · Aduana 240 · Laredo TX · Est. 1941
      </p>
    </div>
  )
}
