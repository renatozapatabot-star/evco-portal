import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Summary of globalpc_facturas for revenue grounding
const { data: gf } = await sb.from('globalpc_facturas')
  .select('valor_comercial, flete, moneda, company_id, cve_trafico')
  .range(0, 4999)

// Join with companies to get per-client totals
const byClient = new Map()
for (const r of gf || []) {
  const cid = r.company_id; if (!cid) continue
  let s = byClient.get(cid) || { count: 0, vcUSD: 0, vcMXN: 0, fleteUSD: 0, fleteMXN: 0 }
  s.count++
  const vc = Number(r.valor_comercial) || 0
  const fl = Number(r.flete) || 0
  if (r.moneda === 'USD' || r.moneda === 'DLS') { s.vcUSD += vc; s.fleteUSD += fl }
  else { s.vcMXN += vc; s.fleteMXN += fl }
  byClient.set(cid, s)
}

// Top 15 by facturas count
const top = [...byClient.entries()].sort((a,b)=>b[1].count-a[1].count).slice(0, 15)
console.log('client_id | facturas | vc_USD | vc_MXN | flete_USD | flete_MXN')
for (const [cid, s] of top) {
  console.log(`${cid} | ${s.count} | ${s.vcUSD.toFixed(0)} | ${s.vcMXN.toFixed(0)} | ${s.fleteUSD.toFixed(0)} | ${s.fleteMXN.toFixed(0)}`)
}
console.log(`\nTotal facturas sampled: ${gf?.length}`)
