import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  PortalLoginCardChrome,
  PortalLoginHandshakeRow,
} from '@/components/portal/login/PortalLoginCardChrome'

describe('PortalLoginCardChrome', () => {
  it('wraps children in a relative container', () => {
    const html = renderToStaticMarkup(
      <PortalLoginCardChrome>
        <div data-testid="form">x</div>
      </PortalLoginCardChrome>,
    )
    expect(html).toMatch(/position:relative/)
    expect(html).toMatch(/data-testid="form"/)
  })

  it('renders four corner ticks with staggered delays', () => {
    const html = renderToStaticMarkup(
      <PortalLoginCardChrome>
        <div />
      </PortalLoginCardChrome>,
    )
    // Each tick gets portalCornerTickIn animation
    const matches = html.match(/portalCornerTickIn/g) ?? []
    expect(matches.length).toBe(4)
    // Delays are 0/200/400/600 ms
    expect(html).toMatch(/0ms both/)
    expect(html).toMatch(/200ms both/)
    expect(html).toMatch(/400ms both/)
    expect(html).toMatch(/600ms both/)
  })

  it('uses portal tokens for tick color', () => {
    const html = renderToStaticMarkup(
      <PortalLoginCardChrome>
        <div />
      </PortalLoginCardChrome>,
    )
    expect(html).toMatch(/var\(--portal-green-3\)/)
  })
})

describe('PortalLoginHandshakeRow', () => {
  it('renders VUCEM, SAT, CBP tokens', () => {
    const html = renderToStaticMarkup(<PortalLoginHandshakeRow />)
    expect(html).toMatch(/VUCEM · OK/)
    expect(html).toMatch(/SAT · OK/)
    expect(html).toMatch(/CBP · OK/)
  })

  it('staggers each token entrance by 220ms', () => {
    const html = renderToStaticMarkup(<PortalLoginHandshakeRow />)
    expect(html).toMatch(/700ms both/)
    expect(html).toMatch(/920ms both/)
    expect(html).toMatch(/1140ms both/)
  })

  it('settles to dim color via portalHandshakeSettle keyframe', () => {
    const html = renderToStaticMarkup(<PortalLoginHandshakeRow />)
    expect(html).toMatch(/portalHandshakeSettle/)
  })

  it('uses status role with Spanish aria-label', () => {
    const html = renderToStaticMarkup(<PortalLoginHandshakeRow />)
    expect(html).toMatch(/role="status"/)
    expect(html).toMatch(/Sistemas en línea/)
  })
})
