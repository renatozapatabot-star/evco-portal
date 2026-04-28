import Link from 'next/link'
import { GOLD } from '@/lib/design-system'
import { AguilaMark } from '@/components/brand/AguilaMark'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--portal-ink-0)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'stretch', justifyContent: 'space-between',
    }}>
      {/* Centered content fills the available space */}
      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24,
        padding: '48px 24px',
      }}>
        <AguilaMark size={64} />
        <h1 style={{
          color: GOLD,
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: 'var(--aguila-fs-kpi-hero)',
          fontWeight: 800,
          margin: 0,
          fontVariantNumeric: 'tabular-nums',
        }}>
          404
        </h1>
        <p style={{ color: 'var(--portal-fg-4)', fontSize: 'var(--aguila-fs-section)', margin: 0 }}>
          Esta página no existe
        </p>

        {/* "¿Buscabas?" recovery list — Cluster P (2026-04-28) widened
         * from 3 to 9 links to match canonical nav-config.ts. The 404
         * page is role-agnostic; per-role middleware (CLIENT_ROUTES /
         * ADMIN_ONLY_ROUTES) gates each destination, so a client
         * clicking /bodega lands cleanly on the role-redirect, not a
         * second 404. */}
        <nav
          aria-label="Buscabas"
          style={{
            display: 'flex', gap: 18, marginTop: 4,
            fontSize: 'var(--aguila-fs-body, 13px)',
            color: 'var(--portal-fg-3)',
            flexWrap: 'wrap',
            justifyContent: 'center',
            maxWidth: 640,
          }}
        >
          <Link href="/inicio"               style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px solid var(--portal-line-2)' }}>Inicio</Link>
          <Link href="/embarques"            style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px solid var(--portal-line-2)' }}>Embarques</Link>
          <Link href="/pedimentos"           style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px solid var(--portal-line-2)' }}>Pedimentos</Link>
          <Link href="/expedientes"          style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px solid var(--portal-line-2)' }}>Expedientes</Link>
          <Link href="/catalogo"             style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px solid var(--portal-line-2)' }}>Catálogo</Link>
          <Link href="/entradas"             style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px solid var(--portal-line-2)' }}>Entradas</Link>
          <Link href="/anexo-24"             style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px solid var(--portal-line-2)' }}>Anexo 24</Link>
          <Link href="/bodega"               style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px solid var(--portal-line-2)' }}>Bodega</Link>
          <Link href="/clasificar-producto"  style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px solid var(--portal-line-2)' }}>Clasificar producto</Link>
        </nav>

        <Link href="/" style={{
          color: GOLD, fontSize: 'var(--aguila-fs-body)', textDecoration: 'none',
          border: `1px solid ${GOLD}`, padding: '8px 16px', borderRadius: 3,
          marginTop: 4,
        }}>
          Volver al dashboard
        </Link>
      </div>

      {/* Identity footer — Chrome audit caught it missing on 404.
       * In-flow at the bottom (was absolute-positioned and got clipped on
       * some viewports). Same data-identity-footer marker so the dedup
       * logic still sees it. */}
      <p
        data-identity-footer
        style={{
          margin: 0, padding: '24px 16px',
          fontSize: 9, // WHY: identity-footer microtype is 9px portal-wide (matches AguilaFooter); no --aguila-fs-* token for 9
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
