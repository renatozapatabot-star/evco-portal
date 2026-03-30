const { createClient } = require('@supabase/supabase-js')
const { extractWithQwen, isOllamaRunning } = require('./qwen-extract')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  console.log('🏭 Supplier Intelligence — risk scoring')

  const ollamaUp = await isOllamaRunning()
  if (!ollamaUp) { console.log('⚠️ Ollama not running'); return }

  // Get top suppliers with history
  const { data: suppliers } = await supabase
    .from('aduanet_facturas')
    .select('proveedor, valor_usd, igi, fraccion, fecha_pago')
    .eq('clave_cliente', '9254')
    .order('fecha_pago', { ascending: false })

  if (!suppliers?.length) return

  // Group by supplier
  const supplierMap = {}
  for (const f of suppliers) {
    if (!f.proveedor) continue
    if (!supplierMap[f.proveedor]) {
      supplierMap[f.proveedor] = { ops: 0, totalValue: 0, igiPaid: 0, tmecOps: 0, fracciones: new Set() }
    }
    const s = supplierMap[f.proveedor]
    s.ops++
    s.totalValue += f.valor_usd || 0
    if ((f.igi || 0) > 0) s.igiPaid++
    else s.tmecOps++
    if (f.fraccion) s.fracciones.add(f.fraccion)
  }

  const RISK_PROMPT = `You are a customs compliance expert analyzing supplier risk.
Given this supplier profile, return a risk assessment JSON:
{
  "risk_score": number 0-100 (0=safest, 100=highest risk),
  "risk_factors": ["list of specific risk factors"],
  "tmec_consistency": "always" or "sometimes" or "never",
  "value_pattern": "stable" or "volatile" or "declining" or "growing",
  "recommendation": "one sentence recommendation"
}
Return JSON only.`

  let scored = 0
  for (const [name, data] of Object.entries(supplierMap).slice(0, 50)) {
    const profile = `
Supplier: ${name}
Total operations: ${data.ops}
Total value: $${Math.round(data.totalValue).toLocaleString()} USD
T-MEC applied: ${data.tmecOps}/${data.ops} operations
IGI paid (no T-MEC): ${data.igiPaid} times
Fracciones used: ${[...data.fracciones].join(', ')}
`
    const risk = await extractWithQwen(profile, RISK_PROMPT)
    if (!risk) continue

    await supabase.from('supplier_contacts')
      .update({
        risk_score: risk.risk_score,
        risk_factors: risk.risk_factors,
        tmec_consistency: risk.tmec_consistency,
        recommendation: risk.recommendation,
        risk_scored_at: new Date().toISOString()
      })
      .ilike('proveedor', `%${name.split(' ')[0]}%`)

    scored++
  }

  console.log(`✅ Supplier intelligence: ${scored} suppliers scored`)
}

module.exports = { run }
run().catch(console.error)
