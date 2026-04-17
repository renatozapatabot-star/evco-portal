import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PortalTopBar } from '@/components/portal/PortalTopBar'

describe('PortalTopBar', () => {
  it('renders PORTAL wordmark + pulse dot', () => {
    const html = renderToStaticMarkup(<PortalTopBar onOpenCmd={vi.fn()} />)
    expect(html).toMatch(/PORTAL/)
    expect(html).toMatch(/portalDotPulse/)
    expect(html).toMatch(/portalPing/)
  })

  it('renders the centered command palette trigger with ⌘K kbd chips', () => {
    const html = renderToStaticMarkup(<PortalTopBar onOpenCmd={vi.fn()} />)
    expect(html).toMatch(/Busca un SKU/)
    expect(html).toMatch(/class="portal-kbd"/)
    expect(html).toMatch(/⌘/)
    expect(html).toMatch(/>K</)
  })

  it('renders EN LÍNEA badge + Salir button when onLogout is passed', () => {
    const html = renderToStaticMarkup(
      <PortalTopBar onOpenCmd={vi.fn()} onLogout={vi.fn()} />,
    )
    expect(html).toMatch(/portal-badge--live/)
    expect(html).toMatch(/EN LÍNEA/)
    expect(html).toMatch(/Salir/)
  })

  it('renders last-cross toast when prop is supplied', () => {
    const html = renderToStaticMarkup(
      <PortalTopBar
        onOpenCmd={vi.fn()}
        lastCross={{ id: 'x1', label: 'TX-4829', ts: '14:22' }}
      />,
    )
    expect(html).toMatch(/TX-4829/)
    expect(html).toMatch(/14:22/)
  })
})
