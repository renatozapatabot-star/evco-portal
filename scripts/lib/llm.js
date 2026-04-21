// scripts/lib/llm.js
// CRUZ unified LLM abstraction layer.
// Every script that calls an LLM should go through this module.
// Future model swaps become config changes, not code changes.

const Anthropic = require('@anthropic-ai/sdk')
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') })

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Model class → actual model mapping
// Change here, not in 14 different scripts
const MODEL_MAP = {
  fast:   'claude-haiku-4-5-20251001',
  smart:  'claude-sonnet-4-6',
  best:   'claude-opus-4-6',
  vision: 'claude-sonnet-4-6',
  local:  'claude-haiku-4-5-20251001',
}

const DEFAULTS = {
  modelClass: 'smart',
  maxTokens: 4096,
  temperature: 0.7,
  system: null,
  tools: null,
}

/**
 * Universal LLM call interface for all CRUZ scripts.
 *
 * @param {object} opts
 * @param {string} opts.modelClass     - 'fast' | 'smart' | 'best' | 'vision' | 'local'
 * @param {string|Array} opts.messages - String prompt or full Anthropic messages array
 * @param {string} [opts.system]       - System prompt
 * @param {number} [opts.maxTokens]    - Max output tokens (default 4096)
 * @param {number} [opts.temperature]  - Sampling temperature (default 0.7)
 * @param {Array}  [opts.tools]        - Tool definitions for tool use
 * @param {string} [opts.callerName]   - Identifier for observability
 * @returns {Promise<{text: string, raw: object, model: string, durationMs: number, tokensIn: number, tokensOut: number}>}
 */
async function llmCall(opts) {
  const o = { ...DEFAULTS, ...opts }
  const model = MODEL_MAP[o.modelClass] || MODEL_MAP.smart

  // Normalize messages: if string, wrap in user message
  const messages = typeof o.messages === 'string'
    ? [{ role: 'user', content: o.messages }]
    : o.messages

  const requestBody = {
    model,
    max_tokens: o.maxTokens,
    temperature: o.temperature,
    messages,
  }

  if (o.system) requestBody.system = o.system
  if (o.tools) requestBody.tools = o.tools

  const startMs = Date.now()
  let response
  let error = null

  try {
    response = await anthropic.messages.create(requestBody)
  } catch (e) {
    error = e
  }

  const durationMs = Date.now() - startMs

  // Extract text from response
  let text = ''
  if (response && response.content) {
    text = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('')
  }

  const tokensIn = response?.usage?.input_tokens || 0
  const tokensOut = response?.usage?.output_tokens || 0

  // Observability — console log always
  console.log(`[llm] ${o.callerName || 'unknown'} ${o.modelClass} ${tokensIn}in/${tokensOut}out ${durationMs}ms ${error ? 'ERROR: ' + error.message : 'ok'}`)

  // Try to log to llm_calls table (silent fail if doesn't exist)
  try {
    const { createClient } = require('@supabase/supabase-js')
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    sb.from('llm_calls').insert({
      caller: o.callerName || 'unknown',
      model_class: o.modelClass,
      model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      duration_ms: durationMs,
      success: !error,
      error_message: error ? String(error.message || error) : null,
      created_at: new Date().toISOString(),
    }).then(() => {}, () => {})
  } catch { /* table may not exist yet */ }

  if (error) throw error

  return {
    text,
    raw: response,
    model,
    durationMs,
    tokensIn,
    tokensOut,
  }
}

/**
 * Convenience helper for JSON-mode prompts.
 */
async function llmCallJson(opts) {
  const systemSuffix = '\n\nIMPORTANT: Respond ONLY with valid JSON. No prose, no markdown code fences, no commentary.'
  const result = await llmCall({
    ...opts,
    system: (opts.system || '') + systemSuffix,
  })

  let cleaned = result.text.trim()
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '')

  try {
    result.json = JSON.parse(cleaned)
  } catch (e) {
    result.jsonError = 'Failed to parse JSON: ' + e.message
    result.json = null
  }

  return result
}

module.exports = {
  llmCall,
  llmCallJson,
  MODEL_MAP,
  DEFAULTS,
}
