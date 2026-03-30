#!/usr/bin/env node
const { callQwen } = require('./qwen-client-with-confidence');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: __dirname + '/../../.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEST_CASES = {
  'mve-predictor': [
    { input: 'Trafico 9254-Y4466, llegada 20 mar, proveedor RR Donnelley', expected: 'alto riesgo' },
    { input: 'Trafico 9254-Y4472, llegada 25 mar, proveedor Monroe', expected: 'bajo riesgo' }
  ],
  'border-intel': [
    { input: 'WTC: 45 min, Colombia: 30 min', expected: 'Colombia' }
  ]
};

async function validateModule(moduleName, testCases) {
  console.log(`\n🔍 Validating ${moduleName}...`);
  console.log('═'.repeat(50));
  
  let correct = 0;
  
  for (const test of testCases) {
    const { output, confidence, latencyMs } = await callQwen(
      `Eres ${moduleName}. Analiza: ${test.input}`,
      { requireConfidence: true }
    );
    
    const isCorrect = output.toLowerCase().includes(test.expected.toLowerCase());
    if (isCorrect) correct++;
    
    console.log(`  ${isCorrect ? '✅' : '❌'} ${test.input.substring(0, 50)}...`);
    console.log(`     Confidence: ${Math.round(confidence * 100)}% | Latency: ${latencyMs}ms`);
  }
  
  const accuracy = correct / testCases.length;
  console.log(`\n📊 ${moduleName} Accuracy: ${Math.round(accuracy * 100)}%`);
  
  return { moduleName, accuracy, correct, total: testCases.length };
}

async function run() {
  console.log('🧪 CRUZ Module Validation Suite');
  console.log('═══════════════════════════════════════════════════════');
  
  const results = [];
  
  for (const [module, tests] of Object.entries(TEST_CASES)) {
    const result = await validateModule(module, tests);
    results.push(result);
  }
  
  console.log('\n📈 SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  for (const r of results) {
    console.log(`${r.moduleName}: ${Math.round(r.accuracy * 100)}% (${r.correct}/${r.total})`);
  }
}

run().catch(console.error);
