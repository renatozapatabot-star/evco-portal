import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { VizBars } from '@/components/portal/viz/VizBars'

describe('VizBars', () => {
  it('renders one bar per data point', () => {
    const html = renderToStaticMarkup(<VizBars data={[1, 2, 3, 4, 5]} />)
    const barCount = (html.match(/min-height:2px/g) ?? []).length
    expect(barCount).toBe(5)
  })

  it('routes bar color through portal tokens (never hex)', () => {
    const html = renderToStaticMarkup(<VizBars data={[1, 2, 3]} />)
    expect(html).toContain('var(--portal-green-2)')
    expect(html).not.toMatch(/background:\s*#[0-9a-fA-F]/)
  })

  it('applies accent glow shadow to the last bar only', () => {
    const html = renderToStaticMarkup(<VizBars data={[1, 2, 3]} />)
    const glowCount = (html.match(/var\(--portal-green-glow\)/g) ?? []).length
    expect(glowCount).toBe(1)
  })

  it('marks container as aria-hidden (decorative visualization)', () => {
    const html = renderToStaticMarkup(<VizBars data={[1]} />)
    expect(html).toMatch(/aria-hidden="true"/)
  })

  it('honors explicit max prop for scaling', () => {
    const htmlCapped = renderToStaticMarkup(<VizBars data={[5, 10]} max={100} />)
    const htmlAuto = renderToStaticMarkup(<VizBars data={[5, 10]} />)
    // auto-scale: max=10 → last bar 100%. capped: max=100 → last bar 10%.
    expect(htmlAuto).toMatch(/height:100%/)
    expect(htmlCapped).toMatch(/height:10%/)
  })

  it('handles empty data arrays without crashing', () => {
    const html = renderToStaticMarkup(<VizBars data={[]} />)
    expect(html).toBeDefined()
  })
})
