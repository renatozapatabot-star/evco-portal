#!/usr/bin/env node
const { callQwenFast, callQwenSmart } = require('./qwen-fast');

async function run() {
  console.log('⚡ ULTRA-FAST VALIDATION\n');
  
  // Test 1: MVE Risk with 8B model
  console.log('📝 MVE Risk (8B model)...');
  const start1 = Date.now();
  const r1 = await callQwenFast('Trafico 9254-Y4466, documentos incompletos. Riesgo MVE? Responde ALTO/MEDIO/BAJO');
  console.log(`   Output: ${r1.output}`);
  console.log(`   Latency: ${r1.latencyMs}ms\n`);
  
  // Test 2: Border Intel with 8B model
  console.log('📝 Border Intel (8B model)...');
  const start2 = Date.now();
  const r2 = await callQwenFast('Puentes Laredo: World Trade, Colombia, Gateway, Juárez-Lincoln. WTC:45min, Colombia:30min. ¿Qué puente? Responde solo el nombre.');
  console.log(`   Output: ${r2.output}`);
  console.log(`   Latency: ${r2.latencyMs}ms\n`);
  
  // Test 3: Complex with 32B model
  console.log('📝 Complex Analysis (32B model)...');
  const start3 = Date.now();
  const r3 = await callQwenSmart('Analiza: RR Donnelley siempre falta COVE. Recomienda acción en una línea.');
  console.log(`   Output: ${r3.output.substring(0, 100)}`);
  console.log(`   Latency: ${r3.latencyMs}ms\n`);
}

run().catch(console.error);
