import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PortalGreeting } from '@/components/portal/PortalGreeting'

describe('PortalGreeting', () => {
  it('renders name in emerald span', () => {
    const html = renderToStaticMarkup(
      <PortalGreeting name="Ursula" saludo="Buenos días" fecha="lunes, 20 abril" />,
    )
    expect(html).toMatch(/Buenos días/)
    expect(html).toMatch(/--portal-green-2/)
    expect(html).toMatch(/>Ursula</)
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

  it('uses display font + -0.02em tracking', () => {
    const html = renderToStaticMarkup(
      <PortalGreeting name="A" saludo="Hola" />,
    )
    expect(html).toMatch(/--portal-font-display/)
    expect(html).toMatch(/letter-spacing:-0\.02em/)
  })
})
