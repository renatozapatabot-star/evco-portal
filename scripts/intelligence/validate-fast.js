#!/usr/bin/env node
const { callQwen } = require('./qwen-client-with-confidence');

const TEST_CASES = [
  { name: 'MVE High Risk', prompt: 'Trafico 9254-Y4466, llegada 20 mar, proveedor RR Donnelley, documentos incompletos. ¿Riesgo MVE? Responde ALTO/MEDIO/BAJO' },
  { name: 'MVE Low Risk', prompt: 'Trafico 9254-Y4472, llegada 25 mar, proveedor Monroe, documentos completos. ¿Riesgo MVE? Responde ALTO/MEDIO/BAJO' },
  { name: 'Border Intel', prompt: 'WTC: 45 min, Colombia: 30 min. ¿Qué puente recomiendas? Responde con el nombre.' }
];

async function run() {
  console.log('🧪 Fast Validation\n');
  
  for (const test of TEST_CASES) {
    console.log(`📝 ${test.name}...`);
    const start = Date.now();
    const { output, confidence, latencyMs } = await callQwen(test.prompt, { requireConfidence: true });
    console.log(`   Output: ${output.substring(0, 100)}`);
    console.log(`   Confidence: ${Math.round(confidence * 100)}%`);
    console.log(`   Latency: ${latencyMs}ms\n`);
  }
}

run().catch(console.error);
