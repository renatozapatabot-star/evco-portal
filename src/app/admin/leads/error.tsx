'use client'

import { PageShell, GlassCard } from '@/components/aguila'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageShell
      title="Pipeline de leads"
      subtitle="No pudimos cargar el pipeline ahora mismo."
      maxWidth={1400}
    >
      <GlassCard
        tier="hero"
        padding={24}
        style={{
          borderColor: 'var(--portal-status-red-ring)',
          background: 'var(--portal-status-red-bg)',
        }}
      >
        <div
          className="portal-eyebrow"
          style={{
            fontSize: 'var(--portal-fs-label)',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--portal-status-red-fg)',
            marginBottom: 10,
          }}
        >
          Error al cargar
        </div>
        <p
          style={{
            fontSize: 'var(--portal-fs-sm)',
            color: 'var(--portal-fg-2)',
            lineHeight: 1.5,
            margin: '0 0 16px',
          }}
        >
          Algo falló al consultar la tabla de leads. Intenta de nuevo.
          Si persiste, verifica que la migración se haya aplicado:{' '}
          <code style={{ fontFamily: 'var(--portal-font-mono)' }}>
            npx supabase db push
          </code>
          .
        </p>
        {error?.digest ? (
          <p
            style={{
              fontFamily: 'var(--portal-font-mono)',
              fontSize: 'var(--portal-fs-tiny)',
              color: 'var(--portal-fg-4)',
              margin: '0 0 16px',
            }}
          >
            Error digest · {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="portal-btn portal-btn--primary portal-btn--lg"
        >
          Reintentar
        </button>
      </GlassCard>
    </PageShell>
  )
}
