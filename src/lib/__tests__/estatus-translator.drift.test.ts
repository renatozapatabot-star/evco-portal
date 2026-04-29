/**
 * Drift fence between the script-side estatus translator
 * (scripts/lib/translate-estatus.js, runs at sync time and writes to DB)
 * and the display-side translator
 * (src/lib/estatus-translator.ts, reads DB and renders to UI).
 *
 * Single source of truth for the cockpit's mapping is the TS file —
 * its MAP keys are the canonical values <StatusBadge> understands.
 * The JS translator is allowed to write any value it likes, but every
 * possible output it produces must be a known key in the TS map.
 * Otherwise a sync run could write a label the cockpit will render as
 * raw text.
 *
 * This test asserts:
 *   1. Every label the JS translator can RETURN is a key in the TS MAP.
 *   2. Every raw-despacho code the JS translator declares exists is
 *      also a key in the TS MAP (so if it ever leaks past sync, the
 *      cockpit translates it instead of rendering 'E1' raw).
 */

import { describe, it, expect } from 'vitest'
import { translateEstatus as tsTranslate } from '../estatus-translator'
// CommonJS interop: vitest's default transform handles require() of
// the .js sibling.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jsModule = require('../../../scripts/lib/translate-estatus.js') as {
  translateEstatus: (input: { fecha_cruce?: string | null; fecha_pago?: string | null }) => string
  RAW_DESPACHO_CODES: Set<string>
}

describe('estatus translator drift fence', () => {
  // Enumerate every possible JS translator output by hitting each branch.
  const jsOutputs = new Set<string>([
    jsModule.translateEstatus({ fecha_pago: '2026-04-15', fecha_cruce: null }),
    jsModule.translateEstatus({ fecha_pago: null, fecha_cruce: '2026-04-15' }),
    jsModule.translateEstatus({ fecha_pago: null, fecha_cruce: null }),
  ])

  it('every JS translator output is a known key in the TS map', () => {
    for (const label of jsOutputs) {
      const result = tsTranslate(label)
      // The TS translator returns { label, tone: 'unknown' } when the
      // input isn't in MAP. Any unknown means the JS-side will write a
      // label the cockpit can't map.
      expect(
        result.tone,
        `JS translator returned "${label}" but TS map has no entry for it (would render as raw text)`,
      ).not.toBe('unknown')
    }
  })

  it('every RAW_DESPACHO_CODE is mapped on the TS side', () => {
    for (const code of jsModule.RAW_DESPACHO_CODES) {
      const result = tsTranslate(code)
      expect(
        result.tone,
        `RAW_DESPACHO_CODES contains "${code}" but TS map has no entry — if this code leaks past sync, cockpit shows "${code}" raw`,
      ).not.toBe('unknown')
    }
  })

  it('JS translator outputs are exactly the documented set', () => {
    // Defensive: locks the JS translator's return surface so a future
    // refactor that adds a 4th label has to update both sides + this
    // test. Documented set: 'Pedimento Pagado', 'Cruzado', 'En Proceso'.
    expect(jsOutputs).toEqual(
      new Set(['Pedimento Pagado', 'Cruzado', 'En Proceso']),
    )
  })
})
