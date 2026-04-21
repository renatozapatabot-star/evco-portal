#!/usr/bin/env node
const { callQwen } = require('./qwen-client-v2');

async function predictMVERisk(traficoId, documentos, proveedor) {
  const prompt = `Evalúa riesgo MVE para tráfico ${traficoId}:
- Documentos: ${documentos}
- Proveedor: ${proveedor}

Reglas:
- Si documentos están INCOMPLETOS → ALTO
- Si documentos están COMPLETOS → BAJO  
- Si documentos están PARCIALES → MEDIO

Responde SOLO con: ALTO, MEDIO, o BAJO`;

  const result = await callQwen(prompt, { module: 'mve-predictor', maxTokens: 20 });
  return result.output;
}

// Test
async function test() {
  console.log('Testing MVE Predictor:');
  console.log('1. Documentos incompletos:', await predictMVERisk('9254-Y4466', 'incompletos', 'RR Donnelley'));
  console.log('2. Documentos completos:', await predictMVERisk('9254-Y4472', 'completos', 'Monroe'));
  console.log('3. Documentos parciales:', await predictMVERisk('9254-Y4480', 'parciales', 'Duratech'));
}

if (require.main === module) test();
module.exports = { predictMVERisk };
