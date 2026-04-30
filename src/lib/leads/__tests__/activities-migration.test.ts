/**
 * Migration contract test — 20260421160000_lead_activities_table.sql.
 * Locks the shape of the lead_activities migration so a future editor
 * can't silently break the contract that the API + UI depend on.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SQL = readFileSync(
  resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'supabase',
    'migrations',
    '20260421160000_lead_activities_table.sql',
  ),
  'utf8',
)

describe('lead_activities migration contract', () => {
  it('creates the lead_activities table', () => {
    expect(SQL).toMatch(/CREATE TABLE IF NOT EXISTS lead_activities/)
  })

  it('defines the required identity columns', () => {
    expect(SQL).toMatch(/id\s+uuid PRIMARY KEY/)
    expect(SQL).toMatch(/lead_id\s+uuid NOT NULL REFERENCES leads\(id\) ON DELETE CASCADE/)
  })

  it('defines kind + summary as NOT NULL', () => {
    expect(SQL).toMatch(/kind\s+text NOT NULL/)
    expect(SQL).toMatch(/summary\s+text NOT NULL/)
  })

  it('includes a JSONB metadata sidecar', () => {
    expect(SQL).toMatch(/metadata\s+jsonb/)
  })

  it('denormalizes actor_name alongside actor_user_id', () => {
    expect(SQL).toMatch(/actor_user_id\s+uuid/)
    expect(SQL).toMatch(/actor_name\s+text/)
  })

  it('defines occurred_at + created_at audit columns', () => {
    expect(SQL).toMatch(/occurred_at\s+timestamptz NOT NULL DEFAULT now\(\)/)
    expect(SQL).toMatch(/created_at\s+timestamptz NOT NULL DEFAULT now\(\)/)
  })

  it('creates the lead_occurred composite index for timeline reads', () => {
    expect(SQL).toMatch(
      /CREATE INDEX IF NOT EXISTS lead_activities_lead_occurred_idx\s+ON lead_activities\(lead_id, occurred_at DESC\)/,
    )
  })

  it('creates a kind index + a partial actor index', () => {
    expect(SQL).toMatch(/CREATE INDEX IF NOT EXISTS lead_activities_kind_idx/)
    expect(SQL).toMatch(
      /CREATE INDEX IF NOT EXISTS lead_activities_actor_idx[^;]*WHERE actor_user_id IS NOT NULL/,
    )
  })

  it('enables Row Level Security', () => {
    expect(SQL).toMatch(/ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY/)
  })

  it('creates a deny-all policy (service-role bypass only)', () => {
    expect(SQL).toMatch(/CREATE POLICY lead_activities_deny_all ON lead_activities/)
    expect(SQL).toMatch(/USING \(false\)/)
  })

  it('ships with a COMMENT describing the table purpose', () => {
    expect(SQL).toMatch(/COMMENT ON TABLE lead_activities IS/)
  })

  it('is idempotent (safe to re-run)', () => {
    expect(SQL).toMatch(/CREATE TABLE IF NOT EXISTS lead_activities/)
    expect(SQL).toMatch(/CREATE INDEX IF NOT EXISTS/)
    expect(SQL).toMatch(/DROP POLICY IF EXISTS/)
  })
})
