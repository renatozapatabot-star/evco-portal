import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PortalCruzMark } from '@/components/portal/PortalCruzMark'

describe('PortalCruzMark', () => {
  it('renders PORTAL letters by default', () => {
    const html = renderToStaticMarkup(<PortalCruzMark />)
    expect(html).toMatch(/P[\s\S]*O[\s\S]*R[\s\S]*T[\s\S]*A[\s\S]*L/)
    // Each letter is a separate span
    const letterSpans = (html.match(/<span /g) ?? []).length
    expect(letterSpans).toBeGreaterThanOrEqual(6)
  })

  it('renders globe alongside when globe=true', () => {
    const html = renderToStaticMarkup(<PortalCruzMark globe />)
    expect(html).toMatch(/<svg /)
  })

  it('skips globe when globe=false', () => {
    const html = renderToStaticMarkup(<PortalCruzMark globe={false} />)
    expect(html).not.toMatch(/<svg /)
  })

  it('applies custom tracking + weight', () => {
    const html = renderToStaticMarkup(<PortalCruzMark tracking="0.45em" weight={300} />)
    expect(html).toMatch(/letter-spacing:0\.45em/)
    expect(html).toMatch(/font-weight:300/)
  })

  it('renders custom text', () => {
    const html = renderToStaticMarkup(<PortalCruzMark text="CRUZ" />)
    expect(html).not.toMatch(/>P</)
    expect(html).toMatch(/>C</)
    expect(html).toMatch(/>R</)
    expect(html).toMatch(/>U</)
    expect(html).toMatch(/>Z</)
  })
})
