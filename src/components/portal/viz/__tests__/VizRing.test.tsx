import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { VizRing } from '@/components/portal/viz/VizRing'

describe('VizRing', () => {
  it('renders an SVG with semantic pct in the output', () => {
    const html = renderToStaticMarkup(<VizRing pct={98} />)
    expect(html).toMatch(/<svg/)
  })

  it('honors custom size prop', () => {
    const html = renderToStaticMarkup(<VizRing pct={50} size={88} />)
    expect(html).toMatch(/width="88"/)
    expect(html).toMatch(/height="88"/)
  })

  it('routes stroke colors through portal tokens (never hex)', () => {
    const html = renderToStaticMarkup(<VizRing pct={75} />)
    expect(html).toContain('var(--portal-')
    expect(html).not.toMatch(/stroke="#[0-9a-fA-F]/)
  })

  it('does not crash at 0% or 100%', () => {
    const zero = renderToStaticMarkup(<VizRing pct={0} />)
    const full = renderToStaticMarkup(<VizRing pct={100} />)
    expect(zero).toMatch(/<svg/)
    expect(full).toMatch(/<svg/)
  })
})
