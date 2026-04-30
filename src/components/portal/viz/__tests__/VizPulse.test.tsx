import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { VizPulse } from '@/components/portal/viz/VizPulse'

describe('VizPulse', () => {
  it('renders one row per item', () => {
    const html = renderToStaticMarkup(
      <VizPulse items={[
        { t: 'TRF-001 · Laredo → GDL', v: 'en ruta', live: true },
        { t: 'TRF-002 · Laredo → MTY', v: '12m', live: false },
      ]} />
    )
    // Two row labels + two metric values render
    expect(html).toContain('TRF-001')
    expect(html).toContain('TRF-002')
    expect(html).toContain('en ruta')
    expect(html).toContain('12m')
  })

  it('renders nothing row-wise with an empty items array', () => {
    const html = renderToStaticMarkup(<VizPulse items={[]} />)
    expect(html).not.toContain('en ruta')
  })

  it('applies live styling only to live items (token-routed)', () => {
    const live = renderToStaticMarkup(
      <VizPulse items={[{ t: 'A', v: 'x', live: true }]} />
    )
    const dim = renderToStaticMarkup(
      <VizPulse items={[{ t: 'B', v: 'y', live: false }]} />
    )
    expect(live).toContain('var(--portal-green-2)')
    // Dim row should not paint in active green accent color
    expect(dim).not.toContain('var(--portal-green-2)')
  })
})
