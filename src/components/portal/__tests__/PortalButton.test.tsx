import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PortalButton } from '@/components/portal/PortalButton'

describe('PortalButton', () => {
  it('renders a <button> by default with ghost variant', () => {
    const html = renderToStaticMarkup(<PortalButton>ok</PortalButton>)
    expect(html).toMatch(/<button /)
    expect(html).toMatch(/portal-btn portal-btn--ghost/)
  })

  it('maps variant + size to modifier classes', () => {
    const html = renderToStaticMarkup(
      <PortalButton variant="primary" size="lg">go</PortalButton>,
    )
    expect(html).toMatch(/portal-btn--primary/)
    expect(html).toMatch(/portal-btn--lg/)
  })

  it('renders a <Link> when href is set', () => {
    const html = renderToStaticMarkup(<PortalButton href="/inicio">home</PortalButton>)
    expect(html).toMatch(/<a /)
    expect(html).toMatch(/href="\/inicio"/)
  })

  it('passes through disabled + aria-label on button variant', () => {
    const html = renderToStaticMarkup(
      <PortalButton disabled aria-label="Aprobar">Aprobar</PortalButton>,
    )
    expect(html).toMatch(/disabled=""/)
    expect(html).toMatch(/aria-label="Aprobar"/)
  })
})
