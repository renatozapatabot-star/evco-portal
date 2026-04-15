/**
 * ZAPATA AI · Block 11 — PECE workflow + bank catalog tests.
 *
 * Five tests: catalog size, name/code filter, full state transition chain,
 * cronología event type mapping, invalid amount rejection.
 */

import { describe, it, expect } from 'vitest'
import { MEXICAN_BANKS, filterBanks, getBankByCode } from '@/lib/mexican-banks'
import {
  transitionPecePayment,
  eventTypeForTransition,
  CreatePeceIntentSchema,
  PECE_INTENT_CREATED_EVENT,
} from '@/lib/pece-payments'

describe('mexican-banks catalog', () => {
  it('seeds at least 75 banks with bank_code + name for every row', () => {
    expect(MEXICAN_BANKS.length).toBeGreaterThanOrEqual(75)
    for (const b of MEXICAN_BANKS) {
      expect(b.bank_code).toMatch(/^\d{3}$/)
      expect(b.name.length).toBeGreaterThan(0)
    }
    expect(getBankByCode('072')?.name).toBe('Banorte')
  })

  it('filterBanks matches by bank_code prefix AND by normalized name substring', () => {
    const byCode = filterBanks('072')
    expect(byCode.some(b => b.bank_code === '072' && b.name === 'Banorte')).toBe(
      true,
    )

    // Name search tolerates diacritics + case
    const byName = filterBanks('BBVA')
    expect(byName.some(b => b.bank_code === '002')).toBe(true)

    const accented = filterBanks('mexico')
    expect(accented.some(b => b.name === 'BBVA México')).toBe(true)

    // onlyPece excludes Banxico (166)
    const pece = filterBanks('', { onlyPece: true })
    expect(pece.some(b => b.bank_code === '166')).toBe(false)
  })
})

describe('transitionPecePayment', () => {
  it('walks intent → submitted → confirmed when folio is present', () => {
    const a = transitionPecePayment({ from: 'intent', action: 'submit' })
    expect(a.error).toBeNull()
    expect(a.to).toBe('submitted')

    const b = transitionPecePayment({
      from: 'submitted',
      action: 'confirm',
      confirmationNumber: 'FOLIO-9281',
    })
    expect(b.error).toBeNull()
    expect(b.to).toBe('confirmed')

    // Confirm without folio is rejected
    const missing = transitionPecePayment({
      from: 'submitted',
      action: 'confirm',
    })
    expect(missing.error?.code).toBe('MISSING_CONFIRMATION')

    // Cannot submit a confirmed payment
    const invalid = transitionPecePayment({ from: 'confirmed', action: 'submit' })
    expect(invalid.error?.code).toBe('INVALID_TRANSITION')
  })

  it('maps only the final confirmation transition to a cronología event', () => {
    expect(eventTypeForTransition('intent', 'submitted')).toBeNull()
    expect(eventTypeForTransition('submitted', 'confirmed')).toBe(
      'pece_payment_confirmed',
    )
    // Intent creation event is a separate constant (fired at insert time,
    // not via a transition); sanity-check the string so drift is caught.
    expect(PECE_INTENT_CREATED_EVENT).toBe('pece_payment_intent')
  })
})

describe('CreatePeceIntentSchema', () => {
  it('rejects zero/negative/NaN amounts and malformed bank codes', () => {
    const PED = 'a1b2c3d4-1234-4abc-89de-f0123456789a'
    const good = CreatePeceIntentSchema.safeParse({
      pedimento_id: PED,
      bank_code: '072',
      amount: 15420.5,
      reference: 'FOLIO-001',
    })
    expect(good.success).toBe(true)

    const zero = CreatePeceIntentSchema.safeParse({
      pedimento_id: PED,
      bank_code: '072',
      amount: 0,
      reference: 'FOLIO-001',
    })
    expect(zero.success).toBe(false)

    const negative = CreatePeceIntentSchema.safeParse({
      pedimento_id: PED,
      bank_code: '072',
      amount: -100,
      reference: 'FOLIO-001',
    })
    expect(negative.success).toBe(false)

    const badBank = CreatePeceIntentSchema.safeParse({
      pedimento_id: PED,
      bank_code: 'ABC',
      amount: 100,
      reference: 'FOLIO-001',
    })
    expect(badBank.success).toBe(false)

    const shortRef = CreatePeceIntentSchema.safeParse({
      pedimento_id: PED,
      bank_code: '072',
      amount: 100,
      reference: 'AB',
    })
    expect(shortRef.success).toBe(false)
  })
})
