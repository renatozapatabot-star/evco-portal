'use client'

/**
 * Next.js global-error.tsx — renders when even route-level error.tsx fails.
 * Must be a full HTML document since it replaces the root layout.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{
        margin: 0,
        background: 'var(--portal-ink-0)',
        color: 'var(--portal-fg-1)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}>
        <div style={{
          maxWidth: 560,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          padding: '32px 28px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          <div style={{ fontSize: 'var(--aguila-fs-title)', fontWeight: 800, letterSpacing: '-0.03em' }}>
            PORTAL no se cargó
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-4)', lineHeight: 1.5 }}>
            Detectamos un problema inesperado. Tu sesión sigue activa.
          </div>
          {error?.message ? (
            <div style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: 'var(--aguila-fs-meta)',
              color: 'var(--portal-fg-5)',
              padding: '8px 10px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.06)',
              wordBreak: 'break-word',
            }}>
              {error.message}
              {error.digest ? <div style={{ opacity: 0.7, marginTop: 4 }}>id: {error.digest}</div> : null}
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => reset()}
              style={{
                minHeight: 44,
                padding: '10px 20px',
                borderRadius: 12,
                background: 'var(--portal-fg-1)',
                color: 'var(--portal-ink-0)',
                fontWeight: 700,
                fontSize: 'var(--aguila-fs-body)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Reintentar
            </button>
            <a
              href="/login"
              style={{
                minHeight: 44,
                padding: '10px 20px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--portal-fg-1)',
                fontWeight: 600,
                fontSize: 'var(--aguila-fs-body)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              Volver al login
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
