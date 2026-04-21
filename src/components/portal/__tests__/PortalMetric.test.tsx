import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PortalMetric } from '@/components/portal/PortalMetric'

describe('PortalMetric', () => {
  it('renders label / value / sub with portal-metric classes', () => {
    const html = renderToStaticMarkup(
      <PortalMetric label="Activos" value={28} sub="+4 vs ayer" />,
    )
    expect(html).toMatch(/class="portal-metric"/)
    expect(html).toMatch(/class="portal-metric__label"/)
    expect(html).toMatch(/portal-metric__value/)
    expect(html).toMatch(/portal-metric__sub/)
    expect(html).toMatch(/Activos/)
    expect(html).toMatch(/>28</)
    expect(html).toMatch(/\+4 vs ayer/)
  })

  it('applies display modifier for serif weight', () => {
    const html = renderToStaticMarkup(<PortalMetric label="L" value="x" display />)
    expect(html).toMatch(/portal-metric__value--display/)
  })

  it('colors value by tone', () => {
    const live  = renderToStaticMarkup(<PortalMetric label="L" value="x" tone="live" />)
    const warn  = renderToStaticMarkup(<PortalMetric label="L" value="x" tone="warn" />)
    const alert = renderToStaticMarkup(<PortalMetric label="L" value="x" tone="alert" />)
    expect(live).toMatch(/--portal-green-1/)
    expect(warn).toMatch(/--portal-amber/)
    expect(alert).toMatch(/--portal-red/)
  })
})
