#!/usr/bin/env node
/**
 * Supplier Negotiator — Automated supplier communication
 * Uses Qwen to draft and send emails to suppliers about missing documents
 */

const { callQwen } = require('./qwen-client');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: __dirname + '/../../.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getMissingDocs() {
  const { data } = await supabase
    .from('expediente_documentos')
    .select('*, traficos(proveedor_nombre, trafico)')
    .eq('completitud_pct', 0)
    .lt('fecha_limite', new Date().toISOString())
    .limit(20);
  
  return data || [];
}

async function sendEmail(to, subject, body) {
  console.log(`📧 Would send email to ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body: ${body.substring(0, 200)}...`);
  // TODO: Integrate with actual email sending
}

async function negotiateWithSupplier(supplier, issue, history) {
  const prompt = `
Eres un negociador aduanal experto. Tienes que contactar a ${supplier} sobre:
Problema: ${issue}

Historial de interacciones previas:
${history || 'Sin historial previo'}

Escribe un email profesional pero firme que:
1. Exprese claramente el problema
2. Cite consecuencias (retención de carga, multas)
3. Ofrezca una solución específica
4. Establezca una fecha límite
5. Mantenga la relación comercial

Idioma: Español. Tono: Profesional pero urgente.
  `;
  
  const email = await callQwen(prompt, { temperature: 0.6 });
  return email;
}

async function processPendingDocs() {
  console.log('🔄 Checking pending documents...');
  const pendingDocs = await getMissingDocs();
  
  if (pendingDocs.length === 0) {
    console.log('✅ No pending documents');
    return;
  }
  
  console.log(`📄 Found ${pendingDocs.length} pending documents`);
  
  for (const doc of pendingDocs) {
    const supplier = doc.traficos?.proveedor_nombre || 'Proveedor';
    const issue = `Documento ${doc.doc_type} faltante para tráfico ${doc.trafico_id}`;
    
    console.log(`  Negotiating with ${supplier}...`);
    const email = await negotiateWithSupplier(supplier, issue, '');
    
    // Send email (commented out for safety)
    // await sendEmail(supplier, `Documentos requeridos - ${doc.trafico_id}`, email);
    
    console.log(`  ✅ Draft generated for ${supplier}`);
  }
}

// Run if called directly
if (require.main === module) {
  processPendingDocs().catch(console.error);
}

module.exports = { negotiateWithSupplier, processPendingDocs };
