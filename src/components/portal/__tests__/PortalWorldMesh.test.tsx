import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PortalWorldMesh } from '@/components/portal/PortalWorldMesh'

describe('PortalWorldMesh', () => {
  it('renders 12 latitudes + 24 longitudes', () => {
    const html = renderToStaticMarkup(<PortalWorldMesh />)
    const ellipses = (html.match(/<ellipse /g) ?? []).length
    const polylines = (html.match(/<polyline /g) ?? []).length
    expect(ellipses).toBe(12)
    expect(polylines).toBe(24)
  })

  it('applies radial mask + pointer-events:none on wrapper', () => {
    const html = renderToStaticMarkup(<PortalWorldMesh opacity={0.08} />)
    expect(html).toMatch(/radial-gradient/)
    expect(html).toMatch(/pointer-events:none/)
    expect(html).toMatch(/opacity:0\.08/)
  })

  it('uses emerald via the portal-green-2 gradient', () => {
    const html = renderToStaticMarkup(<PortalWorldMesh />)
    expect(html).toMatch(/--portal-green-2/)
  })
})
