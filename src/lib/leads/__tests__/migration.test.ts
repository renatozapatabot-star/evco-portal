/**
 * Migration contract test — 20260421150251_leads_table.sql.
 *
 * Locks the shape of the leads migration so a future editor can't
 * silently break the contract that /admin/leads, /api/leads, and the
 * LEAD_STAGES/LEAD_SOURCES type tables assume.
 *
 * This is a grep-style shape test. It does NOT apply the migration
 * to a real database — that happens via `npx supabase db push` and
 * /api/health/data-integrity smoke verifies the live table.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// __dirname = src/lib/leads/__tests__ → ../../../../supabase/migrations/
const SQL = readFileSync(
  resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'supabase',
    'migrations',
    '20260421150251_leads_table.sql',
  ),
  'utf8',
)

describe('leads migration contract', () => {
  it('creates the leads table', () => {
    expect(SQL).toMatch(/CREATE TABLE IF NOT EXISTS leads/)
  })

  it('defines the required identity columns', () => {
    expect(SQL).toMatch(/id\s+uuid PRIMARY KEY/)
    expect(SQL).toMatch(/firm_name\s+text NOT NULL/)
    expect(SQL).toMatch(/contact_name\s+text/)
    expect(SQL).toMatch(/contact_email\s+text/)
    expect(SQL).toMatch(/rfc\s+text/)
  })

  it('defines source + stage columns with defaults', () => {
    expect(SQL).toMatch(/source\s+text NOT NULL DEFAULT 'cold-email'/)
    expect(SQL).toMatch(/stage\s+text NOT NULL DEFAULT 'new'/)
  })

  it('defines pipeline + activity columns', () => {
    expect(SQL).toMatch(/stage_changed_at\s+timestamptz/)
    expect(SQL).toMatch(/priority\s+text/)
    expect(SQL).toMatch(/value_monthly_mxn\s+numeric/)
    expect(SQL).toMatch(/last_contact_at\s+timestamptz/)
    expect(SQL).toMatch(/next_action_at\s+timestamptz/)
    expect(SQL).toMatch(/next_action_note\s+text/)
  })

  it('defines audit columns (created_at + updated_at)', () => {
    expect(SQL).toMatch(/created_at\s+timestamptz NOT NULL DEFAULT now\(\)/)
    expect(SQL).toMatch(/updated_at\s+timestamptz NOT NULL DEFAULT now\(\)/)
  })

  it('creates 5 performance indexes', () => {
    expect(SQL).toMatch(/CREATE INDEX IF NOT EXISTS leads_stage_idx/)
    expect(SQL).toMatch(/CREATE INDEX IF NOT EXISTS leads_source_idx/)
    expect(SQL).toMatch(/CREATE INDEX IF NOT EXISTS leads_next_action_idx/)
    expect(SQL).toMatch(/CREATE INDEX IF NOT EXISTS leads_owner_idx/)
    expect(SQL).toMatch(/CREATE INDEX IF NOT EXISTS leads_created_at_idx/)
  })

  it('ships the updated_at trigger function', () => {
    expect(SQL).toMatch(/CREATE OR REPLACE FUNCTION leads_touch_updated_at/)
    expect(SQL).toMatch(/NEW\.updated_at = now\(\)/)
  })

  it('bumps stage_changed_at only on actual stage change', () => {
    expect(SQL).toMatch(/IF OLD\.stage IS DISTINCT FROM NEW\.stage THEN/)
    expect(SQL).toMatch(/NEW\.stage_changed_at = now\(\)/)
  })

  it('wires the trigger BEFORE UPDATE', () => {
    expect(SQL).toMatch(/CREATE TRIGGER leads_touch_updated_at_trg/)
    expect(SQL).toMatch(/BEFORE UPDATE ON leads/)
  })

  it('enables Row Level Security', () => {
    expect(SQL).toMatch(/ALTER TABLE leads ENABLE ROW LEVEL SECURITY/)
  })

  it('creates a deny-all policy (service-role bypass only)', () => {
    expect(SQL).toMatch(/CREATE POLICY leads_deny_all ON leads/)
    expect(SQL).toMatch(/USING \(false\)/)
  })

  it('ships with a COMMENT describing the table purpose', () => {
    expect(SQL).toMatch(/COMMENT ON TABLE leads IS/)
  })

  it('uses IF NOT EXISTS / IF EXISTS for idempotency', () => {
    // Re-running the migration in a dev environment must not error
    expect(SQL).toMatch(/CREATE TABLE IF NOT EXISTS leads/)
    expect(SQL).toMatch(/CREATE INDEX IF NOT EXISTS/)
    expect(SQL).toMatch(/DROP TRIGGER IF EXISTS/)
    expect(SQL).toMatch(/DROP POLICY IF EXISTS/)
  })
})
