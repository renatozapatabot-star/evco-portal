import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AguilaBeforeAfter } from '../AguilaBeforeAfter'

describe('AguilaBeforeAfter', () => {
  it('renders both tiles with the passed values', () => {
    const html = renderToStaticMarkup(
      <AguilaBeforeAfter
        before="22 min"
        beforeLabel="Proceso manual"
        after="2 min"
        afterLabel="Con PORTAL"
      />
    )
    expect(html).toContain('22 min')
    expect(html).toContain('Proceso manual')
    expect(html).toContain('2 min')
    expect(html).toContain('Con PORTAL')
  })

  it('uses token-routed status chrome (red + green)', () => {
    const html = renderToStaticMarkup(
      <AguilaBeforeAfter
        before="22"
        beforeLabel="before"
        after="2"
        afterLabel="after"
      />
    )
    expect(html).toContain('var(--portal-status-red-bg)')
    expect(html).toContain('var(--portal-status-red-ring)')
    expect(html).toContain('var(--portal-status-green-bg)')
    expect(html).toContain('var(--portal-status-green-ring)')
  })

  it('wraps numbers in .portal-num (mono + tabular-nums)', () => {
    const html = renderToStaticMarkup(
      <AguilaBeforeAfter before="22" beforeLabel="b" after="2" afterLabel="a" />
    )
    const monoCount = (html.match(/class="portal-num"/g) ?? []).length
    expect(monoCount).toBe(2)
  })

  it('renders optional title when provided', () => {
    const html = renderToStaticMarkup(
      <AguilaBeforeAfter
        before="a"
        beforeLabel="b"
        after="c"
        afterLabel="d"
        title="Impacto medible"
      />
    )
    expect(html).toContain('Impacto medible')
  })

  it('omits title node when not provided', () => {
    const html = renderToStaticMarkup(
      <AguilaBeforeAfter before="a" beforeLabel="b" after="c" afterLabel="d" />
    )
    expect(html).not.toContain('Impacto medible')
  })

  it('does not leak inline hex (token-only)', () => {
    const html = renderToStaticMarkup(
      <AguilaBeforeAfter before="a" beforeLabel="b" after="c" afterLabel="d" />
    )
    expect(html).not.toMatch(/#[0-9a-fA-F]{6}/)
  })
})
