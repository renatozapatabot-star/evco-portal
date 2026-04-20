/**
 * Golden fixture — invoice #4526219 (Plastic Process Equipment Inc → EVCO Plastics).
 *
 * First real invoice Tito wants the classifier to handle end-to-end.
 * Ground truth: 5 parts already classified in GlobalPC + Anexo 24; 4 parts
 * (18MB, 28MB, BG600E, W-5) need new OCA opinions signed by Tito. The
 * fracciones + NICO in expected-output.json are the correct LIGIE/TIGIE
 * answers for these goods — the pipeline must land on them (or better,
 * with defensible GRI reasoning) for the first real ship to be 10/10.
 *
 * Phases land this test progressively:
 *   - Phase 0 (here): fixture files exist and parse; pipeline tests are TODO.
 *   - Phase 2: invoice-extract pipeline green on this fixture.
 *   - Phase 3: resolve-parts correctly tags the 5 pre-classified / 4 unknown split.
 *   - Phase 4: Opus prompt (mocked) returns the expected shape; real-call test
 *     is gated by env var OCA_LIVE_CLASSIFIER_TEST=1.
 *   - Phase 8: end-to-end assertion on the 4 expected fracciones.
 */
import { describe, it, expect } from 'vitest'
import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const FIXTURE_DIR = resolve(__dirname, '../../../../.planning/fixtures/oca-4526219')
const FIXTURE_PDF = resolve(FIXTURE_DIR, 'invoice.pdf')
const FIXTURE_JSON = resolve(FIXTURE_DIR, 'expected-output.json')

describe('Golden fixture — invoice #4526219 (Tito OCA Classifier · first real ship)', () => {
  it('fixture PDF exists and is a real invoice', async () => {
    const s = await stat(FIXTURE_PDF)
    expect(s.size).toBeGreaterThan(100_000)
    expect(s.size).toBeLessThan(5_000_000)
  })

  it('expected-output.json parses with the invoice metadata', async () => {
    const raw = await readFile(FIXTURE_JSON, 'utf8')
    const expected = JSON.parse(raw)
    expect(expected.invoice_number).toBe('4526219')
    expect(expected.supplier).toBe('Plastic Process Equipment, Inc')
    expect(expected.clave_cliente).toBe('9254')
    expect(expected.trafico_ref).toBe('9254-Y4554')
    expect(expected.total_invoice_amount_usd).toBe(651.53)
  })

  it('expected-output.json lists 9 parts with the correct 4 unknowns for Tito to classify', async () => {
    const expected = JSON.parse(await readFile(FIXTURE_JSON, 'utf8'))
    expect(expected.parts).toHaveLength(9)
    const unknowns = expected.expected_classifications.unknowns.map(
      (u: { item_no: string }) => u.item_no,
    )
    expect(unknowns).toEqual(['18MB', '28MB', 'BG600E', 'W-5'])
  })

  it('expected-output.json encodes the correct TIGIE fracciones for the 4 unknowns', async () => {
    const expected = JSON.parse(await readFile(FIXTURE_JSON, 'utf8'))
    const byItem = Object.fromEntries(
      expected.expected_classifications.unknowns.map(
        (u: { item_no: string; fraccion: string; nico: string }) => [
          u.item_no,
          { fraccion: u.fraccion, nico: u.nico },
        ],
      ),
    )
    expect(byItem['18MB']).toEqual({ fraccion: '9603.90.99', nico: '99' })
    expect(byItem['28MB']).toEqual({ fraccion: '9603.90.99', nico: '99' })
    expect(byItem['BG600E']).toEqual({ fraccion: '8424.20.01', nico: '00' })
    expect(byItem['W-5']).toEqual({ fraccion: '7318.15.99', nico: '99' })
  })

  it('expected-output.json flags the T-MEC certificate discrepancy on certificate line #1', async () => {
    const expected = JSON.parse(await readFile(FIXTURE_JSON, 'utf8'))
    const flag = expected.expected_classifications.tmec_discrepancy_flag
    expect(flag.certificate_line).toBe(1)
    expect(flag.certificate_shows).toBe('9306.90')
    expect(flag.correct_fraccion).toBe('9603.90')
  })

  it.todo('pipeline: extract → resolve → classify produces the 4 expected fracciones')
  it.todo('pipeline: tmec_discrepancy_flag surfaces when Tito uploads the mismatched certificate')
  it.todo('PDF render: four OCA-YYYY-NNN PDFs produced, each carrying /s/ and Patente 3596')
  it.todo('Delivery: Mensajería (or email) to Eloisa carries the 4 signed OCA PDFs + PORTAL-native summary')
  it.todo('SuperTito: classification_log rows written with supertito_agreed=true when proposal kept as-is')
})
