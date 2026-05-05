import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PortalLoginSignatureHorizon } from '@/components/portal/login/PortalLoginSignatureHorizon'

describe('PortalLoginSignatureHorizon', () => {
  it('renders three geographic ticks at 33/50/67%', () => {
    const html = renderToStaticMarkup(<PortalLoginSignatureHorizon />)
    const labels = html.match(/RIO BRAVO|PUENTE II/g) ?? []
    // RIO BRAVO appears twice (33% + 67%), PUENTE II once
    expect(labels.length).toBe(3)
    expect(html).toMatch(/PUENTE II/)
    expect(html).toMatch(/left:33%/)
    expect(html).toMatch(/left:50%/)
    expect(html).toMatch(/left:67%/)
  })

  it('sits at top:62% with zIndex 3 and aria-hidden', () => {
    const html = renderToStaticMarkup(<PortalLoginSignatureHorizon />)
    expect(html).toMatch(/top:62%/)
    expect(html).toMatch(/z-index:3/)
    expect(html).toMatch(/aria-hidden/)
    expect(html).toMatch(/pointer-events:none/)
  })
})
