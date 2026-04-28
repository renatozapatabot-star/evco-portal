import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { VizStack } from '@/components/portal/viz/VizStack'

describe('VizStack', () => {
  it('renders one layer per band', () => {
    const html = renderToStaticMarkup(
      <VizStack layers={[
        { k: 'ABR', pct: 80, v: 420 },
        { k: 'MAR', pct: 60, v: 310 },
        { k: 'FEB', pct: 40, v: 200 },
      ]} />
    )
    expect(html).toContain('ABR')
    expect(html).toContain('MAR')
    expect(html).toContain('FEB')
    expect(html).toContain('420')
    expect(html).toContain('310')
    expect(html).toContain('200')
  })

  it('applies the warn tone via token, not hex', () => {
    const html = renderToStaticMarkup(
      <VizStack layers={[{ k: 'A', pct: 50, v: 10, warn: true }]} />
    )
    expect(html).toContain('var(--portal-')
    expect(html).not.toMatch(/background:\s*#[0-9a-fA-F]/)
  })

  it('handles empty layers array gracefully', () => {
    const html = renderToStaticMarkup(<VizStack layers={[]} />)
    expect(html).toBeDefined()
  })
})
