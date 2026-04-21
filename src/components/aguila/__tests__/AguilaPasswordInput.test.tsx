import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AguilaPasswordInput } from '../AguilaPasswordInput'

describe('AguilaPasswordInput', () => {
  it('renders an input with type=password by default (visible=false)', () => {
    const html = renderToStaticMarkup(<AguilaPasswordInput />)
    expect(html).toMatch(/<input[^>]*type="password"/)
  })

  it('renders label when provided', () => {
    const html = renderToStaticMarkup(
      <AguilaPasswordInput label="Contraseña actual" />
    )
    expect(html).toContain('Contraseña actual')
    expect(html).toMatch(/<label[^>]*class="portal-label"/)
  })

  it('ships an eye-toggle button with 44px min touch target', () => {
    const html = renderToStaticMarkup(<AguilaPasswordInput />)
    expect(html).toMatch(/<button[^>]*type="button"/)
    expect(html).toMatch(/min-width:44px/)
    expect(html).toMatch(/min-height:44px/)
  })

  it('labels the toggle in Spanish for screen readers', () => {
    const html = renderToStaticMarkup(<AguilaPasswordInput />)
    // Initial state: password hidden → button says "Mostrar contraseña"
    expect(html).toContain('aria-label="Mostrar contraseña"')
    expect(html).toMatch(/aria-pressed="false"/)
  })

  it('shows required indicator when required', () => {
    const html = renderToStaticMarkup(
      <AguilaPasswordInput label="Nueva contraseña" required />
    )
    expect(html).toContain('var(--portal-red)')
    expect(html).toContain('*')
  })

  it('renders hint when no error', () => {
    const html = renderToStaticMarkup(
      <AguilaPasswordInput label="X" hint="Mínimo 6 caracteres" />
    )
    expect(html).toContain('Mínimo 6 caracteres')
  })

  it('replaces hint with error and sets aria-invalid', () => {
    const html = renderToStaticMarkup(
      <AguilaPasswordInput
        label="X"
        hint="Mínimo 6"
        error="Demasiado corto"
      />
    )
    expect(html).toContain('Demasiado corto')
    expect(html).not.toContain('Mínimo 6')
    expect(html).toMatch(/role="alert"/)
    expect(html).toMatch(/aria-invalid="true"/)
  })

  it('preserves padding-right: 52 so text never overlaps toggle', () => {
    const html = renderToStaticMarkup(<AguilaPasswordInput />)
    expect(html).toMatch(/padding-right:52px/)
  })

  it('wires aria-describedby to error id when error', () => {
    const html = renderToStaticMarkup(
      <AguilaPasswordInput id="pw" error="Bad" />
    )
    expect(html).toMatch(/aria-describedby="pw-error"/)
  })

  it('does not leak the type="password" | "text" prop override', () => {
    // The input's type is controlled internally; TypeScript Omit prevents
    // external override. Verify base render keeps password type.
    const html = renderToStaticMarkup(<AguilaPasswordInput />)
    expect(html).not.toMatch(/type="text"/)
  })
})
