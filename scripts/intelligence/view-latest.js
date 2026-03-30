#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function viewLatest() {
  const { data } = await supabase
    .from('intelligence_logs')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(1);
  
  if (!data?.length) {
    console.log('No intelligence data yet. Run daily-intelligence.js first.');
    return;
  }
  
  const intel = data[0];
  console.log('='.repeat(50));
  console.log(`📊 CRUZ — ${new Date(intel.generated_at).toLocaleString('es-MX')}`);
  console.log('='.repeat(50));
  console.log('\n📈 ANALYSIS:\n', intel.analysis);
  console.log('\n⚠️ RISKS:\n', intel.risks);
  console.log('\n📋 REPORT:\n', intel.morning_report);
}

viewLatest();
