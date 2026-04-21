'use client'

import Link from 'next/link'
import { DetailPageShell, GlassCard } from '@/components/aguila'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <DetailPageShell
      breadcrumb={[{ label: 'Pipeline', href: '/admin/leads' }, { label: 'Error' }]}
      title="Lead no disponible"
      subtitle="No se pudo cargar este lead."
      maxWidth={1000}
    >
      <GlassCard
        tier="hero"
        padding={24}
        style={{
          borderColor: 'var(--portal-status-red-ring)',
          background: 'var(--portal-status-red-bg)',
        }}
      >
        <p
          style={{
            fontSize: 'var(--portal-fs-sm)',
            color: 'var(--portal-fg-2)',
            lineHeight: 1.5,
            margin: '0 0 16px',
          }}
        >
          Algo falló al consultar este lead. Puede que el ID no exista
          o que haya un problema temporal de conexión.
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
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={reset}
            className="portal-btn portal-btn--primary"
          >
            Reintentar
          </button>
          <Link
            href="/admin/leads"
            className="portal-btn portal-btn--ghost"
            style={{ textDecoration: 'none' }}
          >
            Volver al pipeline
          </Link>
        </div>
      </GlassCard>
    </DetailPageShell>
  )
}
