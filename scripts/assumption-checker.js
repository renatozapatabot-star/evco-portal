#!/usr/bin/env node
/**
 * CRUZ Assumption Checker — monthly self-challenge
 *
 * Validates every learned pattern still holds. Flags outdated assumptions.
 * The system that doesn't question itself stops learning.
 *
 * Cron: 0 3 1 * * (1st of month, 3 AM)
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

async function tg(msg) {
  if (DRY_RUN || process.env.TELEGRAM_SILENT === 'true' || !TELEGRAM_TOKEN) {
    console.log('[TG]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

async function main() {
  console.log(`🔍 Assumption Checker — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  const { data: patterns } = await supabase.from('learned_patterns')
    .select('*')
    .eq('active', true)
    .order('last_confirmed', { ascending: true })
    .limit(200)

  if (!patterns || patterns.length === 0) {
    console.log('  No active patterns to check.')
    return
  }

  let verified = 0
  let stillValid = 0
  let updated = 0
  const flagged = []

  for (const p of patterns) {
    verified++
    const ageInDays = Math.floor((Date.now() - new Date(p.last_confirmed).getTime()) / 86400000)

    // Crossing time patterns: check against recent data
    if (p.pattern_type === 'crossing_time') {
      const companyId = p.pattern_key.split(':')[1]
      if (companyId) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
        const { data: recent } = await supabase.from('traficos')
          .select('fecha_llegada, fecha_cruce')
          .eq('company_id', companyId)
          .not('fecha_cruce', 'is', null)
          .gte('fecha_cruce', thirtyDaysAgo)
          .limit(50)

        if (recent && recent.length >= 5) {
          const recentAvg = recent.reduce((s, t) => {
            const d = (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 86400000
            return s + Math.max(0, Math.min(d, 30))
          }, 0) / recent.length

          // Extract old avg from pattern_value
          const oldAvgMatch = p.pattern_value.match(/([\d.]+) días/)
          const oldAvg = oldAvgMatch ? parseFloat(oldAvgMatch[1]) : null

          if (oldAvg && Math.abs(recentAvg - oldAvg) > oldAvg * 0.2) {
            flagged.push({
              assumption: p.pattern_value,
              category: 'crossing_time',
              evidence_for: { historical_avg: oldAvg, samples: p.sample_size },
              evidence_against: { recent_avg: Math.round(recentAvg * 10) / 10, recent_samples: recent.length },
              still_valid: false,
              recommendation: `Actualizar: ${Math.round(oldAvg * 10) / 10}d → ${Math.round(recentAvg * 10) / 10}d`,
            })

            if (!DRY_RUN) {
              await supabase.from('learned_patterns').update({
                pattern_value: p.pattern_value.replace(/[\d.]+ días/, `${Math.round(recentAvg * 10) / 10} días`),
                last_confirmed: new Date().toISOString(),
                sample_size: (p.sample_size || 0) + recent.length,
              }).eq('id', p.id)
            }
            updated++
          } else {
            stillValid++
            if (!DRY_RUN) {
              await supabase.from('learned_patterns').update({
                last_confirmed: new Date().toISOString(),
              }).eq('id', p.id)
            }
          }
        } else {
          stillValid++ // insufficient data to challenge
        }
      }
    }

    // Supplier patterns
    else if (p.pattern_type === 'supplier_behavior') {
      // Pattern still valid if confidence >= 0.5 and age < 90 days
      if (ageInDays > 90) {
        flagged.push({
          assumption: p.pattern_value,
          category: 'supplier',
          evidence_for: { confidence: p.confidence, sample_size: p.sample_size },
          evidence_against: { stale_days: ageInDays },
          still_valid: false,
          recommendation: `No confirmado en ${ageInDays} días. Requiere datos frescos.`,
        })
      } else {
        stillValid++
      }
    }

    // Other patterns: check age
    else {
      if (ageInDays > 60 && (p.confidence || 0) < 0.8) {
        flagged.push({
          assumption: p.pattern_value,
          category: p.pattern_type,
          evidence_for: { confidence: p.confidence },
          evidence_against: { stale_days: ageInDays, low_confidence: true },
          still_valid: false,
          recommendation: 'Baja confianza + sin confirmación reciente. Considerar desactivar.',
        })
      } else {
        stillValid++
      }
    }
  }

  // Write flagged assumptions to audit table
  if (!DRY_RUN && flagged.length > 0) {
    for (const f of flagged) {
      await supabase.from('assumption_audit').insert(f).catch(() => {})
    }
  }

  // Rate assumptions
  const { data: rateConfig } = await supabase.from('system_config')
    .select('key, valid_to')
    .in('key', ['banxico_exchange_rate', 'dta_rates', 'iva_rate'])

  const expiringSoon = (rateConfig || []).filter(r => {
    if (!r.valid_to) return false
    const daysToExpiry = Math.floor((new Date(r.valid_to).getTime() - Date.now()) / 86400000)
    return daysToExpiry < 14
  })

  if (expiringSoon.length > 0) {
    for (const r of expiringSoon) {
      flagged.push({
        assumption: `${r.key} vigente`,
        category: 'rates',
        evidence_against: { expires: r.valid_to },
        still_valid: true,
        recommendation: `Expira pronto: ${r.valid_to}. Renovar.`,
      })
    }
  }

  const month = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'America/Chicago' })

  await tg(
    `🔍 <b>Auditoría de supuestos — ${month}</b>\n\n` +
    `Verificados: ${verified} | Vigentes: ${stillValid} | Actualizados: ${updated}\n` +
    (flagged.length > 0 ? flagged.slice(0, 3).map(f =>
      `⚠️ ${f.assumption.substring(0, 60)}\n   → ${f.recommendation}`
    ).join('\n') : '✅ Todos los supuestos vigentes') +
    `\n\n— CRUZ 🧠`
  )

  console.log(`\n✅ ${verified} checked · ${stillValid} valid · ${updated} updated · ${flagged.length} flagged`)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
