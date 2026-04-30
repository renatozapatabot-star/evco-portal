import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PortalGreeting } from '@/components/portal/PortalGreeting'

describe('PortalGreeting', () => {
  it('renders name in silver (--portal-fg-1), never in green', () => {
    const html = renderToStaticMarkup(
      <PortalGreeting name="Ursula" saludo="Buenos días" fecha="lunes, 20 abril" />,
    )
    expect(html).toMatch(/Buenos días/)
    expect(html).toMatch(/>Ursula</)
    // V1 contract: identity highlight is silver luminance (fg-1 vs fg-2),
    // never hue. --portal-green-* is reserved for cruzado/healthy status.
    expect(html).toMatch(/--portal-fg-1/)
  })

  it('renders summary copy below the greeting', () => {
    const html = renderToStaticMarkup(
      <PortalGreeting
        name="Renato"
        saludo="Hola"
        summary={<span>2 embarques en tránsito.</span>}
      />,
    )
    expect(html).toMatch(/2 embarques en tránsito\./)
  })

  it('uses display font, --aguila-ls-tight tracking, weight 600', () => {
    const html = renderToStaticMarkup(
      <PortalGreeting name="A" saludo="Hola" />,
    )
    expect(html).toMatch(/--portal-font-display/)
    // V1 contract: tracking uses approved tokens, not hardcoded em values.
    expect(html).toMatch(/--aguila-ls-tight/)
    // V1 contract: heading weight is 600 (not light/300).
    expect(html).toMatch(/font-weight:600/)
  })
})
