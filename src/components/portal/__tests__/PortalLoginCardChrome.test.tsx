import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  PortalLoginCardChrome,
  PortalLoginHandshakeRow,
} from '@/components/portal/login/PortalLoginCardChrome'

describe('PortalLoginCardChrome', () => {
  it('wraps children in a relative glass card', () => {
    const html = renderToStaticMarkup(
      <PortalLoginCardChrome>
        <div data-testid="form">x</div>
      </PortalLoginCardChrome>,
    )
    expect(html).toMatch(/position:relative/)
    expect(html).toMatch(/data-testid="form"/)
    // Glass chemistry — login-parity card chrome
    expect(html).toMatch(/backdrop-filter:blur\(20px\)/)
    expect(html).toMatch(/var\(--portal-r-5\)/)
    expect(html).toMatch(/var\(--portal-line-2\)/)
  })

  it('renders four corner ticks with staggered delays', () => {
    const html = renderToStaticMarkup(
      <PortalLoginCardChrome>
        <div />
      </PortalLoginCardChrome>,
    )
    const matches = html.match(/portalCornerTickIn/g) ?? []
    expect(matches.length).toBe(4)
    expect(html).toMatch(/0ms both/)
    expect(html).toMatch(/90ms both/)
    expect(html).toMatch(/180ms both/)
    expect(html).toMatch(/270ms both/)
  })

  it('uses emerald token + green glow for tick color', () => {
    const html = renderToStaticMarkup(
      <PortalLoginCardChrome>
        <div />
      </PortalLoginCardChrome>,
    )
    expect(html).toMatch(/var\(--portal-green-3\)/)
    expect(html).toMatch(/var\(--portal-green-glow\)/)
  })

  it('breathes by default and intensifies on focus', () => {
    const idle = renderToStaticMarkup(
      <PortalLoginCardChrome>
        <div />
      </PortalLoginCardChrome>,
    )
    expect(idle).toMatch(/portalCardBreathe/)

    const focused = renderToStaticMarkup(
      <PortalLoginCardChrome focused>
        <div />
      </PortalLoginCardChrome>,
    )
    expect(focused).toMatch(/portalCardFocus/)

    const shaking = renderToStaticMarkup(
      <PortalLoginCardChrome shake>
        <div />
      </PortalLoginCardChrome>,
    )
    expect(shaking).toMatch(/portalShake/)
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
