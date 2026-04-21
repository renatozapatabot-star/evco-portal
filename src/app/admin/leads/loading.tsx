import { PageShell, GlassCard } from '@/components/aguila'

export default function Loading() {
  return (
    <PageShell title="Pipeline de leads" subtitle="Cargando…" maxWidth={1400}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 14,
          marginBottom: 24,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <GlassCard key={i} tier="hero" padding={20}>
            <div
              style={{
                height: 10,
                width: '40%',
                background: 'var(--portal-ink-2)',
                borderRadius: 4,
                marginBottom: 14,
              }}
            />
            <div
              style={{
                height: 32,
                width: '60%',
                background: 'var(--portal-ink-2)',
                borderRadius: 6,
              }}
            />
          </GlassCard>
        ))}
      </div>
      <GlassCard tier="hero" padding={20}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            minHeight: 240,
          }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                height: 14,
                background: 'var(--portal-ink-2)',
                borderRadius: 4,
                width: `${85 - i * 5}%`,
                opacity: 0.5,
              }}
            />
          ))}
        </div>
      </GlassCard>
    </PageShell>
  )
}
