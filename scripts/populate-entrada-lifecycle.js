require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  let allEntradas = []
  let from = 0
  const pageSize = 1000

  console.log('🔄 Loading entradas (paginated)...')
  while (true) {
    const { data, error } = await sb
      .from('entradas')
      .select('cve_entrada,company_id,trafico,cve_proveedor,fecha_ingreso,created_at')
      .eq('company_id', 'evco')
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) { console.error('❌', error.message); process.exit(1) }
    if (!data || data.length === 0) break
    allEntradas = allEntradas.concat(data)
    if (data.length < pageSize) break
    from += pageSize
  }

  console.log(`✅ Total loaded: ${allEntradas.length} entradas`)

  // Batch upsert in chunks of 500
  const BATCH = 500
  let inserted = 0
  for (let i = 0; i < allEntradas.length; i += BATCH) {
    const chunk = allEntradas.slice(i, i + BATCH).map(e => ({
      entrada_number: e.cve_entrada,
      company_id: e.company_id,
      trafico_id: e.trafico || null,
      supplier: e.cve_proveedor || null,
      created_at: e.fecha_ingreso || e.created_at,
    }))

    const { error } = await sb
      .from('entrada_lifecycle')
      .upsert(chunk, { onConflict: 'entrada_number', ignoreDuplicates: true })

    if (error) console.error(`❌ Batch ${i}-${i+BATCH}:`, error.message)
    else {
      inserted += chunk.length
      console.log(`Progress: ${Math.min(i + BATCH, allEntradas.length)}/${allEntradas.length}`)
    }
  }

  console.log(`\n✅ Done. Processed: ${inserted}`)
}

run()
