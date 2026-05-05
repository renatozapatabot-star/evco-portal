import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  PortalLastSeenLine,
  formatLastSeen,
  formatLastSeenStable,
} from '@/components/portal/login/PortalLastSeenLine'

const SAMPLE = {
  iso_ts: '2026-04-27T19:32:00.000Z',
  city: 'Nuevo Laredo',
  ua_brief: 'Chrome/macOS',
}

describe('PortalLastSeenLine SSR', () => {
  it('renders nothing on the server (no cookie until effect runs)', () => {
    // Effects don't run during SSR, so the component returns null.
    const html = renderToStaticMarkup(<PortalLastSeenLine />)
    expect(html).toBe('')
  })
})

// Audit Cluster M (2026-05-05): ua_brief is now intentionally dropped
// from the pre-auth display to avoid leaking the prior session's
// browser/OS to anyone holding the device. Tests assert the new
// no-fingerprint behavior.
describe('formatLastSeen', () => {
  it('produces the expected shape with date, time, city — no fingerprint', () => {
    const out = formatLastSeen(SAMPLE)
    expect(out.startsWith('Último acceso · ')).toBe(true)
    expect(out).toMatch(/Nuevo Laredo/)
    // 19:32 UTC → 14:32 in America/Chicago (CDT, UTC-5 during DST)
    expect(out).toMatch(/14:32/)
    // ua_brief intentionally omitted — pre-auth privacy.
    expect(out).not.toMatch(/Chrome/)
  })

  it('omits ua_brief regardless of value', () => {
    const populated = formatLastSeen(SAMPLE)
    const empty = formatLastSeen({ ...SAMPLE, ua_brief: '' })
    expect(populated).toBe(empty)
  })

  it('drops the city when missing', () => {
    const out = formatLastSeen({ ...SAMPLE, city: '' })
    expect(out).not.toMatch(/Nuevo Laredo/)
    expect(out).not.toMatch(/Chrome/)
  })

  it('returns empty string on invalid iso_ts', () => {
    expect(formatLastSeen({ ...SAMPLE, iso_ts: 'not-a-date' })).toBe('')
  })
})

describe('formatLastSeenStable (fallback formatter)', () => {
  it('produces a stable Spanish-month shape — no fingerprint', () => {
    const out = formatLastSeenStable(SAMPLE)
    expect(out).toMatch(/27 abr 2026/)
    expect(out).toMatch(/19:32/)
    expect(out).toMatch(/Nuevo Laredo/)
    expect(out).not.toMatch(/Chrome/)
  })
})
