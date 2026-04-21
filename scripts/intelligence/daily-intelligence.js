#!/usr/bin/env node
const { callQwen } = require('./qwen-client');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LOG_FILE = '/tmp/cruz-intelligence.log';

function log(msg) {
  const ts = new Date().toLocaleString('es-MX', { timeZone: 'America/Chicago' });
  const line = `[${ts}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

async function fetchNewData() {
  log('📊 Fetching new data from last 24 hours...');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const { data: traficos } = await supabase
    .from('traficos')
    .select('*')
    .eq('clave_cliente', '9254')
    .gte('created_at', yesterday.toISOString());
  
  const { data: docs } = await supabase
    .from('expediente_documentos')
    .select('*')
    .gte('created_at', yesterday.toISOString());
  
  return {
    traficos: traficos || [],
    docs: docs || [],
    counts: { traficos: traficos?.length || 0, docs: docs?.length || 0 }
  };
}

async function analyzePatterns(data) {
  log('🧠 Analyzing patterns...');
  const prompt = `Analiza: ${data.counts.traficos} tráficos nuevos, ${data.counts.docs} documentos nuevos. ¿Anomalías? ¿Recomendaciones? Responde en español, 100 palabras máximo.`;
  return await callQwen(prompt, { temperature: 0.3 });
}

async function predictRisks() {
  log('⚠️ Predicting risks...');
  const { data: active } = await supabase
    .from('traficos')
    .select('trafico, fecha_llegada')
    .eq('clave_cliente', '9254')
    .not('estatus', 'ilike', '%cruzado%')
    .limit(20);
  
  if (!active?.length) return 'Sin tráficos activos.';
  
  const prompt = `Evalúa riesgo MVE para: ${active.slice(0, 10).map(t => t.trafico).join(', ')}. Identifica los 3 con mayor riesgo. Español, breve.`;
  return await callQwen(prompt, { temperature: 0.4 });
}

async function draftMorningReport(analysis, risks) {
  log('📝 Drafting morning report...');
  const prompt = `Eres CRUZ. Reporte para Tito:

ANÁLISIS: ${analysis.substring(0, 300)}
RIESGOS: ${risks.substring(0, 300)}

Formato:
📊 CRUZ — [fecha]
1. Resumen (2 líneas)
2. Atención hoy (lista)
Corto, español.`;
  return await callQwen(prompt, { temperature: 0.6 });
}

async function run() {
  log('🚀 CRUZ Intelligence Started');
  try {
    const data = await fetchNewData();
    log(`📊 New: ${data.counts.traficos} tráficos, ${data.counts.docs} docs`);
    const analysis = await analyzePatterns(data);
    const risks = await predictRisks();
    const report = await draftMorningReport(analysis, risks);
    
    console.log('\n' + '='.repeat(50));
    console.log(report);
    console.log('='.repeat(50));
    log('✅ Done');
  } catch (error) {
    log(`❌ Error: ${error.message}`);
  }
}

if (require.main === module) run();
module.exports = { run };
