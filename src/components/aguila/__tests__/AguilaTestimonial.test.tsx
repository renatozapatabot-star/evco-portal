import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AguilaTestimonial } from '../AguilaTestimonial'

describe('AguilaTestimonial', () => {
  it('renders the quote + attribution', () => {
    const html = renderToStaticMarkup(
      <AguilaTestimonial
        quote="Nos ahorra 3 horas al día."
        attribution="Ursula Banda"
        role="Dir. de Operaciones, EVCO Plastics"
      />
    )
    expect(html).toContain('Nos ahorra 3 horas al día.')
    expect(html).toContain('Ursula Banda')
    expect(html).toContain('Dir. de Operaciones, EVCO Plastics')
  })

  it('wraps the quote in a <blockquote> with display serif', () => {
    const html = renderToStaticMarkup(
      <AguilaTestimonial quote="x" attribution="y" />
    )
    expect(html).toMatch(/<blockquote/)
    expect(html).toContain('var(--portal-font-display)')
  })

  it('renders the decorative left quote mark', () => {
    const html = renderToStaticMarkup(
      <AguilaTestimonial quote="x" attribution="y" />
    )
    // HTML-entity encoded "&ldquo;" ("&#x201C;" or literal)
    expect(html).toMatch(/&#x201C;|“|&ldquo;/)
  })

  it('omits role line when not provided', () => {
    const html = renderToStaticMarkup(
      <AguilaTestimonial quote="x" attribution="Ursula" />
    )
    expect(html).not.toMatch(/<figcaption[^>]*>[\s\S]*Dir\./)
  })

  it('renders avatar slot when provided', () => {
    const html = renderToStaticMarkup(
      <AguilaTestimonial
        quote="x"
        attribution="y"
        avatar={<span data-testid="av">UB</span>}
      />
    )
    expect(html).toContain('UB')
  })

  it('does not render avatar circle when avatar prop is absent', () => {
    const html = renderToStaticMarkup(
      <AguilaTestimonial quote="x" attribution="y" />
    )
    expect(html).not.toMatch(/border-radius:50%/)
  })

  it('does not leak inline hex (token-only)', () => {
    const html = renderToStaticMarkup(
      <AguilaTestimonial quote="x" attribution="y" role="z" />
    )
    expect(html).not.toMatch(/#[0-9a-fA-F]{6}/)
  })
})
