import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { VizCatalog } from '@/components/portal/viz/VizCatalog'

describe('VizCatalog', () => {
  it('does NOT leak the EVCO-specific default fracción when no props passed', () => {
    const html = renderToStaticMarkup(<VizCatalog />)
    // Cluster B regression: prior default was hardcoded "3907.40.04 Policarbonato"
    // for every tenant. That SKU is EVCO's, not a tenant-neutral preview.
    expect(html).not.toContain('3907.40.04')
    expect(html).not.toContain('Policarbonato')
    // Fallback copy is generic + tenant-safe.
    expect(html).toContain('Catálogo activo')
  })

  it('renders tenant-supplied fraccion + descripcion when provided', () => {
    const html = renderToStaticMarkup(
      <VizCatalog fraccion="8471.30.01" descripcion="Máquinas automáticas para procesamiento de datos" />,
    )
    expect(html).toContain('8471.30.01')
    expect(html).toContain('Máquinas automáticas')
    expect(html).toContain('FRACCIÓN PRINCIPAL')
  })

  it('does NOT render a fake animated percentage progress bar', () => {
    const html = renderToStaticMarkup(<VizCatalog fraccion="3901.20.01" descripcion="HDPE" />)
    // The prior implementation cycled `Math.floor(40 + (phase * 20) % 60)` from
    // 40-98% — purely decorative. No percentage value should appear in the
    // static markup; only the EN LÍNEA pulse should signal liveness.
    expect(html).not.toMatch(/\d{1,2}%/)
    expect(html).toContain('EN LÍNEA')
  })

  it('treats empty-string fraccion as no SKU (renders generic preview)', () => {
    const html = renderToStaticMarkup(<VizCatalog fraccion="" descripcion="" />)
    expect(html).toContain('Catálogo activo')
    expect(html).not.toContain('Policarbonato')
  })
})
