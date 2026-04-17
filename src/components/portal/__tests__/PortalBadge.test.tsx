import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PortalBadge } from '@/components/portal/PortalBadge'

describe('PortalBadge', () => {
  it('emits portal-badge class with tone modifier', () => {
    const live = renderToStaticMarkup(<PortalBadge tone="live">EN LÍNEA</PortalBadge>)
    expect(live).toMatch(/portal-badge portal-badge--live/)
    const warn = renderToStaticMarkup(<PortalBadge tone="warn">ATENCIÓN</PortalBadge>)
    expect(warn).toMatch(/portal-badge--warn/)
  })

  it('renders a pulse dot when pulse is true', () => {
    const html = renderToStaticMarkup(<PortalBadge pulse>LIVE</PortalBadge>)
    expect(html).toMatch(/class="portal-pulse"/)
  })

  it('no modifier for neutral tone', () => {
    const html = renderToStaticMarkup(<PortalBadge>PLAIN</PortalBadge>)
    expect(html).toMatch(/class="portal-badge"/)
    expect(html).not.toMatch(/portal-badge--/)
  })
})
