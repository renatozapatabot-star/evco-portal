import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PortalGlobe } from '@/components/portal/PortalGlobe'

describe('PortalGlobe', () => {
  it('renders an SVG with outer sphere + latitudes + meridians', () => {
    const html = renderToStaticMarkup(<PortalGlobe size={24} />)
    expect(html).toMatch(/<svg /)
    expect(html).toMatch(/viewBox="-12 -12 24 24"/)
    // 1 outer circle + 5 latitudes + 5 meridians = 11 fill="none" elements, plus halo
    const meridianCount = (html.match(/<ellipse/g) ?? []).length
    expect(meridianCount).toBeGreaterThanOrEqual(10)
  })

  it('accent=true uses emerald stroke + halo', () => {
    const html = renderToStaticMarkup(<PortalGlobe accent />)
    expect(html).toMatch(/--portal-green-2/)
  })

  it('accent=false uses fg-3 stroke, no halo', () => {
    const html = renderToStaticMarkup(<PortalGlobe accent={false} />)
    expect(html).toMatch(/--portal-fg-3/)
    expect(html).not.toMatch(/drop-shadow/)
  })
})
