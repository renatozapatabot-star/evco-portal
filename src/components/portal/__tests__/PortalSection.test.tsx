import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PortalSection } from '@/components/portal/PortalSection'

describe('PortalSection', () => {
  it('renders portal-section-title with h2 title', () => {
    const html = renderToStaticMarkup(<PortalSection title="Últimos eventos" />)
    expect(html).toMatch(/class="portal-section-title"/)
    expect(html).toMatch(/<h2>Últimos eventos<\/h2>/)
  })

  it('renders eyebrow on the right', () => {
    const html = renderToStaticMarkup(<PortalSection title="Eventos" eyebrow="12 hoy" />)
    expect(html).toMatch(/class="eyebrow"/)
    expect(html).toMatch(/12 hoy/)
  })

  it('prefers action over eyebrow when both are present', () => {
    const html = renderToStaticMarkup(
      <PortalSection title="Eventos" eyebrow="12 hoy" action={<a href="/x">Ver todo</a>} />,
    )
    expect(html).toMatch(/href="\/x"/)
    expect(html).not.toMatch(/class="eyebrow"/)
  })
})
