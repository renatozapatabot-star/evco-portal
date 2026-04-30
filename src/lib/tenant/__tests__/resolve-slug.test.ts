/**
 * resolveCompanyIdSlug tests — Block-EE-style tenant identifier
 * normalization. Every writer that takes `company_id` from any
 * could-be-polluted source goes through this helper.
 *
 * Fixture corresponds to the actual companies allowlist shape used in
 * production: every active client has a clave_cliente; some have a
 * separate globalpc_clave; the Block-EE legacy pattern leaves an
 * `active=false` sibling sharing the same clave.
 */

import { describe, it, expect } from 'vitest'
import { resolveCompanyIdSlug, INTERNAL_SLUGS, type ClaveMap } from '../resolve-slug'

const claveMap: ClaveMap = new Map([
  ['9254', 'evco'],
  ['4598', 'mafesa'],
  ['1760', 'calfer'],
  ['2420', 'orphan-2420'],   // sentinel for unmatched clave (post-cleanup)
])
const slugAllowlist = new Set(['evco', 'mafesa', 'calfer', 'orphan-2420'])

describe('resolveCompanyIdSlug', () => {
  it('passes through an already-active slug unchanged', () => {
    const r = resolveCompanyIdSlug('evco', claveMap, slugAllowlist)
    expect(r.kind).toBe('resolved')
    if (r.kind === 'resolved') {
      expect(r.slug).toBe('evco')
      expect(r.via).toBe('slug-passthrough')
    }
  })

  it('resolves a 4-digit clave to its slug', () => {
    const r = resolveCompanyIdSlug('9254', claveMap, slugAllowlist)
    expect(r.kind).toBe('resolved')
    if (r.kind === 'resolved') {
      expect(r.slug).toBe('evco')
      expect(r.via).toBe('clave-mapped')
    }
  })

  it('resolves a clave with leading zeros (Mexican claves preserve the zero)', () => {
    const m: ClaveMap = new Map([['0101', 'embajada1']])
    const r = resolveCompanyIdSlug('0101', m)
    expect(r.kind).toBe('resolved')
    if (r.kind === 'resolved') expect(r.slug).toBe('embajada1')
  })

  it('returns unresolved for an unknown clave (not in allowlist) — never falls back', () => {
    const r = resolveCompanyIdSlug('9999', claveMap, slugAllowlist)
    expect(r.kind).toBe('unresolved')
    if (r.kind === 'unresolved') {
      expect(r.reason).toBe('unknown-clave')
      expect(r.input).toBe('9999')
    }
  })

  it('returns unresolved for null/undefined/empty without throwing', () => {
    for (const v of [null, undefined, '', '   ']) {
      const r = resolveCompanyIdSlug(v, claveMap)
      expect(r.kind).toBe('unresolved')
      if (r.kind === 'unresolved') expect(r.reason).toBe('null')
    }
  })

  it('treats internal-role sentinels (system/internal/admin/broker) as resolved', () => {
    for (const sentinel of ['system', 'internal', 'admin', 'broker']) {
      const r = resolveCompanyIdSlug(sentinel, claveMap)
      expect(r.kind).toBe('resolved')
      if (r.kind === 'resolved') {
        expect(r.slug).toBe(sentinel)
        expect(r.via).toBe('slug-passthrough')
      }
      expect(INTERNAL_SLUGS.has(sentinel)).toBe(true)
    }
  })

  it('rejects an unknown slug when allowlist is provided', () => {
    const r = resolveCompanyIdSlug('not-a-real-slug', claveMap, slugAllowlist)
    expect(r.kind).toBe('unresolved')
    if (r.kind === 'unresolved') expect(r.reason).toBe('unknown-slug')
  })

  it('accepts an unknown slug when no allowlist is provided (lenient mode)', () => {
    const r = resolveCompanyIdSlug('any-slug-here', claveMap)
    expect(r.kind).toBe('resolved')
    if (r.kind === 'resolved') {
      expect(r.slug).toBe('any-slug-here')
      expect(r.via).toBe('slug-passthrough')
    }
  })

  it('coerces non-string input to string before resolving (numeric clave)', () => {
    const r = resolveCompanyIdSlug(9254, claveMap, slugAllowlist)
    expect(r.kind).toBe('resolved')
    if (r.kind === 'resolved') {
      expect(r.slug).toBe('evco')
      expect(r.via).toBe('clave-mapped')
    }
  })

  it('trims whitespace before resolving', () => {
    const r = resolveCompanyIdSlug('  evco  ', claveMap, slugAllowlist)
    expect(r.kind).toBe('resolved')
    if (r.kind === 'resolved') expect(r.slug).toBe('evco')
  })

  it('does NOT silently default a clave-shape value — caller must handle unresolved explicitly', () => {
    // Regression guard: the old pattern was `claveMap[input] || input`,
    // which silently re-wrote the bad value. The new helper never does.
    // Test with a 4-digit clave (matches the clave-shape regex) that is
    // intentionally NOT in the allowlist.
    const r = resolveCompanyIdSlug('9999', claveMap)
    expect(r.kind).toBe('unresolved')
    // Verify the unresolved branch echoes input — caller must opt into a
    // skip-and-log path; there is no implicit fallback.
    if (r.kind === 'unresolved') {
      expect(r.input).toBe('9999')
      expect(r.reason).toBe('unknown-clave')
    }
  })

  it('routes the post-cleanup orphan sentinels (orphan-2420) as a slug', () => {
    // After the 2026-04-29 cleanup, claves 2420/5178 map to orphan- slugs.
    // The map test itself proves that input '2420' returns the orphan slug.
    const r = resolveCompanyIdSlug('2420', claveMap, slugAllowlist)
    expect(r.kind).toBe('resolved')
    if (r.kind === 'resolved') {
      expect(r.slug).toBe('orphan-2420')
      expect(r.via).toBe('clave-mapped')
    }
    // And direct passthrough of the slug also works.
    const r2 = resolveCompanyIdSlug('orphan-2420', claveMap, slugAllowlist)
    expect(r2.kind).toBe('resolved')
    if (r2.kind === 'resolved') expect(r2.slug).toBe('orphan-2420')
  })
})
