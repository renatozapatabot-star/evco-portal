require('dotenv').config({path: '.env.local'})
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function fix() {
  let from = 0, updated = 0
  while(true) {
    const r = await sb.from('entradas').select('cve_entrada,descripcion_mercancia').eq('company_id','evco').not('descripcion_mercancia','is',null).range(from, from+999)
    if (!r.data || r.data.length === 0) break
    for (const e of r.data) {
      await sb.from('entrada_lifecycle').update({supplier: (e.descripcion_mercancia||'').slice(0,100)}).eq('entrada_number', e.cve_entrada)
      updated++
    }
    if (r.data.length < 1000) break
    from += 1000
    if (from % 5000 === 0) console.log('Updated:', updated)
  }
  console.log('Done. Updated:', updated)
}
fix()
