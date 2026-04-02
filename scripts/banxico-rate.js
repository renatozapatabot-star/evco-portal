require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

async function updateRate() {
  const token = process.env.BANXICO_TOKEN;
  if (!token) { console.error('❌ BANXICO_TOKEN missing'); process.exit(1); }

  const res = await fetch('https://www.banxico.org.mx/SieAPIRest/service/v1/series/SF43718/datos/oportuno', {
    headers: { 'Bmx-Token': token }
  });
  const data = await res.json();
  const serie = data.bmx.series[0].datos[0];
  
  // Parse dd/mm/yyyy to yyyy-mm-dd
  const [d, m, y] = serie.fecha.split('/');
  const isoDate = `${y}-${m}-${d}`;
  const rate = parseFloat(serie.dato);

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { error } = await sb.from('system_config').update({
    value: { date: isoDate, rate, source: 'banxico' },
    valid_from: isoDate,
    updated_at: new Date().toISOString()
  }).eq('key', 'banxico_exchange_rate');

  if (error) {
    console.error('❌ Supabase update failed:', error.message);
    process.exit(1);
  }

  console.log(`✅ Exchange rate: ${rate} MXN/USD (${isoDate})`);
  process.exit(0);
}

updateRate().catch(e => { console.error('❌', e.message); process.exit(1); });
