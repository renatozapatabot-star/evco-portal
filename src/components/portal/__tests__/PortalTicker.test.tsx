import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PortalTicker } from '@/components/portal/PortalTicker'

describe('PortalTicker', () => {
  it('renders nothing when items is empty', () => {
    const html = renderToStaticMarkup(<PortalTicker items={[]} />)
    expect(html).toBe('')
  })

  it('renders items doubled for seamless scroll', () => {
    const html = renderToStaticMarkup(
      <PortalTicker
        items={[
          { label: 'USD/MXN', value: '17.49' },
          { label: 'Activos', value: '28', tone: 'live' },
        ]}
      />,
    )
    // Two passes — first visible, second aria-hidden
    expect((html.match(/USD\/MXN/g) ?? []).length).toBe(2)
    expect(html).toMatch(/aria-label="Datos en vivo"/)
    expect(html).toMatch(/aria-hidden="true"/)
  })

  it('accepts a custom aria-label', () => {
    const html = renderToStaticMarkup(
      <PortalTicker items={[{ label: 'A', value: '1' }]} ariaLabel="Live rates" />,
    )
    expect(html).toMatch(/aria-label="Live rates"/)
  })

  it('maps tones to portal color tokens', () => {
    const html = renderToStaticMarkup(
      <PortalTicker
        items={[
          { label: 'Live', value: '1', tone: 'live' },
          { label: 'Warn', value: '2', tone: 'warn' },
          { label: 'Alert', value: '3', tone: 'alert' },
        ]}
      />,
    )
    expect(html).toMatch(/--portal-green-2/)
    expect(html).toMatch(/--portal-amber/)
    expect(html).toMatch(/--portal-red/)
  })
})
