'use client'

export interface VizCatalogProps {
  /** Tenant's top fracción by volume. When null/undefined, renders a
   *  generic "Catálogo activo" preview without leaking another tenant's
   *  SKU. Audit 2026-04-28 flagged the EVCO-specific default
   *  (3907.40.04 Policarbonato) as a cross-tenant leak — every tenant
   *  saw the same plastic resin SKU regardless of their own catalog. */
  fraccion?: string | null
  /** Spanish description under the fraccion. Required when fraccion
   *  is set; otherwise ignored. */
  descripcion?: string | null
}

/**
 * Mini-screen for the /inicio Catálogo module card.
 *
 * When the caller supplies a real `fraccion` (the tenant's own top SKU
 * by volume), it renders the SAT fracción + description with a live
 * "EN CATÁLOGO" indicator. When `fraccion` is null/undefined, it
 * renders a generic preview — never another tenant's data, never a
 * fake animated percentage. The progress bar that previously cycled
 * 40-98% by `Math.floor(40 + (phase * 20) % 60)` was a decorative
 * animation and read as fake — replaced with a static "LIVE" pulse
 * that matches /inicio's other "still alive" signals.
 *
 * Ported from screen-dashboard.jsx:234-288.
 */
export function VizCatalog({ fraccion, descripcion }: VizCatalogProps = {}) {
  const hasSku = Boolean(fraccion && fraccion.trim().length > 0)
  const displayFraccion = hasSku ? fraccion : 'Catálogo activo'
  const displayDescripcion = hasSku
    ? (descripcion || 'Clasificación SAT vigente')
    : 'Clasificación IA en tiempo real'

  return (
    <div
      style={{
        height: 88,
        background: 'var(--portal-ink-0)',
        border: '1px solid var(--portal-line-1)',
        borderRadius: 'var(--portal-r-2)',
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontFamily: 'var(--portal-font-mono)',
        fontSize: 9,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          color: 'var(--portal-fg-5)',
          letterSpacing: '0.12em',
        }}
      >
        <span>{hasSku ? 'FRACCIÓN PRINCIPAL' : 'CATÁLOGO'}</span>
        <span style={{ color: 'var(--portal-green-2)' }}>
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: 999,
              background: 'var(--portal-green-2)',
              boxShadow: '0 0 6px var(--portal-green-glow)',
              marginRight: 6,
              animation: 'portalPulse 1.6s ease-in-out infinite',
              verticalAlign: 'middle',
            }}
          />
          EN LÍNEA
        </span>
      </div>
      <div
        style={{
          color: 'var(--portal-fg-1)',
          fontSize: 13,
          letterSpacing: '0.02em',
        }}
      >
        {displayFraccion}
      </div>
      <div
        style={{
          color: 'var(--portal-fg-4)',
          fontSize: 9,
          letterSpacing: '0.08em',
          lineHeight: 1.3,
        }}
      >
        {displayDescripcion}
      </div>
    </div>
  )
}
