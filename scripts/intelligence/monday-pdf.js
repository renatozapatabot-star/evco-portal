#!/usr/bin/env node
const { callQwen } = require('./qwen-client-with-confidence');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function generateWeeklyBrief() {
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  
  const { data: shipments } = await supabase
    .from('traficos')
    .select('*')
    .eq('clave_cliente', '9254')
    .gte('created_at', lastWeek.toISOString());
  
  const prompt = `
Genera un informe ejecutivo semanal para EVCO Plastics:

Semana: ${lastWeek.toLocaleDateString('es-MX')} - ${new Date().toLocaleDateString('es-MX')}

Tráficos en la semana: ${shipments?.length || 0}

Genera:
1. Resumen ejecutivo (3 líneas)
2. Cumplimiento general
3. Próximos vencimientos
4. Recomendaciones

Formato profesional, español.
  `;
  
  const { output: report } = await callQwen(prompt, { requireConfidence: false });
  
  const filename = `/tmp/cruz-weekly-${new Date().toISOString().split('T')[0]}.md`;
  fs.writeFileSync(filename, report);
  console.log(`📄 Weekly report saved to ${filename}`);
  console.log('\n' + report);
}

if (require.main === module) {
  generateWeeklyBrief().catch(console.error);
}
