import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AguilaTextarea } from '../AguilaTextarea'

describe('AguilaTextarea', () => {
  it('renders a textarea element with .portal-input class', () => {
    const html = renderToStaticMarkup(<AguilaTextarea />)
    expect(html).toMatch(/<textarea[^>]*class="portal-input"/)
  })

  it('renders label when provided', () => {
    const html = renderToStaticMarkup(<AguilaTextarea label="Notas" />)
    expect(html).toContain('Notas')
    expect(html).toMatch(/<label[^>]*class="portal-label"/)
  })

  it('shows required indicator when required', () => {
    const html = renderToStaticMarkup(
      <AguilaTextarea label="Descripción" required />
    )
    // Red asterisk via --portal-red token
    expect(html).toContain('var(--portal-red)')
    expect(html).toContain('*')
  })

  it('renders hint when no error', () => {
    const html = renderToStaticMarkup(
      <AguilaTextarea label="X" hint="Mínimo 5 caracteres" />
    )
    expect(html).toContain('Mínimo 5 caracteres')
  })

  it('replaces hint with error when both passed', () => {
    const html = renderToStaticMarkup(
      <AguilaTextarea
        label="X"
        hint="Mínimo 5"
        error="Demasiado corto"
      />
    )
    expect(html).toContain('Demasiado corto')
    expect(html).not.toContain('Mínimo 5')
    expect(html).toMatch(/role="alert"/)
    expect(html).toMatch(/aria-invalid="true"/)
  })

  it('wires aria-describedby to hint id when only hint', () => {
    const html = renderToStaticMarkup(
      <AguilaTextarea id="x" hint="tip" />
    )
    expect(html).toMatch(/aria-describedby="x-hint"/)
  })

  it('wires aria-describedby to error id when error', () => {
    const html = renderToStaticMarkup(
      <AguilaTextarea id="x" error="bad" />
    )
    expect(html).toMatch(/aria-describedby="x-error"/)
  })

  it('defaults rows=3 and honors custom rows', () => {
    const d = renderToStaticMarkup(<AguilaTextarea />)
    const c = renderToStaticMarkup(<AguilaTextarea rows={8} />)
    expect(d).toMatch(/rows="3"/)
    expect(c).toMatch(/rows="8"/)
  })

  it('applies vertical resize + minHeight 96 by default', () => {
    const html = renderToStaticMarkup(<AguilaTextarea />)
    expect(html).toMatch(/resize:vertical/)
    expect(html).toMatch(/min-height:96px/)
  })

  it('forwards additional styles without overriding core chemistry', () => {
    const html = renderToStaticMarkup(
      <AguilaTextarea style={{ minHeight: 200 }} />
    )
    // Caller's 200 wins over the default 96 (later in spread order)
    expect(html).toMatch(/min-height:200px/)
  })
})
