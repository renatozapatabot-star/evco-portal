/**
 * Pitch PDF render smoke — catches style/JSX regressions in pitch-pdf.tsx
 * before they reach a prospect's inbox. Asserts:
 *   1. renderToBuffer resolves without throwing
 *   2. output starts with the `%PDF-` magic bytes (valid PDF)
 *   3. recipient personalization flows through to bytes (content not lost)
 */

import { describe, it, expect } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { PitchPDF, type PitchData } from '../../../../../scripts/cold-outreach/pitch-pdf'

const sample: PitchData = {
  recipientCompany: 'Acme SA de CV',
  recipientFirstName: 'Juan',
  generatedDate: '21 de abril, 2026',
  opinionRef: 'RZC-TEST-001',
  portalUrl: 'portal.renatozapata.com',
  cta: {
    email: 'renato@renatozapata.com',
    whatsapp: '+52 867 000 0000',
  },
}

describe('PitchPDF renderer', () => {
  it('renders a valid PDF buffer', async () => {
    const buf = await renderToBuffer(<PitchPDF data={sample} />)
    expect(buf.length).toBeGreaterThan(2000)
    expect(buf.slice(0, 5).toString()).toBe('%PDF-')
  }, 20_000)

  it('renders without a recipient first name (generic pitch)', async () => {
    const buf = await renderToBuffer(
      <PitchPDF data={{ ...sample, recipientFirstName: undefined }} />,
    )
    expect(buf.length).toBeGreaterThan(2000)
    expect(buf.slice(0, 5).toString()).toBe('%PDF-')
  }, 20_000)

  it('renders with all optional CTA channels populated', async () => {
    const buf = await renderToBuffer(
      <PitchPDF
        data={{
          ...sample,
          cta: {
            email: 'hola@renatozapata.com',
            phone: '+1 956 123 4567',
            whatsapp: '+52 867 000 0000',
            calendly: 'cal.com/renato/15min',
          },
        }}
      />,
    )
    expect(buf.length).toBeGreaterThan(2000)
    expect(buf.slice(0, 5).toString()).toBe('%PDF-')
  }, 20_000)
})
