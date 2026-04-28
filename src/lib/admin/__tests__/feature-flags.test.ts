/**
 * Unit tests for the admin feature-flag resolver.
 *
 * Contract encoded here:
 *   - env=true always wins (production truth beats preview)
 *   - override only applies when env=false AND role is internal
 *   - client role never honors overrides (no preview leakage)
 *   - malformed cookie payloads degrade silently (no throw)
 *   - unknown flag keys are rejected (can't fabricate a flag)
 */
import { describe, expect, it, afterEach, beforeEach } from 'vitest'
import {
  FEATURE_FLAGS,
  isFlagEffective,
  isInternalRole,
  isKnownFlagKey,
  parseOverrideCookie,
  resolveFlagState,
  serializeOverrideCookie,
} from '../feature-flags'

const MI_CUENTA_CRUZ = FEATURE_FLAGS.find(f => f.key === 'mi_cuenta_cruz_enabled')!

function withEnv(envVar: string, value: string | undefined, fn: () => void) {
  const prev = process.env[envVar]
  if (value === undefined) delete process.env[envVar]
  else process.env[envVar] = value
  try {
    fn()
  } finally {
    if (prev === undefined) delete process.env[envVar]
    else process.env[envVar] = prev
  }
}

describe('isInternalRole', () => {
  it('accepts admin, broker, operator, contabilidad', () => {
    expect(isInternalRole('admin')).toBe(true)
    expect(isInternalRole('broker')).toBe(true)
    expect(isInternalRole('operator')).toBe(true)
    expect(isInternalRole('contabilidad')).toBe(true)
  })
  it('rejects client + null + unknowns', () => {
    expect(isInternalRole('client')).toBe(false)
    expect(isInternalRole(null)).toBe(false)
    expect(isInternalRole(undefined)).toBe(false)
  })
})

describe('isKnownFlagKey', () => {
  it('knows every flag in the catalog', () => {
    for (const f of FEATURE_FLAGS) {
      expect(isKnownFlagKey(f.key)).toBe(true)
    }
  })
  it('rejects anything else', () => {
    expect(isKnownFlagKey('totally_made_up')).toBe(false)
    expect(isKnownFlagKey('')).toBe(false)
  })
})

describe('parseOverrideCookie', () => {
  it('returns empty object for null / undefined / empty string', () => {
    expect(parseOverrideCookie(null)).toEqual({})
    expect(parseOverrideCookie(undefined)).toEqual({})
    expect(parseOverrideCookie('')).toEqual({})
  })
  it('returns empty object for malformed JSON', () => {
    expect(parseOverrideCookie('not-json')).toEqual({})
    expect(parseOverrideCookie('{"unclosed":')).toEqual({})
  })
  it('rejects arrays and primitives', () => {
    expect(parseOverrideCookie('[1,2,3]')).toEqual({})
    expect(parseOverrideCookie('"foo"')).toEqual({})
    expect(parseOverrideCookie('42')).toEqual({})
  })
  it('drops unknown flag keys silently', () => {
    const cookie = JSON.stringify({ not_a_flag: true, mi_cuenta_cruz_enabled: true })
    expect(parseOverrideCookie(cookie)).toEqual({ mi_cuenta_cruz_enabled: true })
  })
  it('normalizes string and numeric truthy/falsy forms', () => {
    const cookie = JSON.stringify({
      mi_cuenta_cruz_enabled: '1',
      mi_cuenta_enabled: 'false',
      mensajeria_client_enabled: true,
    })
    expect(parseOverrideCookie(cookie)).toEqual({
      mi_cuenta_cruz_enabled: true,
      mi_cuenta_enabled: false,
      mensajeria_client_enabled: true,
    })
  })
})

describe('serializeOverrideCookie', () => {
  it('drops unknown keys before serializing', () => {
    const out = serializeOverrideCookie({
      mi_cuenta_cruz_enabled: true,
      bogus_key: true,
    })
    const parsed = JSON.parse(out)
    expect(parsed).toEqual({ mi_cuenta_cruz_enabled: true })
  })
  it('coerces truthy values to strict boolean', () => {
    const out = serializeOverrideCookie({ mi_cuenta_cruz_enabled: true })
    expect(JSON.parse(out).mi_cuenta_cruz_enabled).toBe(true)
  })
})

describe('resolveFlagState', () => {
  beforeEach(() => {
    delete process.env[MI_CUENTA_CRUZ.envVar]
  })
  afterEach(() => {
    delete process.env[MI_CUENTA_CRUZ.envVar]
  })

  it('env=true ⇒ effective=true regardless of override', () => {
    withEnv(MI_CUENTA_CRUZ.envVar, 'true', () => {
      const state = resolveFlagState({
        def: MI_CUENTA_CRUZ,
        overrides: { mi_cuenta_cruz_enabled: false },
        role: 'client',
      })
      expect(state.envEnabled).toBe(true)
      expect(state.effectiveEnabled).toBe(true)
      expect(state.source).toBe('env')
    })
  })

  it('env=false + internal role + override=true ⇒ effective=true via override', () => {
    withEnv(MI_CUENTA_CRUZ.envVar, undefined, () => {
      const state = resolveFlagState({
        def: MI_CUENTA_CRUZ,
        overrides: { mi_cuenta_cruz_enabled: true },
        role: 'admin',
      })
      expect(state.envEnabled).toBe(false)
      expect(state.overrideApplies).toBe(true)
      expect(state.effectiveEnabled).toBe(true)
      expect(state.source).toBe('override')
    })
  })

  it('env=false + client role + override=true ⇒ effective=false (no client preview)', () => {
    withEnv(MI_CUENTA_CRUZ.envVar, undefined, () => {
      const state = resolveFlagState({
        def: MI_CUENTA_CRUZ,
        overrides: { mi_cuenta_cruz_enabled: true },
        role: 'client',
      })
      expect(state.effectiveEnabled).toBe(false)
      expect(state.overrideApplies).toBe(false)
      expect(state.source).toBe('default')
    })
  })

  it('env=false + no override ⇒ effective=false, source=default', () => {
    withEnv(MI_CUENTA_CRUZ.envVar, undefined, () => {
      const state = resolveFlagState({
        def: MI_CUENTA_CRUZ,
        overrides: {},
        role: 'admin',
      })
      expect(state.effectiveEnabled).toBe(false)
      expect(state.source).toBe('default')
    })
  })

  it('env typo — "1", "yes", "TRUE " — does NOT turn flag on', () => {
    for (const typo of ['1', 'yes', 'on', ' TRUE ']) {
      withEnv(MI_CUENTA_CRUZ.envVar, typo, () => {
        const state = resolveFlagState({
          def: MI_CUENTA_CRUZ,
          overrides: {},
          role: 'admin',
        })
        if (typo.trim().toLowerCase() === 'true') {
          expect(state.envEnabled).toBe(true)
        } else {
          expect(state.envEnabled).toBe(false)
        }
      })
    }
  })

  it('env=TRUE (case-insensitive with whitespace) flips on', () => {
    withEnv(MI_CUENTA_CRUZ.envVar, ' TRUE ', () => {
      const state = resolveFlagState({ def: MI_CUENTA_CRUZ, overrides: {}, role: 'admin' })
      expect(state.envEnabled).toBe(true)
    })
  })
})

describe('isFlagEffective (convenience wrapper)', () => {
  beforeEach(() => {
    delete process.env[MI_CUENTA_CRUZ.envVar]
  })
  afterEach(() => {
    delete process.env[MI_CUENTA_CRUZ.envVar]
  })

  it('unknown flag key is always false', () => {
    expect(
      isFlagEffective({ key: 'does_not_exist', overrides: {}, role: 'admin' }),
    ).toBe(false)
  })

  it('mirrors resolveFlagState for known keys', () => {
    withEnv(MI_CUENTA_CRUZ.envVar, undefined, () => {
      expect(
        isFlagEffective({
          key: 'mi_cuenta_cruz_enabled',
          overrides: { mi_cuenta_cruz_enabled: true },
          role: 'admin',
        }),
      ).toBe(true)
      expect(
        isFlagEffective({
          key: 'mi_cuenta_cruz_enabled',
          overrides: { mi_cuenta_cruz_enabled: true },
          role: 'client',
        }),
      ).toBe(false)
    })
  })
})
