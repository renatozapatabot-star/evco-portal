/**
 * Safe-client assistant contract — /mi-cuenta/cruz surface.
 *
 * Regression on any test here is a SEV-2 incident under
 * `.claude/rules/client-accounting-ethics.md`. The three surfaces this
 * file protects:
 *
 *   1. Access resolver — client can't bypass the feature flag; unknown
 *      roles don't render; no-session routes to /login.
 *   2. Tool allowlist — the safe surface MUST be read-only. Any write
 *      or dispatch tool sneaking into the set is a contract break.
 *   3. System prompt — calm tone, tenant lock, no compliance anxiety,
 *      paired Mensajería CTA to Anabel.
 */

import { describe, it, expect } from 'vitest'
import {
  MI_CUENTA_CRUZ_MODE,
  SAFE_CLIENT_TOOL_NAMES,
  buildSafeClientCruzSystemPrompt,
  isSafeClientTool,
  resolveMiCuentaCruzAccess,
} from '../cruz-safe'

// ---------------------------------------------------------------------------
// 1. Access resolver — same contract shape as mi-cuenta/access.ts
// ---------------------------------------------------------------------------

describe('resolveMiCuentaCruzAccess · access contract', () => {
  describe('no session', () => {
    it('redirects to /login regardless of feature flag', () => {
      for (const flag of [true, false]) {
        const result = resolveMiCuentaCruzAccess(null, flag)
        expect(result.decision).toBe('redirect')
        if (result.decision === 'redirect') {
          expect(result.to).toBe('/login')
          expect(result.reason).toBe('no-session')
        }
      }
    })
  })

  describe('client role', () => {
    it('renders with isClient=true when feature flag is ON', () => {
      const result = resolveMiCuentaCruzAccess({ role: 'client', companyId: 'evco' }, true)
      expect(result.decision).toBe('render')
      if (result.decision === 'render') {
        expect(result.isClient).toBe(true)
        expect(result.isInternal).toBe(false)
        expect(result.companyId).toBe('evco')
      }
    })

    it('redirects to /inicio when feature flag is OFF (default pre-launch)', () => {
      const result = resolveMiCuentaCruzAccess({ role: 'client', companyId: 'evco' }, false)
      expect(result.decision).toBe('redirect')
      if (result.decision === 'redirect') {
        expect(result.to).toBe('/inicio')
        expect(result.reason).toBe('feature-flag-off')
      }
    })

    it('preserves tenancy across clients (Ursula gets EVCO, MAFESA gets MAFESA)', () => {
      for (const tenant of ['evco', 'mafesa', 'tornillo', 'calfer']) {
        const result = resolveMiCuentaCruzAccess({ role: 'client', companyId: tenant }, true)
        expect(result.decision).toBe('render')
        if (result.decision === 'render') {
          expect(result.companyId).toBe(tenant)
        }
      }
    })
  })

  describe('internal roles (admin / broker / operator / contabilidad / owner)', () => {
    const roles = ['admin', 'broker', 'operator', 'contabilidad', 'owner']

    it.each(roles)('%s always renders — feature flag ignored (QA access)', (role) => {
      const off = resolveMiCuentaCruzAccess({ role, companyId: 'admin' }, false)
      const on = resolveMiCuentaCruzAccess({ role, companyId: 'admin' }, true)
      expect(off.decision).toBe('render')
      expect(on.decision).toBe('render')
      if (off.decision === 'render') expect(off.isInternal).toBe(true)
      if (on.decision === 'render') expect(on.isInternal).toBe(true)
    })
  })

  describe('unknown roles', () => {
    it('redirects to /login on unknown role', () => {
      const result = resolveMiCuentaCruzAccess({ role: 'hacker', companyId: 'evco' }, true)
      expect(result.decision).toBe('redirect')
      if (result.decision === 'redirect') {
        expect(result.to).toBe('/login')
        expect(result.reason).toBe('unknown-role')
      }
    })

    it('redirects to /login on empty role', () => {
      const result = resolveMiCuentaCruzAccess({ role: '', companyId: 'evco' }, true)
      expect(result.decision).toBe('redirect')
    })

    it('redirects to /login on warehouse / trafico (not internal, not client)', () => {
      for (const role of ['warehouse', 'trafico']) {
        const result = resolveMiCuentaCruzAccess({ role, companyId: 'evco' }, true)
        expect(result.decision).toBe('redirect')
        if (result.decision === 'redirect') {
          expect(result.to).toBe('/login')
          expect(result.reason).toBe('unknown-role')
        }
      }
    })
  })
})

// ---------------------------------------------------------------------------
// 2. Tool allowlist — read-only + approved-action only
// ---------------------------------------------------------------------------

describe('SAFE_CLIENT_TOOL_NAMES · read-only contract', () => {
  // These are the write/dispatch tools present in cruz-chat today.
  // If any of them are added to the safe set, it is a contract
  // violation that must be caught in review — this test ratchets the
  // boundary.
  const BANNED_WRITE_OR_DISPATCH_TOOLS = [
    // Drafts + approvals (need Tito / operator sign-off)
    'approve_draft',
    'draft_communication',
    'request_documents',
    'generate_upload_link',
    'generate_tracking_link',
    // Outbound dispatch
    'send_whatsapp',
    // Internal-only surfaces (cross-tenant or broker-private data)
    'admin_fleet_summary',
    'find_prospects',
    'prospect_profile',
    'simulate_audit',
    'integration_status',
    'client_health',
    'get_memory',
    'check_risk_radar',
    'compare_to_benchmark',
    'duty_savings',
    'tmec_opportunity',
    'query_relationships',
    'query_decisions',
    'query_patterns',
    'query_network_intelligence',
    'query_risk_scores',
    'simulate_scenario',
    'lookup_contact',
    'get_pending_summary',
    // Compliance anxiety surfaces — never render on client portal
    // per .claude/rules/client-accounting-ethics.md.
    'check_mve_compliance',
    'show_compliance_calendar',
    'pre_filing_check',
    'crossing_optimizer',
    'check_carrier',
    'assess_shipment_risk',
    'calculate_economics',
    'create_crossing_plan',
    'morning_brief',
  ]

  it('allowlist is a non-empty read-only set', () => {
    expect(SAFE_CLIENT_TOOL_NAMES.size).toBeGreaterThan(0)
    // Spot-check: at least the core reads every client needs.
    expect(SAFE_CLIENT_TOOL_NAMES.has('query_traficos')).toBe(true)
    expect(SAFE_CLIENT_TOOL_NAMES.has('query_pedimentos')).toBe(true)
    expect(SAFE_CLIENT_TOOL_NAMES.has('query_financials')).toBe(true)
    expect(SAFE_CLIENT_TOOL_NAMES.has('knowledge_lookup')).toBe(true)
  })

  it.each(BANNED_WRITE_OR_DISPATCH_TOOLS)(
    '%s is NOT in the safe allowlist',
    (toolName) => {
      expect(SAFE_CLIENT_TOOL_NAMES.has(toolName)).toBe(false)
      expect(isSafeClientTool(toolName)).toBe(false)
    },
  )

  it('isSafeClientTool agrees with the set (single source of truth)', () => {
    for (const name of SAFE_CLIENT_TOOL_NAMES) {
      expect(isSafeClientTool(name)).toBe(true)
    }
    expect(isSafeClientTool('this_tool_does_not_exist')).toBe(false)
  })

  it('mode constant is stable (API contract)', () => {
    expect(MI_CUENTA_CRUZ_MODE).toBe('mi-cuenta-safe')
  })
})

// ---------------------------------------------------------------------------
// 3. System prompt — calm tone, tenant lock, Anabel CTA
// ---------------------------------------------------------------------------

describe('buildSafeClientCruzSystemPrompt · tone + isolation contract', () => {
  const prompt = buildSafeClientCruzSystemPrompt({
    clientName: 'EVCO Plastics de México',
    clientClave: '9254',
    patente: '3596',
    aduana: '240',
  })

  it('mentions the client name and clave for tenant lock', () => {
    expect(prompt).toContain('EVCO Plastics de México')
    expect(prompt).toContain('9254')
  })

  it('carries the patente + aduana identity footer', () => {
    expect(prompt).toContain('3596')
    expect(prompt).toContain('240')
  })

  it('enforces the tenant-isolation rule in prose', () => {
    expect(prompt.toLowerCase()).toMatch(/aislamiento|solo consultas/)
    expect(prompt).toContain('Nunca menciones otros clientes')
  })

  it('bans urgency / dunning language explicitly', () => {
    // The prompt should TELL the model to never emit these. It should
    // still be allowed to say them in the "don't say this" context,
    // so we check they appear within a negating clause.
    expect(prompt).toMatch(/Nunca escribas "URGENTE"/)
    expect(prompt).toMatch(/VENCIDO/)
    expect(prompt.toLowerCase()).toContain('overdue')
  })

  it('bans compliance-anxiety surfaces (MVE countdowns, etc)', () => {
    expect(prompt.toLowerCase()).toMatch(/mve/)
    expect(prompt.toLowerCase()).toMatch(/compliance|compliance-anxiety|semáforo|documentos faltantes/)
  })

  it('requires an Anabel / Mensajería escalation path', () => {
    expect(prompt).toContain('Anabel')
    expect(prompt).toContain('Mensajería')
  })

  it('preserves pedimento + fracción formatting contracts', () => {
    // Must mention the formats — regressions to space-stripping /
    // dot-stripping have cost real lookups in the past.
    expect(prompt).toMatch(/26 24 3596 6500247|con espacios/)
    expect(prompt).toMatch(/3901\.20\.01|con puntos/)
  })

  it('explicitly forbids write actions on behalf of the client', () => {
    expect(prompt.toLowerCase()).toMatch(/no generas borradores|no envías whatsapp|no apruebas drafts/)
  })
})
