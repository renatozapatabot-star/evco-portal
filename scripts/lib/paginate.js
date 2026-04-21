// scripts/lib/paginate.js
// Shared pagination helper — Supabase PostgREST caps at 1,000 rows per request.
// Use fetchAll() instead of .limit(5000) to get all matching rows.

/**
 * Paginate a Supabase query using .range() to bypass the 1,000-row cap.
 * @param {Object} query - A Supabase query builder (before .limit() or .range())
 * @param {number} batchSize - Rows per page (default 1000)
 * @returns {Promise<Array>} All matching rows
 */
async function fetchAll(query, batchSize = 1000) {
  const all = []
  let offset = 0
  while (true) {
    const { data, error } = await query.range(offset, offset + batchSize - 1)
    if (error) throw new Error(`fetchAll error at offset ${offset}: ${error.message}`)
    if (!data || data.length === 0) break
    all.push(...data)
    offset += batchSize
    if (data.length < batchSize) break
  }
  return all
}

module.exports = { fetchAll }
