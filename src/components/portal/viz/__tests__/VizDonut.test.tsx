import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { VizDonut } from '@/components/portal/viz/VizDonut'

describe('VizDonut', () => {
  it('renders an SVG with role="img" for screen-reader access', () => {
    const html = renderToStaticMarkup(<VizDonut />)
    expect(html).toMatch(/<svg[^>]*role="img"/)
  })

  it('uses label as aria-label when provided', () => {
    const html = renderToStaticMarkup(<VizDonut label="63% clasificado" greenPct={63} redPct={0} />)
    expect(html).toMatch(/aria-label="63% clasificado"/)
  })

  it('falls back to a deterministic aria-label built from greenPct', () => {
    const html = renderToStaticMarkup(<VizDonut greenPct={42.5} redPct={1.5} />)
    expect(html).toMatch(/aria-label="42\.5% clasificado"/)
  })

  it('renders the label text beside the donut when label prop is set', () => {
    const html = renderToStaticMarkup(<VizDonut label="98.8% de 245" />)
    expect(html).toContain('98.8% de 245')
    expect(html).toMatch(/class="portal-num"/)
  })

  it('omits the label node when label prop is absent', () => {
    const html = renderToStaticMarkup(<VizDonut />)
    expect(html).not.toMatch(/class="portal-num"/)
  })

  it('renders three circle elements (track + green arc + red arc)', () => {
    const html = renderToStaticMarkup(<VizDonut greenPct={90} redPct={10} />)
    const circleCount = (html.match(/<circle /g) ?? []).length
    expect(circleCount).toBe(3)
  })

  it('routes stroke colors through portal tokens (never inline hex)', () => {
    const html = renderToStaticMarkup(<VizDonut greenPct={90} redPct={10} />)
    expect(html).toContain('var(--portal-line-2)')
    expect(html).toContain('var(--portal-green-2)')
    expect(html).toContain('var(--portal-status-red-fg)')
    expect(html).not.toMatch(/stroke="#[0-9a-fA-F]/)
  })

  it('honors custom size prop in the svg attributes', () => {
    const html = renderToStaticMarkup(<VizDonut size={120} />)
    expect(html).toMatch(/width="120"/)
    expect(html).toMatch(/height="120"/)
    expect(html).toMatch(/viewBox="0 0 120 120"/)
  })
})
