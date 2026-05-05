/**
 * FALLBACK_TENANT_ID — single source of truth.
 *
 * Legacy uuid used as `tenant_id` for rows whose company doesn't have a
 * tenant uuid in the DB (pre-multitenant EVCO rows from before
 * 2026-04-17). Block EE codified that this value should appear in
 * exactly one place; the gsd-verify ratchet
 * "Invariant Block-EE — FALLBACK_TENANT_ID" counts declarations and
 * fails if more than one exists.
 *
 * Both the GlobalPC mirror sync and the econta sync need this fallback
 * for legacy rows where `companies.tenant_id` is not populated. They
 * import it from here instead of redeclaring.
 *
 * NEVER add a fallback for company_id — the Block EE contract is
 * explicit about this. company_id MUST be sourced from the row's true
 * client (clave_cliente → companies). Only the legacy tenant_id field
 * has this fallback during the multitenant migration.
 */

const FALLBACK_TENANT_ID = '52762e3c-bd8a-49b8-9a32-296e526b7238'

module.exports = { FALLBACK_TENANT_ID }
