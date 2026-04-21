import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { VizEmpty } from '@/components/portal/viz/VizEmpty'

describe('VizEmpty', () => {
  it('renders default PRÓXIMAMENTE copy when no label passed', () => {
    const html = renderToStaticMarkup(<VizEmpty />)
    expect(html).toContain('PRÓXIMAMENTE')
  })

  it('renders a custom label when provided', () => {
    const html = renderToStaticMarkup(<VizEmpty label="SIN DATOS" />)
    expect(html).toContain('SIN DATOS')
    expect(html).not.toContain('PRÓXIMAMENTE')
  })

  it('routes border + color through portal tokens', () => {
    const html = renderToStaticMarkup(<VizEmpty />)
    expect(html).toContain('var(--portal-line-2)')
    expect(html).toContain('var(--portal-fg-5)')
    expect(html).toContain('var(--portal-font-mono)')
  })

  it('uses dashed border (coming-soon chemistry, not a solid card)', () => {
    const html = renderToStaticMarkup(<VizEmpty />)
    expect(html).toMatch(/1px dashed/)
  })
})
