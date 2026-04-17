import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PortalCard } from '@/components/portal/PortalCard'

describe('PortalCard', () => {
  it('emits .portal-card class by default', () => {
    const html = renderToStaticMarkup(<PortalCard>x</PortalCard>)
    expect(html).toMatch(/class="portal-card"/)
  })

  it('applies tier modifiers', () => {
    const hero = renderToStaticMarkup(<PortalCard tier="hero">x</PortalCard>)
    expect(hero).toMatch(/portal-card--hero/)
    const raised = renderToStaticMarkup(<PortalCard tier="raised">x</PortalCard>)
    expect(raised).toMatch(/portal-card--raised/)
    const interactive = renderToStaticMarkup(<PortalCard tier="interactive">x</PortalCard>)
    expect(interactive).toMatch(/portal-card--interactive/)
  })

  it('wraps in a Link when href is set and auto-promotes to interactive tier', () => {
    const html = renderToStaticMarkup(<PortalCard href="/inicio">x</PortalCard>)
    expect(html).toMatch(/<a /)
    expect(html).toMatch(/href="\/inicio"/)
    expect(html).toMatch(/portal-card--interactive/)
  })

  it('adds portal-card--active when active prop is set', () => {
    const html = renderToStaticMarkup(<PortalCard active>x</PortalCard>)
    expect(html).toMatch(/portal-card--active/)
  })

  it('renders rail element for active-state indicator', () => {
    const html = renderToStaticMarkup(<PortalCard>x</PortalCard>)
    expect(html).toMatch(/class="portal-card__rail"/)
  })

  it('applies padding prop', () => {
    const html = renderToStaticMarkup(<PortalCard padding={32}>x</PortalCard>)
    expect(html).toMatch(/padding:32px/)
  })
})
