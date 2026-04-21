import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { AguilaModal } from '../AguilaModal'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

describe('AguilaModal', () => {
  it('renders nothing when open=false', () => {
    const html = renderToStaticMarkup(
      <AguilaModal open={false} onClose={() => {}}>
        <p>Hidden content</p>
      </AguilaModal>,
    )
    expect(html).toBe('')
  })

  it('renders panel when open=true', () => {
    const html = renderToStaticMarkup(
      <AguilaModal open onClose={() => {}}>
        <p>Visible content</p>
      </AguilaModal>,
    )
    expect(html).toMatch(/Visible content/)
    expect(html).toMatch(/role="dialog"/)
    expect(html).toMatch(/aria-modal="true"/)
  })

  it('wires aria-labelledby from title prop', () => {
    const html = renderToStaticMarkup(
      <AguilaModal open onClose={() => {}} title="Asignar embarque">
        <p>content</p>
      </AguilaModal>,
    )
    expect(html).toMatch(/aria-labelledby="aguila-modal-title-/)
    expect(html).toMatch(/Asignar embarque/)
  })

  it('renders subtitle when provided', () => {
    const html = renderToStaticMarkup(
      <AguilaModal open onClose={() => {}} title="Title" subtitle="Ayuda breve">
        <p>content</p>
      </AguilaModal>,
    )
    expect(html).toMatch(/Ayuda breve/)
  })

  it('renders actions in footer', () => {
    const html = renderToStaticMarkup(
      <AguilaModal
        open
        onClose={() => {}}
        actions={<button type="button">Guardar</button>}
      >
        <p>content</p>
      </AguilaModal>,
    )
    expect(html).toMatch(/Guardar/)
    expect(html).toMatch(/<footer/)
  })

  it('applies custom maxWidth + padding', () => {
    const html = renderToStaticMarkup(
      <AguilaModal open onClose={() => {}} maxWidth={720} padding={40}>
        <p>content</p>
      </AguilaModal>,
    )
    expect(html).toMatch(/max-width:\s*720px/)
  })

  it('omits title header when title is absent', () => {
    const html = renderToStaticMarkup(
      <AguilaModal open onClose={() => {}}>
        <p>no title</p>
      </AguilaModal>,
    )
    expect(html).not.toMatch(/aguila-modal-title-/)
    expect(html).not.toMatch(/<h2/)
  })

  it('does not render footer when actions are absent', () => {
    const html = renderToStaticMarkup(
      <AguilaModal open onClose={() => {}} title="Title">
        <p>content</p>
      </AguilaModal>,
    )
    expect(html).not.toMatch(/<footer/)
  })
})
