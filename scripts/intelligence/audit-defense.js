#!/usr/bin/env node
/**
 * Audit Defense — Predicts SAT audit risks
 */

const { callQwen } = require('./qwen-client');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: __dirname + '/../../.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditRiskScore(pedimento) {
  const prompt = `
Eres un especialista en auditoría aduanal. Analiza este pedimento:

Pedimento: ${pedimento.numero || pedimento.id}
Fracción: ${pedimento.fraccion || 'No especificada'}
Valor: ${pedimento.valor_usd || 0} USD
Proveedor: ${pedimento.proveedor || 'Desconocido'}
Documentos: ${pedimento.documentos || 'No especificados'}

Calcula el riesgo de auditoría (1-100) basado en:
1. Historial del proveedor (red flags)
2. Consistencia de la fracción arancelaria
3. Documentación faltante
4. Valoración comparativa

Responde en formato JSON con:
- risk_score: número
- risk_factors: lista de strings
- recommended_actions: lista de strings
- documents_to_secure: lista de strings
  `;
  
  const result = await callQwen(prompt, { temperature: 0.3 });
  
  // Parse JSON from response
  try {
    const match = result.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
  } catch (e) {
    console.error('Failed to parse JSON:', e);
  }
  
  return { risk_score: 50, risk_factors: ['No se pudo analizar'], recommended_actions: ['Revisar manualmente'] };
}

async function scanRecentPedimentos() {
  const { data: pedimentos } = await supabase
    .from('pedimentos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (!pedimentos?.length) {
    console.log('No pedimentos found');
    return;
  }
  
  for (const pedimento of pedimentos) {
    const risk = await auditRiskScore(pedimento);
    if (risk.risk_score > 80) {
      console.log(`🚨 HIGH RISK: ${pedimento.numero} - Score: ${risk.risk_score}`);
      console.log(`   Factors: ${risk.risk_factors?.join(', ')}`);
    } else {
      console.log(`✅ ${pedimento.numero}: Risk ${risk.risk_score}`);
    }
  }
}

if (require.main === module) {
  scanRecentPedimentos().catch(console.error);
}

module.exports = { auditRiskScore, scanRecentPedimentos };
