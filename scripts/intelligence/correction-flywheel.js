#!/usr/bin/env node
const { callQwen } = require('./qwen-client-with-confidence');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function recordCorrection(moduleName, original, corrected, context) {
  const correction = {
    module_name: moduleName,
    original_output: original,
    corrected_output: corrected,
    context: context,
    corrected_by: 'tito',
    created_at: new Date().toISOString()
  };
  
  await supabase.from('corrections').insert(correction);
  console.log(`📝 Correction recorded for ${moduleName}`);
  return correction;
}

async function improvePromptFromCorrections() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const { data: corrections } = await supabase
    .from('corrections')
    .select('*')
    .gte('created_at', yesterday.toISOString());
  
  if (!corrections?.length) {
    console.log('No corrections in last 24 hours');
    return;
  }
  
  console.log(`📚 Analyzing ${corrections.length} corrections...`);
  
  for (const correction of corrections) {
    const prompt = `
Analiza esta corrección para el módulo ${correction.module_name}:

ORIGINAL: ${JSON.stringify(correction.original_output)}
CORREGIDO: ${JSON.stringify(correction.corrected_output)}
CONTEXTO: ${JSON.stringify(correction.context)}

Genera una mejora al prompt para evitar este error en el futuro.
    `;
    
    const { output: improvement } = await callQwen(prompt, { requireConfidence: false });
    console.log(`✅ Improvement generated for ${correction.module_name}`);
  }
}

if (require.main === module) {
  improvePromptFromCorrections().catch(console.error);
}

module.exports = { recordCorrection, improvePromptFromCorrections };
