import { DetailPageShell, GlassCard } from '@/components/aguila'

export default function Loading() {
  return (
    <DetailPageShell
      breadcrumb={[{ label: 'Pipeline', href: '/admin/leads' }, { label: 'Cargando…' }]}
      title="Cargando…"
      maxWidth={1000}
    >
      <div style={{ display: 'grid', gap: 20 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 14,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <GlassCard key={i} tier="hero" padding={20}>
              <div
                style={{
                  height: 10,
                  width: '50%',
                  background: 'var(--portal-ink-2)',
                  borderRadius: 4,
                  marginBottom: 12,
                }}
              />
              <div
                style={{
                  height: 24,
                  width: '70%',
                  background: 'var(--portal-ink-2)',
                  borderRadius: 6,
                }}
              />
            </GlassCard>
          ))}
        </div>
        {[0, 1, 2, 3].map((i) => (
          <GlassCard key={i} tier="hero" padding={20}>
            <div
              style={{
                height: 10,
                width: '20%',
                background: 'var(--portal-ink-2)',
                borderRadius: 4,
                marginBottom: 14,
              }}
            />
            <div
              style={{
                height: 60,
                background: 'var(--portal-ink-2)',
                borderRadius: 8,
                opacity: 0.5,
              }}
            />
          </GlassCard>
        ))}
      </div>
    </DetailPageShell>
  )
}
