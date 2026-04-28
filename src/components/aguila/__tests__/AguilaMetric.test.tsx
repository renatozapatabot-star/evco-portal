import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AguilaMetric } from '../AguilaMetric'

describe('AguilaMetric', () => {
  it('renders the value + label', () => {
    const html = renderToStaticMarkup(
      <AguilaMetric value="22" label="Minutos" />
    )
    expect(html).toContain('22')
    expect(html).toContain('Minutos')
  })

  it('renders unit at 60% of value size when provided', () => {
    const html = renderToStaticMarkup(
      <AguilaMetric value="22" unit="min" label="Proceso" />
    )
    expect(html).toContain('min')
    expect(html).toMatch(/font-size:60%/)
  })

  it('wraps value in .portal-num when mono (default)', () => {
    const html = renderToStaticMarkup(
      <AguilaMetric value="98.8" label="Audit" />
    )
    expect(html).toMatch(/class="portal-num"/)
  })

  it('drops .portal-num when mono={false}', () => {
    const html = renderToStaticMarkup(
      <AguilaMetric value="Ursula" label="Owner" mono={false} />
    )
    expect(html).not.toMatch(/class="portal-num"/)
  })

  it('applies positive tone color from the status-green token', () => {
    const html = renderToStaticMarkup(
      <AguilaMetric value="98%" label="On time" tone="positive" />
    )
    expect(html).toContain('var(--portal-status-green-fg)')
  })

  it('applies negative tone color from the status-red token', () => {
    const html = renderToStaticMarkup(
      <AguilaMetric value="3" label="Errores" tone="negative" />
    )
    expect(html).toContain('var(--portal-status-red-fg)')
  })

  it('applies attention tone color from the status-amber token', () => {
    const html = renderToStaticMarkup(
      <AguilaMetric value="2" label="Pendientes" tone="attention" />
    )
    expect(html).toContain('var(--portal-status-amber-fg)')
  })

  it('defaults to neutral tone (fg-1)', () => {
    const html = renderToStaticMarkup(
      <AguilaMetric value="42" label="Total" />
    )
    expect(html).toContain('var(--portal-fg-1)')
  })

  it('renders sub content when provided', () => {
    const html = renderToStaticMarkup(
      <AguilaMetric value="100" label="X" sub="last 30 days" />
    )
    expect(html).toContain('last 30 days')
  })

  it('becomes an interactive tile when href is set', () => {
    const html = renderToStaticMarkup(
      <AguilaMetric value="1" label="X" href="/pitch" />
    )
    expect(html).toMatch(/<a [^>]*href="\/pitch"/)
  })

  it('does not leak inline hex (token-only)', () => {
    const html = renderToStaticMarkup(
      <AguilaMetric value="1" label="x" tone="positive" />
    )
    expect(html).not.toMatch(/#[0-9a-fA-F]{6}/)
  })
})
