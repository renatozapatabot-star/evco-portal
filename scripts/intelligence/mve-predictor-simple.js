#!/usr/bin/env node
/**
 * Simple MVE Predictor - Rules-based fallback
 */

async function predictMVERisk(traficoId, documentos, proveedor) {
  // Simple rules-based logic
  const docsLower = documentos.toLowerCase();
  
  if (docsLower.includes('incompleto')) {
    return 'ALTO';
  } else if (docsLower.includes('parcial')) {
    return 'MEDIO';
  } else if (docsLower.includes('completo')) {
    return 'BAJO';
  }
  
  // Default
  return 'MEDIO';
}

async function test() {
  console.log('Testing Simple MVE Predictor:');
  console.log('1. Documentos incompletos:', await predictMVERisk('9254-Y4466', 'incompletos', 'RR Donnelley'));
  console.log('2. Documentos completos:', await predictMVERisk('9254-Y4472', 'completos', 'Monroe'));
  console.log('3. Documentos parciales:', await predictMVERisk('9254-Y4480', 'parciales', 'Duratech'));
}

if (require.main === module) test();
module.exports = { predictMVERisk };
