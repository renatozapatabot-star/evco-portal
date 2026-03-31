#!/usr/bin/env node
// scripts/intelligence/karpathy-loop.js
// ============================================================================
// CRUZ Karpathy Loop — Shadow Training via Draft vs Actual Comparison
//
// Runs nightly at 3 AM. For each CRUZ-generated pedimento_draft:
// 1. Reconstructs the context CRUZ had when drafting
// 2. Asks Haiku to score the draft against the actual pedimento
// 3. Stores results in shadow_training_log
// 4. Sends Telegram summary
//
// Named after Andrej Karpathy's "training on your own outputs" pattern.
// CRUZ gets smarter by measuring its own accuracy against real outcomes.
// ============================================================================

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const MAX_PER_RUN = 50
const MODEL = 'claude-haiku-4-5-20251001'

async function sendTG(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

async function callHaiku(systemPrompt, userPrompt) {
  const t0 = Date.now()
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Haiku ${res.status}: ${text.substring(0, 200)}`)
  }

  const data = await res.json()
  const ms = Date.now() - t0

  // Log cost
  await supabase.from('api_cost_log').insert({
    model: MODEL,
    input_tokens: data.usage?.input_tokens || 0,
    output_tokens: data.usage?.output_tokens || 0,
    cost_usd: estimateCost(data.usage),
    action: 'karpathy-loop-scoring',
    client_code: 'system',
    latency_ms: ms,
  }).then(() => {}, () => {})

  return {
    text: data.content?.[0]?.text || '',
    ms,
    tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
  }
}

function estimateCost(usage) {
  if (!usage) return 0
  // Haiku pricing: $1/M input, $5/M output
  return (usage.input_tokens * 1 + usage.output_tokens * 5) / 1_000_000
}

function parseScoringResponse(text) {
  try {
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0])
    return {
      completed: Boolean(parsed.completed),
      accepted_without_revision: Boolean(parsed.accepted_without_revision),
      corrections_count: Math.min(Math.max(parseInt(parsed.corrections_count) || 0, 0), 5),
      corrections_content: parsed.corrections_content || '',
      score_overall: parsed.score_overall != null ? Number(parsed.score_overall) : null,
    }
  } catch {
    return null
  }
}

async function run() {
  const t0 = Date.now()
  console.log('\n🧠 CRUZ Karpathy Loop — Shadow Training')
  console.log(`   ${new Date().toLocaleString('es-MX', { timeZone: 'America/Chicago' })}`)
  console.log('   Patente 3596 · Aduana 240\n')

  if (!ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not set')
    await sendTG('🔴 <b>Karpathy Loop</b> · Missing ANTHROPIC_API_KEY')
    process.exit(1)
  }

  // 1. Get unscored drafts that have been reviewed or have a matching pedimento
  const { data: drafts, error: dErr } = await supabase
    .from('pedimento_drafts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(MAX_PER_RUN)

  if (dErr) {
    console.error('❌ Failed to fetch drafts:', dErr.message)
    await sendTG(`🔴 <b>Karpathy Loop</b> · ${dErr.message}`)
    process.exit(1)
  }

  console.log(`   ${drafts.length} drafts to evaluate`)

  // 2. Filter to only drafts not already scored
  const { data: alreadyScored } = await supabase
    .from('shadow_training_log')
    .select('email_id')

  const scoredIds = new Set((alreadyScored || []).map(r => r.email_id))
  const unscored = drafts.filter(d => !scoredIds.has(d.id))

  console.log(`   ${unscored.length} unscored (${scoredIds.size} already done)\n`)

  if (unscored.length === 0) {
    console.log('   Nothing to score. Exiting.\n')
    await sendTG('✅ <b>Karpathy Loop</b> · 0 drafts to score')
    return
  }

  // 3. For each draft, try to find matching actual pedimento
  let scored = 0
  let errors = 0
  let totalTokens = 0

  for (const draft of unscored) {
    try {
      const draftData = draft.draft_data || {}
      const supplier = draftData.supplier || 'unknown'
      const invoiceNum = draftData.invoice_number || ''
      const products = draftData.products || []

      // Try to find matching pedimento by supplier or invoice
      const { data: matchingPedimentos } = await supabase
        .from('pedimentos')
        .select('*')
        .ilike('trafico', '9254-%')
        .order('created_at', { ascending: false })
        .limit(5)

      const contextSummary = [
        `Supplier: ${supplier}`,
        `Invoice: ${invoiceNum}`,
        `Products: ${products.length}`,
        products.map(p => `  - ${p.description}: $${p.valor_usd} USD, fracción: ${p.fraccion || 'none'}`).join('\n'),
        `Draft created: ${draft.created_at}`,
      ].join('\n')

      const cruzDraft = JSON.stringify(draftData, null, 2)

      // Build actual outcome from matching pedimentos (if any)
      const actualOutcome = matchingPedimentos?.length
        ? JSON.stringify(matchingPedimentos[0], null, 2).substring(0, 2000)
        : 'No matching pedimento found yet'

      // 4. Ask Haiku to score
      const systemPrompt = `You are a customs broker quality auditor for Patente 3596, Aduana 240, Nuevo Laredo.
You evaluate CRUZ AI drafts against actual outcomes.
Score ONLY on operational metrics. Return JSON only, no commentary.`

      const userPrompt = `Compare this CRUZ-generated pedimento draft against the actual outcome.

CRUZ DRAFT:
${cruzDraft.substring(0, 3000)}

ACTUAL OUTCOME:
${actualOutcome.substring(0, 3000)}

Score as JSON:
{
  "completed": true/false,        // Did the draft address the situation?
  "accepted_without_revision": true/false,  // Could it be sent as-is?
  "corrections_count": 0-5,       // How many changes needed?
  "corrections_content": "...",   // What specific corrections?
  "score_overall": 0.0-1.0        // Overall quality score
}`

      const result = await callHaiku(systemPrompt, userPrompt)
      totalTokens += result.tokens

      const scores = parseScoringResponse(result.text)
      if (!scores) {
        console.warn(`   ⚠️  Could not parse scoring for draft ${draft.id}`)
        errors++
        continue
      }

      // 5. Store in shadow_training_log
      const { error: insertErr } = await supabase
        .from('shadow_training_log')
        .insert({
          account: 'ai@renatozapata.com',
          email_id: draft.id,
          context_summary: contextSummary,
          cruz_draft: cruzDraft.substring(0, 10000),
          actual_outcome: actualOutcome.substring(0, 10000),
          completed: scores.completed,
          completion_ms: result.ms,
          accepted_without_revision: scores.accepted_without_revision,
          corrections_count: scores.corrections_count,
          corrections_content: scores.corrections_content,
          score_overall: scores.score_overall,
        })

      if (insertErr) {
        console.error(`   ❌ Insert error: ${insertErr.message}`)
        errors++
      } else {
        scored++
        const emoji = scores.accepted_without_revision ? '✅' : scores.corrections_count <= 2 ? '🟡' : '🔴'
        console.log(`   ${emoji} ${supplier} · score: ${scores.score_overall} · corrections: ${scores.corrections_count}`)
      }
    } catch (err) {
      console.error(`   ❌ Error scoring draft ${draft.id}: ${err.message}`)
      errors++
    }
  }

  const sec = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\n══ Done · ${sec}s · Scored: ${scored} · Errors: ${errors} · Tokens: ${totalTokens} ══\n`)

  // Log to heartbeat
  await supabase.from('heartbeat_log').insert({
    script: 'karpathy-loop',
    status: errors > 0 ? 'partial' : 'success',
    details: { scored, errors, tokens: totalTokens, elapsed_s: parseFloat(sec) },
  }).then(() => {}, () => {})

  // Telegram summary
  const msg = scored > 0
    ? `🧠 <b>Karpathy Loop</b> · ${scored} drafts scored · ${errors} errors · ${totalTokens} tokens · ${sec}s`
    : `✅ <b>Karpathy Loop</b> · ${scored} scored · ${errors} errors · ${sec}s`
  await sendTG(msg)
}

run().catch(async err => {
  console.error('❌ Fatal:', err.message)
  await sendTG(`🔴 <b>Karpathy Loop FAILED</b>\n${err.message}`)
  process.exit(1)
})
