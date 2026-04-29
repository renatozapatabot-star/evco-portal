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
  PortalGlobe,
  PortalCruzMark,
  PortalWorldMesh,
  PortalLiveBorder,
  PortalGreeting,
  PortalModuleCard,
  PortalCrucesMap,
  VizPulse,
  VizPedimentoLedger,
  VizDocs,
  VizCatalog,
  VizWarehouseDock,
  VizDonut,
} from '@/components/portal'
import { PortalLoginBackgroundLineMap, PortalLoginLiveWire } from '@/components/portal'
import {
  AguilaMetric,
  AguilaBeforeAfter,
  AguilaTestimonial,
  AguilaCTA,
} from '@/components/aguila'
import { StagePillsDemo } from './StagePillsDemo'

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

      {/* ===== Phase 1–5 + Phases A, B, E primitives ===== */}
      <PortalSection title="Brand primitives" eyebrow="portal-globe · cruzmark · worldmesh">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, alignItems: 'center' }}>
          <PortalCard>
            <PortalEyebrow>Globe</PortalEyebrow>
            <div style={{ marginTop: 12, display: 'flex', gap: 20, alignItems: 'center' }}>
              <PortalGlobe size={56} accent />
              <PortalGlobe size={40} accent={false} />
            </div>
          </PortalCard>
          <PortalCard>
            <PortalEyebrow>Wordmark</PortalEyebrow>
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <PortalCruzMark size={15} tracking="0.45em" weight={300} />
              <PortalCruzMark size={22} tracking="0.24em" weight={400} globe={false} />
            </div>
          </PortalCard>
          <PortalCard>
            <PortalEyebrow>World mesh</PortalEyebrow>
            <p style={{ color: 'var(--portal-fg-4)', fontSize: 'var(--portal-fs-sm)', marginTop: 8 }}>
              Mounted as a fixed background on every dashboard route.
              Open <code>/inicio</code> to see it at 4% opacity behind the
              grain overlay.
            </p>
          </PortalCard>
        </div>
      </PortalSection>

      {/* Greeting */}
      <PortalSection title="Greeting" eyebrow="portal-greeting">
        <PortalCard tier="hero" padding={32}>
          <PortalGreeting
            name="Renato"
            summary={
              <>
                Tu operación está en calma.{' '}
                <span className="portal-num" style={{ color: 'var(--portal-fg-1)' }}>2</span>{' '}
                embarques en tránsito,{' '}
                <span className="portal-num" style={{ color: 'var(--portal-fg-1)' }}>3</span>{' '}
                pedimentos hoy, y todo firmado.
              </>
            }
          />
        </PortalCard>
      </PortalSection>

      {/* Module-card + 6 bespoke vizzes */}
      <PortalSection title="Module cards + bespoke vizzes" eyebrow="portal-module-card · viz/*">
        <PortalModulesGrid>
          <PortalModuleCard
            icon={<span>🚚</span>}
            title="Embarques"
            desc="2 unidades en tránsito ahora mismo. 4 cruces programados esta semana."
            badge={{ tone: 'live', label: '2 EN TRÁNSITO' }}
            viz={<VizPulse items={[
              { t: 'TX-4829 · N. Laredo II', v: 'en ruta', live: true },
              { t: 'TX-4830 · Colombia',     v: '12m',     live: true },
              { t: 'TX-4828 · entregado',    v: 'ayer',    live: false },
            ]} />}
            metric="18"
            metricLabel="ACTIVOS"
            accent
          />
          <PortalModuleCard
            icon={<span>📄</span>}
            title="Pedimentos"
            desc="Declaraciones aduanales. 3 firmados hoy, todo al corriente."
            badge={{ tone: 'info', label: '3 HOY' }}
            viz={<VizPedimentoLedger />}
            metric="10"
            metricLabel="ESTE MES"
            accent
          />
          <PortalModuleCard
            icon={<span>📁</span>}
            title="Expedientes"
            desc="Carpetas de operación digitales. Firmas electrónicas al día."
            viz={<VizDocs />}
            metric="448"
            metricLabel="ESTE MES"
          />
          <PortalModuleCard
            icon={<span>📚</span>}
            title="Catálogo"
            desc="Partes, fracciones arancelarias e historial de clasificación IA."
            badge={{ tone: 'neutral', label: 'PREVIEW' }}
            viz={<VizCatalog />}
            metric="Q2"
            metricLabel="PRÓXIMAMENTE"
          />
          <PortalModuleCard
            icon={<span>📦</span>}
            title="Entradas"
            desc="Recibos en almacén Laredo TX. 26 entradas esta semana."
            viz={<VizWarehouseDock />}
            metric="26"
            metricLabel="ESTA SEMANA"
          />
          <PortalModuleCard
            icon={<span>📋</span>}
            title="Anexo 24"
            desc="Padrón de SKUs con IMMEX vigente. Todos clasificados al día."
            badge={{ tone: 'warn', label: '3 POR REVISAR' }}
            viz={
              <VizDonut greenPct={98.8} redPct={1.2} size={72} label="63% clasificado" />
            }
            metric="245"
            metricLabel="SKUs EN ANEXO"
          />
        </PortalModulesGrid>
      </PortalSection>

      {/* Cruces map */}
      <PortalSection title="Cruces map" eyebrow="portal-cruces-map">
        <PortalCrucesMap />
      </PortalSection>

      {/* Live border — La Frontera en Vivo */}
      <PortalSection
        title="Live border — La Frontera en Vivo"
        eyebrow="portal-live-border · operator + owner only"
      >
        <p className="portal-meta" style={{ marginBottom: 12 }}>
          Ported from <code>live-border.jsx</code> (claude.ai/design
          handoff). Three trucks animate MX→US across Laredo II; lead
          truck fires <code>window.__cruzCrossingBus</code> events on
          midpoint. Defaults are presentational; props accept tenant-
          scoped telemetry. Not rendered on client <code>/inicio</code>
          (calm-tone invariant #24).
        </p>
        <PortalLiveBorder />
      </PortalSection>

      {/* Login living background preview */}
      <PortalSection title="Login atmosphere" eyebrow="living map + LiveWire">
        <PortalCard tier="raised" padding={0} style={{ position: 'relative', height: 360, overflow: 'hidden' }}>
          <PortalLoginBackgroundLineMap />
          <div style={{
            position: 'absolute', inset: 0, zIndex: 2,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: 24, gap: 12,
            background: 'radial-gradient(ellipse at center, transparent 30%, var(--portal-ink-0) 90%)',
          }}>
            <PortalCruzMark size={44} tracking="0.24em" weight={200} globe={false} />
            <p className="portal-meta" style={{ marginTop: 0 }}>preview · z-0 · opacity 0.55</p>
          </div>
        </PortalCard>
        <div style={{ marginTop: 20 }}>
          <PortalLoginLiveWire />
        </div>
      </PortalSection>

      {/* ── Sales assets — reusable for /pitch, /demo, marketing ────────── */}
      <PortalSection
        title="Sales assets"
        eyebrow="for /pitch, /demo, marketing landings"
      >
        <div style={{ display: 'grid', gap: 20 }}>
          {/* Metric row — tone variants */}
          <div>
            <p className="portal-meta" style={{ marginBottom: 8 }}>
              &lt;AguilaMetric&gt; · 4 tone variants (neutral / positive / negative / attention)
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 14,
              }}
            >
              <AguilaMetric
                label="Patente"
                value="3596"
                sub="Aduana 240 · Nuevo Laredo"
              />
              <AguilaMetric
                label="Liberación"
                value="98"
                unit="%"
                tone="positive"
                sub="Semáforo verde · 90 días"
              />
              <AguilaMetric
                label="Atrasados"
                value="3"
                tone="negative"
                sub="requieren acción"
              />
              <AguilaMetric
                label="Pendientes"
                value="12"
                tone="attention"
                sub="revisar hoy"
              />
            </div>
          </div>

          {/* Before/after strip */}
          <div>
            <p className="portal-meta" style={{ marginBottom: 8 }}>
              &lt;AguilaBeforeAfter&gt; · delta strip for landings + decks
            </p>
            <AguilaBeforeAfter
              title="Impacto medible"
              before="22 min"
              beforeLabel="Proceso manual"
              after="2 min"
              afterLabel="Con PORTAL"
            />
          </div>

          {/* Testimonial */}
          <div>
            <p className="portal-meta" style={{ marginBottom: 8 }}>
              &lt;AguilaTestimonial&gt; · quote + attribution + optional avatar
            </p>
            <AguilaTestimonial
              quote="Abro el portal a las 11 PM, veo todo en una pantalla, y me voy a dormir. Esto no existía antes."
              attribution="Ursula Banda"
              role="Dir. de Operaciones · EVCO Plastics"
            />
          </div>

          {/* CTA — paired actions */}
          <div>
            <p className="portal-meta" style={{ marginBottom: 8 }}>
              &lt;AguilaCTA&gt; · paired primary + secondary action stack
              (href / onClick / external / disabled)
            </p>
            <AguilaCTA
              title="Dale un vistazo antes de decidir."
              subtitle="Abre el demo público · sin registro · zero compromiso."
              primary={{ label: 'Ver demo en vivo', href: '/demo/live' }}
              secondary={{
                label: 'Descargar 1-pager (PDF)',
                href: '/api/pitch-pdf?download=1',
              }}
            />
          </div>

          {/* Stage pills — pipeline transitions */}
          <div>
            <p className="portal-meta" style={{ marginBottom: 8 }}>
              &lt;AguilaStagePills&gt; · pill row for discrete stages ·
              role=&quot;radiogroup&quot; + aria-checked · saving indicator
              per pill
            </p>
            <StagePillsDemo />
          </div>
        </div>
      </PortalSection>
    </div>
  )
}
