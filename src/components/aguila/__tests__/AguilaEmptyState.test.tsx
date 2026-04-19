import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { AguilaEmptyState } from '../AguilaEmptyState'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

describe('AguilaEmptyState', () => {
  it('renders title + message', () => {
    const html = renderToStaticMarkup(
      <AguilaEmptyState title="Sin documentos" message="Adjunta factura o packing list." />,
    )
    expect(html).toMatch(/Sin documentos/)
    expect(html).toMatch(/Adjunta factura/)
  })

  it('renders icon when provided', () => {
    const html = renderToStaticMarkup(
      <AguilaEmptyState icon="📁" title="X" />,
    )
    expect(html).toMatch(/📁/)
  })

  it('renders primary action as <a> when href provided', () => {
    const html = renderToStaticMarkup(
      <AguilaEmptyState
        title="X"
        action={{ label: 'Subir documento', href: '/docs/upload' }}
      />,
    )
    expect(html).toMatch(/href="\/docs\/upload"/)
    expect(html).toMatch(/Subir documento/)
  })

  it('renders primary action as <button> when onClick provided', () => {
    const html = renderToStaticMarkup(
      <AguilaEmptyState
        title="X"
        action={{ label: 'Abrir modal', onClick: () => {} }}
      />,
    )
    expect(html).toMatch(/<button/)
    expect(html).toMatch(/Abrir modal/)
  })

  it('renders both primary and secondary actions', () => {
    const html = renderToStaticMarkup(
      <AguilaEmptyState
        title="X"
        action={{ label: 'Subir', href: '/subir' }}
        secondaryAction={{ label: 'Ver ayuda', href: '/ayuda' }}
      />,
    )
    expect(html).toMatch(/Subir/)
    expect(html).toMatch(/Ver ayuda/)
  })

  it('renders with no actions (informational state)', () => {
    const html = renderToStaticMarkup(
      <AguilaEmptyState title="Todo al corriente" />,
    )
    expect(html).toMatch(/Todo al corriente/)
    expect(html).not.toMatch(/<a /)
    expect(html).not.toMatch(/<button/)
  })

  it('omits GlassCard wrapper when bare=true', () => {
    const html = renderToStaticMarkup(
      <AguilaEmptyState bare title="X" />,
    )
    // portal-card class would be present if GlassCard wrapped; bare should skip
    expect(html).not.toMatch(/portal-card/)
  })

  it('wraps in GlassCard by default', () => {
    const html = renderToStaticMarkup(
      <AguilaEmptyState title="X" />,
    )
    expect(html).toMatch(/portal-card/)
  })

  it('applies urgent tone styling', () => {
    const html = renderToStaticMarkup(
      <AguilaEmptyState
        tone="urgent"
        title="Falta algo"
        action={{ label: 'Ahora', href: '/' }}
      />,
    )
    expect(html).toMatch(/portal-status-amber-fg/)
  })
})
