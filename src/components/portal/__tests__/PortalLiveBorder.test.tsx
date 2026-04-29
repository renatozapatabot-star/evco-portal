import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PortalLiveBorder } from '@/components/portal/PortalLiveBorder'

describe('PortalLiveBorder', () => {
  it('renders the LA FRONTERA EN VIVO header', () => {
    const html = renderToStaticMarkup(
      <PortalLiveBorder reducedMotion />,
    )
    expect(html).toMatch(/LA FRONTERA EN VIVO/)
  })

  it('renders city labels on both sides of the border', () => {
    const html = renderToStaticMarkup(
      <PortalLiveBorder reducedMotion />,
    )
    expect(html).toMatch(/NUEVO LAREDO/)
    expect(html).toMatch(/LAREDO/)
    expect(html).toMatch(/PUENTE INTERNACIONAL · LAREDO II/)
  })

  it('renders SAT and CBP checkpoints', () => {
    const html = renderToStaticMarkup(
      <PortalLiveBorder reducedMotion />,
    )
    expect(html).toMatch(/SAT/)
    expect(html).toMatch(/CBP/)
  })

  it('renders the four telemetry cells with default values', () => {
    const html = renderToStaticMarkup(
      <PortalLiveBorder reducedMotion />,
    )
    expect(html).toMatch(/ACTIVO/)
    expect(html).toMatch(/PEDIMENTO/)
    expect(html).toMatch(/TEMPERATURA/)
    expect(html).toMatch(/TIEMPO DE CRUCE/)
    expect(html).toMatch(/240-2601-6002104/)
  })

  it('reflects custom props', () => {
    const html = renderToStaticMarkup(
      <PortalLiveBorder
        reducedMotion
        crossingsToday={42}
        averageWait="9m"
        activeTruckLabel="MX-7777"
        pedimento="26 24 3596 6500441"
        temperature="31°C"
      />,
    )
    expect(html).toMatch(/MX-7777/)
    expect(html).toMatch(/26 24 3596 6500441/)
    expect(html).toMatch(/31°C/)
    expect(html).toMatch(/9m/)
    // CRUCES HOY value reflects the prop
    expect(html).toMatch(/>42</)
  })

  it('renders the CTA strip with default pedimento metadata', () => {
    const html = renderToStaticMarkup(
      <PortalLiveBorder reducedMotion />,
    )
    expect(html).toMatch(/VER FLUJO COMPLETO DEL PEDIMENTO/)
    expect(html).toMatch(/REPRODUCIR/)
  })
})
