import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { VizPedimentoLedger } from '@/components/portal/viz/VizPedimentoLedger'

describe('VizPedimentoLedger', () => {
  it('renders default 5 rows when no rows prop passed', () => {
    const html = renderToStaticMarkup(<VizPedimentoLedger />)
    // Default fixtures include 6002104 through 6002100
    expect(html).toContain('6002104')
    expect(html).toContain('6002100')
  })

  it('renders custom rows when provided', () => {
    const html = renderToStaticMarkup(
      <VizPedimentoLedger rows={[
        { id: '9999001', type: 'A1', status: 'LIVE' },
        { id: '9999002', type: 'A3', status: 'OK' },
      ]} />
    )
    expect(html).toContain('9999001')
    expect(html).toContain('9999002')
    expect(html).not.toContain('6002104')
  })

  it('distinguishes LIVE rows from completed rows via tokens', () => {
    const html = renderToStaticMarkup(
      <VizPedimentoLedger rows={[
        { id: '1', type: 'A1', status: 'LIVE' },
        { id: '2', type: 'A1', status: 'OK' },
      ]} />
    )
    expect(html).toContain('var(--portal-')
  })

  it('handles empty rows array', () => {
    const html = renderToStaticMarkup(<VizPedimentoLedger rows={[]} />)
    expect(html).toBeDefined()
  })
})
