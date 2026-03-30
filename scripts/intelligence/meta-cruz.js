#!/usr/bin/env node
const { callQwen } = require('./qwen-client');

async function metaCrux() {
  console.log('🧠 META-CRUX Running...');
  
  const result = await callQwen('Eres CRUZ. Genera un resumen de estado operativo para hoy. Todo en orden. Máximo 100 palabras.');
  
  console.log('\n📊 CRUZ Intelligence Report:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(result);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  return result;
}

if (require.main === module) {
  metaCrux().catch(console.error);
}

module.exports = { metaCrux };
