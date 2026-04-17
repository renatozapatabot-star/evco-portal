import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  PortalTheaterAnimation,
  actFromStatus,
} from '@/components/portal/PortalTheaterAnimation'

describe('PortalTheaterAnimation', () => {
  it('renders five stage markers', () => {
    const html = renderToStaticMarkup(<PortalTheaterAnimation act="filing" />)
    expect(html).toMatch(/Presentado/)
    expect(html).toMatch(/Aceptado/)
    expect(html).toMatch(/Semáforo/)
    expect(html).toMatch(/Cruce/)
    expect(html).toMatch(/Archivado/)
  })

  it('accepts custom labels', () => {
    const html = renderToStaticMarkup(
      <PortalTheaterAnimation
        act="exit"
        labels={{ exit: 'Cruzado', archived: 'Cerrado' }}
      />,
    )
    expect(html).toMatch(/Cruzado/)
    expect(html).toMatch(/Cerrado/)
  })
})

describe('actFromStatus', () => {
  it('maps common customs statuses', () => {
    expect(actFromStatus('Presentado')).toBe('filing')
    expect(actFromStatus('Aceptado SAT')).toBe('acceptance')
    expect(actFromStatus('Liberado · Semáforo verde')).toBe('clearance')
    expect(actFromStatus('Cruzado')).toBe('exit')
    expect(actFromStatus('Archivado')).toBe('archived')
  })

  it('falls back to filing for unknown / null', () => {
    expect(actFromStatus(null)).toBe('filing')
    expect(actFromStatus('')).toBe('filing')
    expect(actFromStatus('foo bar')).toBe('filing')
  })
})
