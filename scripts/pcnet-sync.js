const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function checkPcnetData() {
  console.log('📦 Checking PCNet and Bodega data...\n')
  const [pcnetRes, bodegaRes] = await Promise.all([
    supabase.from('pcnet_trafico_detail').select('*', { count: 'exact', head: true }),
    supabase.from('bodega_entradas').select('*', { count: 'exact', head: true }),
  ])
  console.log(`PCNet Tráfico Detail: ${(pcnetRes.count || 0).toLocaleString()} records`)
  console.log(`Bodega Entradas: ${(bodegaRes.count || 0).toLocaleString()} records`)

  const { data: pcSample } = await supabase.from('pcnet_trafico_detail').select('*').limit(3)
  const { data: bodSample } = await supabase.from('bodega_entradas').select('*').limit(3)
  if (pcSample?.length > 0) { console.log('\nPCNet columns:', Object.keys(pcSample[0]).join(', ')); console.log('Sample:', JSON.stringify(pcSample[0], null, 2).substring(0, 300)) }
  else console.log('\nPCNet: No data yet')
  if (bodSample?.length > 0) { console.log('\nBodega columns:', Object.keys(bodSample[0]).join(', ')); console.log('Sample:', JSON.stringify(bodSample[0], null, 2).substring(0, 300)) }
}

checkPcnetData().catch(console.error)
