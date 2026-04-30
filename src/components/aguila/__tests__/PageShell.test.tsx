import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PageShell } from '../PageShell'

describe('PageShell', () => {
  it('renders title as h1 with V1 login-parity weight 600', () => {
    const html = renderToStaticMarkup(
      <PageShell title="Embarques">body</PageShell>
    )
    expect(html).toMatch(/<h1[^>]*>Embarques<\/h1>/)
    expect(html).toMatch(/font-weight:600/)
  })

  it('renders subtitle when provided', () => {
    const html = renderToStaticMarkup(
      <PageShell title="X" subtitle="Estado actual de la operación">
        body
      </PageShell>
    )
    expect(html).toContain('Estado actual de la operación')
  })

  it('respects V1 letter-spacing of -0.01em on the h1', () => {
    const html = renderToStaticMarkup(<PageShell title="X">body</PageShell>)
    // V1 login parity: -0.01em (not the legacy --aguila-ls-tight's -0.03em)
    expect(html).toMatch(/letter-spacing:-0\.01em/)
  })

  it('renders status dot when systemStatus is set', () => {
    const health = renderToStaticMarkup(
      <PageShell title="X" systemStatus="healthy">
        body
      </PageShell>
    )
    const crit = renderToStaticMarkup(
      <PageShell title="X" systemStatus="critical">
        body
      </PageShell>
    )
    // Pulse utility class is attached to the status dot
    expect(health).toMatch(/aguila-dot-pulse/)
    expect(crit).toMatch(/aguila-dot-pulse/)
  })

  it('skips status dot when systemStatus is undefined', () => {
    const html = renderToStaticMarkup(<PageShell title="X">body</PageShell>)
    expect(html).not.toMatch(/aguila-dot-pulse/)
  })

  it('disables pulse when pulseSignal=false', () => {
    const html = renderToStaticMarkup(
      <PageShell title="X" systemStatus="healthy" pulseSignal={false}>
        body
      </PageShell>
    )
    // Dot still renders (systemStatus set), but no pulse class
    expect(html).not.toMatch(/aguila-dot-pulse/)
  })

  it('renders the atmospheric aura element per V1', () => {
    const html = renderToStaticMarkup(<PageShell title="X">body</PageShell>)
    expect(html).toMatch(/class="aguila-aura"/)
    expect(html).toMatch(/aria-hidden="true"/)
  })

  it('composes the canvas class for inherited atmospheric layers', () => {
    const html = renderToStaticMarkup(<PageShell title="X">body</PageShell>)
    expect(html).toContain('aguila-dark')
    expect(html).toContain('aguila-canvas')
  })

  it('renders the brandHeader slot above greeting when provided', () => {
    const html = renderToStaticMarkup(
      <PageShell
        title="X"
        brandHeader={<div data-testid="brand">BRAND</div>}
      >
        body
      </PageShell>
    )
    expect(html).toContain('BRAND')
    // BrandHeader comes before the h1 in DOM order
    expect(html.indexOf('BRAND')).toBeLessThan(html.indexOf('<h1'))
  })

  it('renders children in the content region', () => {
    const html = renderToStaticMarkup(
      <PageShell title="X">
        <div data-testid="content">child content</div>
      </PageShell>
    )
    expect(html).toContain('child content')
  })

  it('honors custom maxWidth prop', () => {
    const html = renderToStaticMarkup(
      <PageShell title="X" maxWidth={900}>
        body
      </PageShell>
    )
    expect(html).toMatch(/max-width:900px/)
  })
})
