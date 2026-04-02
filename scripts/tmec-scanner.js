require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const TMEC_CHAPTERS = ['39','84','85','87','72','76','73','28','29','32']

async function run() {
  const { data: traficos } = await sb
    .from('traficos')
    .select('id,trafico,company_id,importe_total,regimen,descripcion_mercancia')
    .eq('company_id','evco')
    .not('estatus','in','("Cruzado","Entregado")')
    .not('importe_total','is',null)
    .gte('importe_total', 1000)

  console.log(`Scanning ${traficos?.length} active tráficos...`)
  
  let alreadyTMEC = 0, opportunities = 0, totalSavings = 0
  
  for (const t of traficos || []) {
    const regimen = t.regimen || ''
    if (regimen.includes('ITE') || regimen.includes('ITR') || regimen.includes('IMD')) {
      alreadyTMEC++
      continue
    }
    
    const desc = (t.descripcion_mercancia || '').toUpperCase()
    const isPlastic = desc.includes('PLASTICO') || desc.includes('PLASTIC') || 
                      desc.includes('POLIMERO') || desc.includes('RESINA')
    
    if (isPlastic) {
      const savings = (t.importe_total || 0) * 0.05
      opportunities++
      totalSavings += savings
      
      if (savings > 1000) {
        await sb.from('notifications').insert({
          company_id: t.company_id,
          type: 'tmec_opportunity',
          title: `Oportunidad T-MEC: $${savings.toFixed(0)} USD — ${t.trafico}`,
          severity: 'info',
          read: false
        })
      }
    }
  }
  
  console.log(`✅ T-MEC Scan complete:`)
  console.log(`   Already T-MEC: ${alreadyTMEC}`)
  console.log(`   Opportunities: ${opportunities}`)
  console.log(`   Total savings: $${totalSavings.toFixed(0)} USD`)
}

run().catch(console.error)
