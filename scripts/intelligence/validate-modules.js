#!/usr/bin/env node
const { callQwen } = require('./qwen-client-v2');

const TEST_CASES = {
  'mve-predictor': [
    { input: 'Tráfico 9254-Y4466, documentos incompletos. ¿Riesgo MVE? Responde SOLO: ALTO/MEDIO/BAJO', expected: 'ALTO' },
    { input: 'Tráfico 9254-Y4472, documentos completos. ¿Riesgo MVE? Responde SOLO: ALTO/MEDIO/BAJO', expected: 'BAJO' },
    { input: 'Tráfico 9254-Y4480, documentos parciales. ¿Riesgo MVE? Responde SOLO: ALTO/MEDIO/BAJO', expected: 'MEDIO' }
  ],
  'border-intel': [
    { input: 'WTC:45min, Colombia:30min. ¿Menor espera? Responde SOLO: Colombia o WTC', expected: 'Colombia' },
    { input: 'WTC:60min, Colombia:90min. ¿Menor espera? Responde SOLO: Colombia o WTC', expected: 'WTC' },
    { input: 'Gateway:20min, Colombia:35min. ¿Menor espera? Responde SOLO: Gateway o Colombia', expected: 'Gateway' }
  ]
};

async function validateModule(moduleName, testCases) {
  console.log(`\n🔍 Validating ${moduleName} (${testCases.length} test cases)`);
  console.log('═'.repeat(50));
  
  let correct = 0;
  
  for (const test of testCases) {
    const result = await callQwen(test.input, { module: moduleName, maxTokens: 50 });
    const isCorrect = result.output.toUpperCase().includes(test.expected.toUpperCase());
    if (isCorrect) correct++;
    
    console.log(`  ${isCorrect ? '✅' : '❌'} ${test.input.substring(0, 50)}...`);
    console.log(`     → Got: "${result.output}" | Expected: ${test.expected} | ${result.latencyMs}ms`);
  }
  
  const accuracy = Math.round((correct / testCases.length) * 100);
  console.log(`\n📊 ${moduleName} Accuracy: ${accuracy}% (${correct}/${testCases.length})`);
  return { moduleName, accuracy };
}

async function run() {
  console.log('🧪 CRUZ Module Validation Suite');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Date: ${new Date().toLocaleString('es-MX')}\n`);
  
  const results = [];
  
  for (const [module, tests] of Object.entries(TEST_CASES)) {
    const result = await validateModule(module, tests);
    results.push(result);
  }
  
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('📈 VALIDATION SUMMARY');
  console.log('════════════════════════════════════════════════════════════');
  
  for (const r of results) {
    console.log(`  ${r.moduleName}: ${r.accuracy}%`);
  }
  
  const avg = results.reduce((sum, r) => sum + r.accuracy, 0) / results.length;
  console.log(`\n🎯 OVERALL: ${Math.round(avg)}%`);
}

run().catch(console.error);
