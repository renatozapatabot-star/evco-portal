/**
 * CRUZ Decision Logger — captures WHY, not just WHAT
 *
 * Shared module. Other scripts require and call logDecision().
 * Every decision logged with reasoning, alternatives, and data points.
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * @param {Object} params
 * @param {string} [params.trafico]
 * @param {string} [params.company_id]
 * @param {string} params.decision_type - classification|crossing_choice|zero_touch|approval|solicitation|anomaly_resolution|status_update
 * @param {string} params.decision
 * @param {string} [params.reasoning]
 * @param {Array} [params.alternatives] - [{option, score, reason_rejected}]
 * @param {Object} [params.dataPoints] - {key: value} of data used
 */
async function logDecision({
  trafico, company_id, decision_type, decision,
  reasoning, alternatives, dataPoints
}) {
  const entry = {
    trafico: trafico || null,
    company_id: company_id || null,
    decision_type,
    decision,
    reasoning: reasoning || null,
    alternatives_considered: alternatives ? JSON.stringify(alternatives) : null,
    data_points_used: dataPoints ? JSON.stringify(dataPoints) : null,
  }

  const { error } = await supabase.from('operational_decisions').insert(entry)
  if (error) {
    console.error(`[decision-logger] Failed to log: ${error.message}`)
  }
}

module.exports = { logDecision, supabase }
