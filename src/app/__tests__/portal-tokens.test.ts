import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const tokens = readFileSync(resolve(__dirname, '../portal-tokens.css'), 'utf8')
const components = readFileSync(resolve(__dirname, '../portal-components.css'), 'utf8')

describe('portal-tokens.css', () => {
  it('defines the 6-step ink scale with void = #050506', () => {
    expect(tokens).toMatch(/--portal-ink-0:\s*#050506/)
    for (const step of [1, 2, 3, 4, 5]) {
      expect(tokens).toMatch(new RegExp(`--portal-ink-${step}:`))
    }
  })

  it('defines the 5-step foreground scale', () => {
    for (const step of [1, 2, 3, 4, 5]) {
      expect(tokens).toMatch(new RegExp(`--portal-fg-${step}:`))
    }
  })

  it('defines an OKLCH emerald at green-2', () => {
    expect(tokens).toMatch(/--portal-green-2:\s*oklch\(/)
  })

  it('defines the 12-step type scale from micro to 5xl', () => {
    const sizes = ['micro', 'tiny', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl']
    for (const s of sizes) expect(tokens).toMatch(new RegExp(`--portal-fs-${s}:`))
  })

  it('defines an 11-step spacing scale', () => {
    for (let i = 1; i <= 11; i++) expect(tokens).toMatch(new RegExp(`--portal-s-${i}:`))
  })

  it('defines 4 motion duration steps and ease curves', () => {
    for (let i = 1; i <= 4; i++) expect(tokens).toMatch(new RegExp(`--portal-dur-${i}:`))
    expect(tokens).toMatch(/--portal-ease-out:/)
    expect(tokens).toMatch(/--portal-ease-in-out:/)
  })

  it('aliases legacy --aguila-* tokens to the new --portal-* system', () => {
    expect(tokens).toMatch(/--aguila-fs-body:\s*var\(--portal-fs-/)
    expect(tokens).toMatch(/--aguila-fs-title:\s*var\(--portal-fs-/)
  })

  it('supports theme-swap data attributes on the html element', () => {
    expect(tokens).toMatch(/\[data-accent=["']?teal/)
    expect(tokens).toMatch(/\[data-accent=["']?lime/)
    expect(tokens).toMatch(/\[data-density=["']?compact/)
    expect(tokens).toMatch(/\[data-motion=["']?off/)
  })

  // V1 canonical brand tokens — single source of truth for
  // tailwind.config.ts + design-system.ts mirrors.
  it('defines the 9-step gold scale (50 + 100-800) and gold-500 canonical base', () => {
    expect(tokens).toMatch(/--portal-gold-50:/)
    for (const step of [100, 200, 300, 400, 500, 600, 700, 800]) {
      expect(tokens).toMatch(new RegExp(`--portal-gold-${step}:`))
    }
    // Canonical brand base (ZAPATA_GOLD_BASE)
    expect(tokens).toMatch(/--portal-gold-500:\s*#C9A74A/)
  })

  it('defines --portal-z-red (heraldic mark-only color)', () => {
    expect(tokens).toMatch(/--portal-z-red:\s*#CC1B2F/)
  })

  it('defines a silver gold gradient for wordmark + CTAs', () => {
    expect(tokens).toMatch(/--portal-gold-gradient:\s*linear-gradient/)
  })
})

describe('portal-components.css', () => {
  it('ships the core class primitives', () => {
    for (const cls of ['.portal-btn', '.portal-card', '.portal-badge', '.portal-table', '.portal-ticker']) {
      expect(components).toContain(cls)
    }
  })

  it('respects prefers-reduced-motion', () => {
    expect(components).toMatch(/prefers-reduced-motion:\s*reduce/)
  })

  // V1 chip chemistry — canonical per portal-design-system.md §chip chemistry.
  it('ships the portal-badge--live emerald variant', () => {
    expect(components).toMatch(/\.portal-badge--live\s*\{/)
  })

  // V1 module-grid stagger — canonical per portal-design-system.md §stagger.
  it('ships the module-grid staggered entrance animation', () => {
    expect(components).toMatch(/\.portal-modules-grid\s*>\s*\*\s*\{/)
    expect(components).toMatch(/portalReveal\s+400ms/)
  })
})
