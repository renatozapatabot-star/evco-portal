#!/usr/bin/env node
/**
 * MVE Predictor — Predicts which shipments will miss MVE deadlines
 */

const { callQwen } = require('./qwen-client');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: __dirname + '/../../.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getShipmentsByMVE(daysAhead = 14) {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + daysAhead);
  
  const { data } = await supabase
    .from('traficos')
    .select('*')
    .eq('clave_cliente', '9254')
    .is('mve_folio', null)
    .not('estatus', 'ilike', '%cruzado%')
    .limit(30);
  
  return data || [];
}

async function predictMVERisk(shipment) {
  const prompt = `
Analiza este envío para riesgo de incumplimiento MVE:

Tráfico: ${shipment.trafico}
Llegada: ${shipment.fecha_llegada}
Proveedor: ${shipment.proveedor_nombre || 'Desconocido'}
Valor: ${shipment.valor_usd || 0} USD
Estatus: ${shipment.estatus}

Predice:
1. Probabilidad (%) de no tener MVE a tiempo
2. Fecha más temprana que se debe solicitar
3. Documentos críticos faltantes
4. Acción recomendada ahora

Responde en español concreto, máximo 100 palabras.
  `;
  
  return await callQwen(prompt, { temperature: 0.4 });
}

async function run() {
  console.log('🔮 MVE Predictor running...');
  const shipments = await getShipmentsByMVE(14);
  
  if (shipments.length === 0) {
    console.log('✅ No shipments at risk');
    return;
  }
  
  console.log(`📦 Analyzing ${shipments.length} shipments...`);
  
  for (const shipment of shipments.slice(0, 5)) { // Limit to 5 for speed
    const prediction = await predictMVERisk(shipment);
    console.log(`\n📊 ${shipment.trafico}:`);
    console.log(prediction.substring(0, 200));
  }
}

if (require.main === module) {
  run().catch(console.error);
}

module.exports = { predictMVERisk, getShipmentsByMVE };
