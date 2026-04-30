import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AguilaCTA } from '../AguilaCTA'

describe('AguilaCTA', () => {
  it('renders primary action as a Link when href is set', () => {
    const html = renderToStaticMarkup(
      <AguilaCTA primary={{ label: 'Ver demo', href: '/demo/live' }} />
    )
    expect(html).toMatch(/<a [^>]*href="\/demo\/live"/)
    expect(html).toContain('portal-btn--primary')
    expect(html).toContain('Ver demo')
  })

  it('renders secondary action as ghost variant', () => {
    const html = renderToStaticMarkup(
      <AguilaCTA
        primary={{ label: 'Primary', href: '/p' }}
        secondary={{ label: 'Secondary', href: '/s' }}
      />
    )
    expect(html).toContain('portal-btn--primary')
    expect(html).toContain('portal-btn--ghost')
    expect(html).toContain('Primary')
    expect(html).toContain('Secondary')
  })

  it('renders as <button> when onClick is passed', () => {
    const html = renderToStaticMarkup(
      <AguilaCTA primary={{ label: 'Click', onClick: vi.fn() }} />
    )
    expect(html).toMatch(/<button[^>]*type="button"/)
  })

  it('renders disabled placeholder when no href + no onClick', () => {
    const html = renderToStaticMarkup(
      <AguilaCTA primary={{ label: 'Pending' }} />
    )
    expect(html).toMatch(/aria-disabled="true"/)
    expect(html).toMatch(/opacity:0\.5/)
  })

  it('renders external link with noopener + target=_blank', () => {
    const html = renderToStaticMarkup(
      <AguilaCTA
        primary={{ label: 'Docs', href: 'https://example.com', external: true }}
      />
    )
    expect(html).toMatch(/target="_blank"/)
    expect(html).toMatch(/rel="noopener noreferrer"/)
  })

  it('renders title + subtitle above the button row when provided', () => {
    const html = renderToStaticMarkup(
      <AguilaCTA
        primary={{ label: 'x', href: '/x' }}
        title="Empieza hoy"
        subtitle="Sin tarjeta · sin compromiso"
      />
    )
    expect(html).toContain('Empieza hoy')
    expect(html).toContain('Sin tarjeta · sin compromiso')
  })

  it('uses display serif for the title', () => {
    const html = renderToStaticMarkup(
      <AguilaCTA primary={{ label: 'x', href: '/x' }} title="Hola" />
    )
    expect(html).toContain('var(--portal-font-display)')
  })

  it('respects column direction (full-width stack)', () => {
    const html = renderToStaticMarkup(
      <AguilaCTA
        primary={{ label: 'a', href: '/a' }}
        secondary={{ label: 'b', href: '/b' }}
        direction="column"
      />
    )
    expect(html).toMatch(/flex-direction:column/)
    expect(html).toMatch(/width:100%/)
  })

  it('renders only primary when secondary is omitted', () => {
    const html = renderToStaticMarkup(
      <AguilaCTA primary={{ label: 'only', href: '/only' }} />
    )
    const btnCount = (html.match(/portal-btn/g) ?? []).length
    expect(btnCount).toBeGreaterThan(0)
    expect(html).not.toContain('portal-btn--ghost')
  })

  it('does not leak inline hex (token-only)', () => {
    const html = renderToStaticMarkup(
      <AguilaCTA
        primary={{ label: 'x', href: '/x' }}
        secondary={{ label: 'y', href: '/y' }}
        title="t"
        subtitle="s"
      />
    )
    expect(html).not.toMatch(/#[0-9a-fA-F]{6}/)
  })
})
