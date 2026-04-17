import {
  PortalCard,
  PortalButton,
  PortalMetric,
  PortalBadge,
  PortalSection,
  PortalModulesGrid,
  PortalSparkline,
  PortalInput,
  PortalLabel,
  PortalEyebrow,
  PortalMeta,
  PortalKbd,
  PortalDivider,
  PortalReveal,
  PortalTabs,
  PortalStickyTopbar,
  PortalTable,
  PortalTheaterAnimation,
} from '@/components/portal'

/**
 * Living design-system gallery for every PORTAL primitive. Admin-only.
 * Use this page to audit a primitive in isolation before touching
 * production surfaces, and as the reference Tito / Renato IV eyeball
 * before any migration block.
 *
 * Every primitive below composes `.portal-*` classes from
 * portal-components.css. Changes to the stylesheet ripple here first.
 */
export default function DesignGalleryPage() {
  const sampleSeries = [3, 7, 6, 9, 8, 11, 10, 13, 12, 14, 16, 15, 18, 17]

  return (
    <div
      className="aguila-dark"
      style={{ minHeight: '100vh', padding: 'var(--portal-s-7)', maxWidth: 1280, margin: '0 auto' }}
    >
      <header style={{ marginBottom: 'var(--portal-s-7)' }}>
        <PortalEyebrow>Design · block dd</PortalEyebrow>
        <h1
          style={{
            fontFamily: 'var(--portal-font-serif)',
            fontWeight: 400,
            fontSize: 'var(--portal-fs-3xl)',
            letterSpacing: '-0.02em',
            color: 'var(--portal-fg-1)',
            margin: '8px 0',
          }}
        >
          PORTAL Design Gallery
        </h1>
        <p style={{ color: 'var(--portal-fg-3)', fontSize: 'var(--portal-fs-sm)' }}>
          Every primitive in one place. If a surface drifts from what you see here,
          the surface is wrong — not the gallery.
        </p>
      </header>

      {/* Cards */}
      <PortalSection title="Cards" eyebrow="portal-card">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 32 }}>
          <PortalCard>
            <PortalEyebrow>Default</PortalEyebrow>
            <p style={{ color: 'var(--portal-fg-2)', fontSize: 'var(--portal-fs-sm)', margin: '8px 0 0' }}>
              Neutral ink-1 surface with hairline border. Use for section cards.
            </p>
          </PortalCard>
          <PortalCard tier="raised">
            <PortalEyebrow>Raised</PortalEyebrow>
            <p style={{ color: 'var(--portal-fg-2)', fontSize: 'var(--portal-fs-sm)', margin: '8px 0 0' }}>
              ink-2 background + shadow-2. Use for dense table containers.
            </p>
          </PortalCard>
          <PortalCard tier="hero">
            <PortalEyebrow>Hero</PortalEyebrow>
            <p style={{ color: 'var(--portal-fg-2)', fontSize: 'var(--portal-fs-sm)', margin: '8px 0 0' }}>
              Emerald radial halo at 30% 0%. Use for KPI tiles.
            </p>
          </PortalCard>
          <PortalCard tier="interactive" href="#">
            <PortalEyebrow>Interactive</PortalEyebrow>
            <p style={{ color: 'var(--portal-fg-2)', fontSize: 'var(--portal-fs-sm)', margin: '8px 0 0' }}>
              Cursor pointer + hover lift. Auto-applies when href is set.
            </p>
          </PortalCard>
          <PortalCard tier="hero" active>
            <PortalEyebrow>Active rail</PortalEyebrow>
            <p style={{ color: 'var(--portal-fg-2)', fontSize: 'var(--portal-fs-sm)', margin: '8px 0 0' }}>
              2px emerald rail on left edge when `active` is true.
            </p>
          </PortalCard>
        </div>
      </PortalSection>

      {/* Metrics + sparklines */}
      <PortalSection title="Metrics" eyebrow="portal-metric · portal-spark">
        <PortalModulesGrid>
          <PortalCard tier="hero">
            <PortalMetric label="ACTIVOS" value="28" sub="+4 vs ayer" display />
            <div style={{ marginTop: 16 }}>
              <PortalSparkline data={sampleSeries} tone="live" height={28} />
            </div>
          </PortalCard>
          <PortalCard tier="hero">
            <PortalMetric label="CRUCES HOY" value="214" sub="+11%" display tone="live" />
            <div style={{ marginTop: 16 }}>
              <PortalSparkline data={sampleSeries} tone="live" height={28} />
            </div>
          </PortalCard>
          <PortalCard tier="hero">
            <PortalMetric label="PEDIMENTOS ABR" value="1,248" sub="nuevos: 36" display />
            <div style={{ marginTop: 16 }}>
              <PortalSparkline data={sampleSeries} height={28} />
            </div>
          </PortalCard>
          <PortalCard tier="hero">
            <PortalMetric label="LIBERACIÓN INMEDIATA" value="98%" sub="últimos 90d" display tone="live" />
            <div style={{ marginTop: 16 }}>
              <PortalSparkline data={sampleSeries} tone="live" height={28} />
            </div>
          </PortalCard>
        </PortalModulesGrid>
      </PortalSection>

      {/* Buttons */}
      <PortalSection title="Buttons" eyebrow="portal-btn">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <PortalButton variant="primary">Aprobar pedimento</PortalButton>
          <PortalButton variant="ghost">Cancelar</PortalButton>
          <PortalButton variant="accent">Cruzar ahora</PortalButton>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <PortalButton variant="primary" size="sm">sm</PortalButton>
          <PortalButton variant="primary" size="md">md</PortalButton>
          <PortalButton variant="primary" size="lg">lg</PortalButton>
        </div>
      </PortalSection>

      {/* Badges */}
      <PortalSection title="Badges" eyebrow="portal-badge">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <PortalBadge>Neutral</PortalBadge>
          <PortalBadge tone="live" pulse>En línea</PortalBadge>
          <PortalBadge tone="info">En proceso</PortalBadge>
          <PortalBadge tone="warn">Atención</PortalBadge>
          <PortalBadge tone="alert">Error</PortalBadge>
        </div>
      </PortalSection>

      {/* Inputs */}
      <PortalSection title="Inputs" eyebrow="portal-input · portal-label">
        <div style={{ maxWidth: 420 }}>
          <PortalLabel htmlFor="demo-input">Código de acceso</PortalLabel>
          <PortalInput id="demo-input" placeholder="· · · · · ·" />
        </div>
      </PortalSection>

      {/* Typography helpers */}
      <PortalSection title="Typography helpers" eyebrow="portal-eyebrow · portal-meta · portal-kbd">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><PortalEyebrow>PATENTE 3596 · ADUANA 240 · LAREDO TX</PortalEyebrow></div>
          <div><PortalMeta>Sincronizado hace 8 min</PortalMeta></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            Buscar: <PortalKbd>⌘</PortalKbd><PortalKbd>K</PortalKbd>
          </div>
        </div>
      </PortalSection>

      {/* Divider + Reveal */}
      <PortalSection title="Dividers + reveal" eyebrow="portal-divider · portal-reveal">
        <PortalDivider />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 20 }}>
          <PortalReveal delay={1}><PortalCard><p>Revealed 60 ms</p></PortalCard></PortalReveal>
          <PortalReveal delay={2}><PortalCard><p>Revealed 120 ms</p></PortalCard></PortalReveal>
          <PortalReveal delay={3}><PortalCard><p>Revealed 180 ms</p></PortalCard></PortalReveal>
        </div>
      </PortalSection>

      {/* Tabs */}
      <PortalSection title="Tabs" eyebrow="portal-tabs">
        <PortalTabs
          tabs={[
            { id: 'resumen', label: 'Resumen', content: <PortalCard><p>Resumen</p></PortalCard> },
            { id: 'partidas', label: 'Partidas', count: 12, content: <PortalCard><p>Partidas (12)</p></PortalCard> },
            { id: 'docs', label: 'Documentos', count: 5, content: <PortalCard><p>Documentos (5)</p></PortalCard> },
          ]}
        />
      </PortalSection>

      {/* Sticky topbar */}
      <PortalSection title="Sticky topbar" eyebrow="portal-sticky-topbar">
        <div style={{ border: '1px solid var(--portal-line-1)', borderRadius: 16, overflow: 'hidden' }}>
          <PortalStickyTopbar
            left={<><PortalButton variant="ghost" size="sm">← Embarques</PortalButton><PortalMeta>Pedimento · 26 24 3596 6500441</PortalMeta></>}
            right={<><PortalButton variant="ghost" size="sm">Imprimir</PortalButton><PortalButton variant="accent" size="sm">Aprobar</PortalButton></>}
          />
          <div style={{ padding: 24 }}>
            <p style={{ color: 'var(--portal-fg-3)', margin: 0 }}>Content below topbar…</p>
          </div>
        </div>
      </PortalSection>

      {/* Theater */}
      <PortalSection title="Theater animation" eyebrow="5-act pedimento workflow">
        <PortalCard tier="raised">
          <PortalTheaterAnimation
            act="clearance"
            timestamps={{
              filing: 'Lun 08:12',
              acceptance: 'Lun 08:24',
              clearance: 'hoy · 14:02',
            }}
          />
        </PortalCard>
      </PortalSection>

      {/* Table */}
      <PortalSection title="Table" eyebrow="portal-table">
        <PortalCard tier="raised" padding={0}>
          <PortalTable
            columns={[
              { key: 'pedimento', label: 'Pedimento' },
              { key: 'proveedor', label: 'Proveedor' },
              { key: 'importe',  label: 'Importe', num: true },
              { key: 'status',   label: 'Estado' },
            ]}
            rows={[
              { id: '1', pedimento: '26 24 3596 6500441', proveedor: 'Duratech', importe: '$15,420', status: 'Cruzado' },
              { id: '2', pedimento: '26 24 3596 6500442', proveedor: 'Milacron',  importe: '$8,920',  status: 'En proceso' },
              { id: '3', pedimento: '26 24 3596 6500443', proveedor: 'Foam Supplies', importe: '$22,105', status: 'Pendiente' },
            ]}
          />
        </PortalCard>
      </PortalSection>
    </div>
  )
}
