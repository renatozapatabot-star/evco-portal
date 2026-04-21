const { callQwen } = require('./qwen-client-v2');

async function test() {
  console.log('Testing MVE Predictor directly...\n');
  
  const prompt = `Evalúa riesgo MVE para tráfico 9254-Y4466:
- Documentos: incompletos
- Proveedor: RR Donnelley

Reglas:
- Si documentos están INCOMPLETOS → ALTO
- Si documentos están COMPLETOS → BAJO  
- Si documentos están PARCIALES → MEDIO

Responde SOLO con: ALTO, MEDIO, o BAJO`;

  const result = await callQwen(prompt, { module: 'mve-predictor', maxTokens: 30 });
  console.log('Result:', result.output);
  console.log('Latency:', result.latencyMs, 'ms');
}

test();
