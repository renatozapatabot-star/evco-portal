import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { AguilaBreadcrumb } from '../AguilaBreadcrumb'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

describe('AguilaBreadcrumb', () => {
  it('renders nothing for empty items', () => {
    const html = renderToStaticMarkup(<AguilaBreadcrumb items={[]} />)
    expect(html).toBe('')
  })

  it('renders a single-item trail without a separator', () => {
    const html = renderToStaticMarkup(
      <AguilaBreadcrumb items={[{ label: 'Embarques' }]} />,
    )
    expect(html).toMatch(/Embarques/)
    expect(html).not.toMatch(/›/)
  })

  it('renders › separator between multi-item trails', () => {
    const html = renderToStaticMarkup(
      <AguilaBreadcrumb
        items={[
          { label: 'Embarques', href: '/embarques' },
          { label: '26 24 3596 6500441' },
        ]}
      />,
    )
    expect(html).toMatch(/Embarques/)
    expect(html).toMatch(/›/)
    expect(html).toMatch(/26 24 3596 6500441/)
  })

  it('wraps non-last items with href in an anchor', () => {
    const html = renderToStaticMarkup(
      <AguilaBreadcrumb
        items={[
          { label: 'Pedimentos', href: '/pedimentos' },
          { label: 'Detail' },
        ]}
      />,
    )
    expect(html).toMatch(/href="\/pedimentos"/)
  })

  it('does NOT wrap the last item even if href is supplied (current page)', () => {
    const html = renderToStaticMarkup(
      <AguilaBreadcrumb
        items={[
          { label: 'Pedimentos', href: '/pedimentos' },
          { label: 'Detail', href: '/pedimentos/123' },
        ]}
      />,
    )
    // Only one <a> — the first item. The last stays plain text.
    const anchorCount = (html.match(/<a /g) || []).length
    expect(anchorCount).toBe(1)
  })

  it('wires aria-label for nav landmark', () => {
    const html = renderToStaticMarkup(
      <AguilaBreadcrumb items={[{ label: 'A' }, { label: 'B' }]} />,
    )
    expect(html).toMatch(/aria-label="Ubicación"/)
  })
})
