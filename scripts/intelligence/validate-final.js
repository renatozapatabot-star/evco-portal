#!/usr/bin/env node
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'qwen3:32b';

async function call(prompt, maxTokens = 50) {
  const start = Date.now();
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt: prompt,
      stream: false,
      options: { temperature: 0, num_predict: maxTokens }
    })
  });
  const data = await res.json();
  return { output: data.response, latency: Date.now() - start };
}

async function run() {
  console.log('⚡ CRUZ VALIDATION (32B model)\n');
  
  console.log('📝 MVE Risk Test...');
  const r1 = await call('Trafico 9254-Y4466, documentos incompletos. Riesgo MVE? Responde SOLO: ALTO/MEDIO/BAJO', 20);
  console.log(`   Output: ${r1.output}`);
  console.log(`   Latency: ${r1.latency}ms\n`);
  
  console.log('📝 Border Intel Test...');
  const r2 = await call('Puentes Laredo: World Trade, Colombia, Gateway, Juárez-Lincoln. WTC:45min, Colombia:30min. ¿Qué puente? Responde solo el nombre.', 30);
  console.log(`   Output: ${r2.output}`);
  console.log(`   Latency: ${r2.latency}ms\n`);
  
  console.log('📝 Complex Analysis Test...');
  const r3 = await call('Analiza: RR Donnelley siempre falta COVE. Recomienda acción en una línea.', 150);
  console.log(`   Output: ${r3.output.substring(0, 100)}`);
  console.log(`   Latency: ${r3.latency}ms\n`);
}

run().catch(console.error);
