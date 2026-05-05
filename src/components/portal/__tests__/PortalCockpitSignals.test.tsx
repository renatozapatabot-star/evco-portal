import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  PortalCockpitActivity,
  PortalCockpitMomento,
  type PortalSignalItem,
} from '@/components/portal/PortalCockpitSignals'

const NOW = new Date()
const ONE_MIN_AGO = new Date(NOW.getTime() - 60_000).toISOString()
const TEN_MIN_AGO = new Date(NOW.getTime() - 600_000).toISOString()
const TWO_HR_AGO = new Date(NOW.getTime() - 7_200_000).toISOString()

const ITEMS: PortalSignalItem[] = [
  { id: 1, what: 'Embarque creado', ts: ONE_MIN_AGO },
  { id: 2, what: 'Pedimento actualizado', ts: TEN_MIN_AGO },
  { id: 3, what: 'Documento cargado', ts: TWO_HR_AGO },
]

describe('PortalCockpitMomento', () => {
  it('renders the latest event in a portal-momento bar', () => {
    const html = renderToStaticMarkup(<PortalCockpitMomento items={ITEMS} />)
    expect(html).toMatch(/portal-momento/)
    expect(html).toMatch(/En este momento/)
    expect(html).toMatch(/Embarque creado/)
  })

  it('returns null on empty items', () => {
    expect(renderToStaticMarkup(<PortalCockpitMomento items={[]} />)).toBe('')
  })

  it('returns null with no items prop', () => {
    expect(renderToStaticMarkup(<PortalCockpitMomento />)).toBe('')
  })

  it('shows relative timestamp', () => {
    const html = renderToStaticMarkup(<PortalCockpitMomento items={ITEMS} />)
    expect(html).toMatch(/HACE \d+ MIN|AHORA/)
  })
})

describe('PortalCockpitActivity', () => {
  it('renders portal-activity ticker with up to limit items', () => {
    const html = renderToStaticMarkup(<PortalCockpitActivity items={ITEMS} limit={2} />)
    expect(html).toMatch(/portal-activity/)
    expect(html).toMatch(/Embarque creado/)
    expect(html).toMatch(/Pedimento actualizado/)
    expect(html).not.toMatch(/Documento cargado/)
  })

  it('marks the freshest item with --fresh modifier', () => {
    const html = renderToStaticMarkup(<PortalCockpitActivity items={ITEMS} />)
    expect(html).toMatch(/portal-activity__item--fresh/)
  })

  it('returns null on empty items', () => {
    expect(renderToStaticMarkup(<PortalCockpitActivity items={[]} />)).toBe('')
  })

  it('staggers entrance via animationDelay', () => {
    const html = renderToStaticMarkup(<PortalCockpitActivity items={ITEMS} />)
    expect(html).toMatch(/animation-delay:80ms/)
    expect(html).toMatch(/animation-delay:160ms/)
  })
})
