// scripts/lib/workflow-emitter.js
// ============================================================================
// CRUZ 2.0 — Workflow Event Emitter
//
// Shared module used by every pipeline script to announce completion
// and trigger downstream workflows. The glue that chains 7 workflows.
//
// Usage:
//   const { emitEvent, chainNext, getEventsByTrigger } = require('./lib/workflow-emitter')
//   await emitEvent('intake', 'email_processed', traficoId, companyId, { products })
//   await chainNext(completedEvent)
//
// Patente 3596 · Aduana 240
// ============================================================================

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const VALID_WORKFLOWS = ['intake', 'classify', 'docs', 'pedimento', 'crossing', 'post_op', 'invoice']
const VALID_STATUSES = ['pending', 'processing', 'completed', 'failed', 'dead_letter']

/**
 * Emit a workflow event — INSERT into workflow_events with status='pending'.
 *
 * @param {string} workflow - One of: intake, classify, docs, pedimento, crossing, post_op, invoice
 * @param {string} eventType - Descriptive event name (e.g., 'email_processed', 'classification_complete')
 * @param {string|null} triggerId - The tráfico ID, document ID, or pedimento ID that triggered this
 * @param {string} companyId - Tenant isolation key
 * @param {object} payload - Event-specific data (stored as JSONB)
 * @param {string|null} parentEventId - The event that caused this one (for tracing chains)
 * @returns {{ data: object|null, error: string|null }}
 */
async function emitEvent(workflow, eventType, triggerId, companyId, payload = {}, parentEventId = null) {
  if (!VALID_WORKFLOWS.includes(workflow)) {
    return { data: null, error: `Invalid workflow: ${workflow}. Must be one of: ${VALID_WORKFLOWS.join(', ')}` }
  }
  if (!companyId) {
    return { data: null, error: 'company_id is required for tenant isolation' }
  }

  const { data, error } = await supabase.from('workflow_events').insert({
    workflow,
    event_type: eventType,
    trigger_id: triggerId || null,
    company_id: companyId,
    payload,
    status: 'pending',
    parent_event_id: parentEventId || null,
  }).select().single()

  if (error) {
    console.error(`[workflow-emitter] Failed to emit ${workflow}.${eventType}: ${error.message}`)
    return { data: null, error: error.message }
  }

  return { data, error: null }
}

/**
 * Chain to the next workflow(s) after an event completes.
 * Looks up workflow_chains config table and emits pending events for each match.
 *
 * @param {object} completedEvent - The event that just completed (full row from workflow_events)
 * @returns {object[]} - Array of newly created events
 */
async function chainNext(completedEvent) {
  const { workflow, event_type, trigger_id, company_id, payload, id } = completedEvent

  // Look up chain rules
  const { data: chains, error } = await supabase
    .from('workflow_chains')
    .select('*')
    .eq('source_workflow', workflow)
    .eq('source_event', event_type)
    .eq('enabled', true)

  if (error) {
    console.error(`[workflow-emitter] Failed to look up chains for ${workflow}.${event_type}: ${error.message}`)
    return []
  }

  if (!chains || chains.length === 0) {
    return [] // Terminal event — no downstream chain
  }

  const emitted = []
  for (const chain of chains) {
    const result = await emitEvent(
      chain.target_workflow,
      chain.target_event,
      trigger_id,
      company_id,
      payload, // Pass through — downstream handler extracts what it needs
      id       // Parent event for tracing
    )
    if (result.data) {
      emitted.push(result.data)
    }
  }

  return emitted
}

/**
 * Update an event's status (used by the processor).
 *
 * @param {string} eventId - UUID of the event
 * @param {string} status - New status
 * @param {object} updates - Additional fields to update (error_message, etc.)
 */
async function updateEventStatus(eventId, status, updates = {}) {
  if (!VALID_STATUSES.includes(status)) {
    console.error(`[workflow-emitter] Invalid status: ${status}`)
    return
  }

  const fields = { status, ...updates }
  if (status === 'processing') fields.processing_at = new Date().toISOString()
  if (status === 'completed') fields.completed_at = new Date().toISOString()

  const { error } = await supabase
    .from('workflow_events')
    .update(fields)
    .eq('id', eventId)

  if (error) {
    console.error(`[workflow-emitter] Failed to update event ${eventId}: ${error.message}`)
  }
}

/**
 * Get all events for a trigger (tráfico), ordered chronologically.
 * Used by the portal to render the workflow timeline.
 *
 * @param {string} triggerId - The tráfico/document/pedimento ID
 * @param {string} companyId - Tenant isolation
 * @returns {object[]}
 */
async function getEventsByTrigger(triggerId, companyId) {
  const { data, error } = await supabase
    .from('workflow_events')
    .select('*')
    .eq('trigger_id', triggerId)
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error(`[workflow-emitter] Failed to fetch events for ${triggerId}: ${error.message}`)
    return []
  }

  return data || []
}

/**
 * Fetch pending events for the processor to pick up.
 *
 * @param {number} limit - Max events to fetch per poll
 * @returns {object[]}
 */
async function fetchPendingEvents(limit = 20) {
  const { data, error } = await supabase
    .from('workflow_events')
    .select('*')
    .eq('status', 'pending')
    .neq('event_type', 'entrada_synced')   // skip passthrough noise — starves real events
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error(`[workflow-emitter] Failed to fetch pending events: ${error.message}`)
    return []
  }

  return data || []
}

module.exports = {
  emitEvent,
  chainNext,
  updateEventStatus,
  getEventsByTrigger,
  fetchPendingEvents,
  supabase,
  VALID_WORKFLOWS,
}
