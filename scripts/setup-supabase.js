const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

// This script requires the SERVICE ROLE KEY (not anon key)
// to create tables and set up RLS policies
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function runSQL(label, sql) {
  try {
    const { error } = await supabase.rpc('exec_sql', { sql })
    if (error && !error.message.includes('already exists')) {
      console.log(`  ⚠️  ${label}: ${error.message}`)
    } else {
      console.log(`  ✅ ${label}`)
    }
  } catch (e) {
    console.log(`  ⚠️  ${label}: ${e.message}`)
  }
}

async function setupSupabase() {
  console.log('🗄️  Setting up Supabase tables and indexes...\n')

  // ── DOCUMENTS TABLE ──────────────────────────────────────
  console.log('── Documents Table')
  await runSQL('Create documents table', `
    CREATE TABLE IF NOT EXISTS documents (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      trafico_id VARCHAR(50),
      doc_type VARCHAR(50),
      doc_category VARCHAR(5),
      doc_name VARCHAR(200),
      source VARCHAR(50) DEFAULT 'manual',
      file_url VARCHAR(1000),
      file_path VARCHAR(500),
      classified_by VARCHAR(30),
      confidence DECIMAL(4,3),
      inserted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(trafico_id, doc_type)
    )
  `)

  await runSQL('Index documents by trafico_id', `
    CREATE INDEX IF NOT EXISTS idx_documents_trafico ON documents(trafico_id)
  `)

  await runSQL('Index documents by doc_type', `
    CREATE INDEX IF NOT EXISTS idx_documents_doc_type ON documents(doc_type)
  `)

  // ── TIPO CAMBIO HISTORY ──────────────────────────────────
  console.log('\n── Tipo de Cambio History')
  await runSQL('Create tipo_cambio_history table', `
    CREATE TABLE IF NOT EXISTS tipo_cambio_history (
      date DATE PRIMARY KEY,
      tc_fix DECIMAL(10,4),
      source VARCHAR(50) DEFAULT 'Banxico'
    )
  `)

  // ── TIPO CAMBIO ALERTS ───────────────────────────────────
  await runSQL('Create tipo_cambio_alerts table', `
    CREATE TABLE IF NOT EXISTS tipo_cambio_alerts (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      referencia VARCHAR(50),
      tc_pedimento DECIMAL(10,4),
      tc_banxico DECIMAL(10,4),
      deviation_pct DECIMAL(5,2),
      resolved BOOLEAN DEFAULT FALSE,
      detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `)

  // ── SYNC LOG ─────────────────────────────────────────────
  console.log('\n── Sync Log')
  await runSQL('Create sync_log table', `
    CREATE TABLE IF NOT EXISTS sync_log (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      sync_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      traficos_processed INTEGER DEFAULT 0,
      docs_inserted INTEGER DEFAULT 0,
      docs_updated INTEGER DEFAULT 0,
      duration_minutes DECIMAL(6,2),
      status VARCHAR(20) DEFAULT 'COMPLETE',
      error_message TEXT,
      globalpc_connected BOOLEAN DEFAULT FALSE
    )
  `)

  // ── APPROVED SUPPLIERS ───────────────────────────────────
  console.log('\n── Approved Suppliers')
  await runSQL('Create approved_suppliers table', `
    CREATE TABLE IF NOT EXISTS approved_suppliers (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      company_id VARCHAR(50) DEFAULT 'evco',
      proveedor VARCHAR(200) UNIQUE,
      country VARCHAR(50) DEFAULT 'USA',
      usmca_eligible BOOLEAN DEFAULT TRUE,
      approved_date DATE DEFAULT CURRENT_DATE,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `)

  // ── INDEXES ON EXISTING TABLES ───────────────────────────
  console.log('\n── Performance Indexes')
  const indexes = [
    ['idx_traficos_company',  'CREATE INDEX IF NOT EXISTS idx_traficos_company ON traficos(company_id)'],
    ['idx_traficos_estatus',  'CREATE INDEX IF NOT EXISTS idx_traficos_estatus ON traficos(estatus)'],
    ['idx_traficos_fecha',    'CREATE INDEX IF NOT EXISTS idx_traficos_fecha ON traficos(fecha_llegada DESC)'],
    ['idx_entradas_company',  'CREATE INDEX IF NOT EXISTS idx_entradas_company ON entradas(company_id)'],
    ['idx_entradas_fecha',    'CREATE INDEX IF NOT EXISTS idx_entradas_fecha ON entradas(fecha_llegada_mercancia DESC)'],
    ['idx_facturas_clave',    'CREATE INDEX IF NOT EXISTS idx_facturas_clave ON aduanet_facturas(clave_cliente)'],
    ['idx_facturas_fecha',    'CREATE INDEX IF NOT EXISTS idx_facturas_fecha ON aduanet_facturas(fecha_pago DESC)'],
    ['idx_facturas_prov',     'CREATE INDEX IF NOT EXISTS idx_facturas_proveedor ON aduanet_facturas(proveedor)'],
  ]

  for (const [label, sql] of indexes) {
    await runSQL(label, sql)
  }

  // ── EXPEDIENTE COMPLETENESS VIEW ─────────────────────────
  console.log('\n── Expediente Completeness View')
  await runSQL('Create expediente_completeness view', `
    CREATE OR REPLACE VIEW expediente_completeness AS
    SELECT
      t.trafico,
      t.company_id,
      t.estatus,
      t.fecha_llegada,
      COALESCE(d.doc_count, 0) as doc_count,
      ROUND((COALESCE(d.doc_count, 0)::decimal / 61) * 100, 1) as pct_complete,
      61 - COALESCE(d.doc_count, 0) as docs_missing,
      CASE
        WHEN COALESCE(d.doc_count, 0) >= 49 THEN 'COMPLETO'
        WHEN COALESCE(d.doc_count, 0) >= 31 THEN 'INCOMPLETO'
        ELSE 'CRITICO'
      END as tier
    FROM traficos t
    LEFT JOIN (
      SELECT trafico_id, COUNT(*) as doc_count
      FROM documents
      GROUP BY trafico_id
    ) d ON d.trafico_id = t.trafico
    WHERE t.company_id = 'evco'
  `)

  // ── FINAL CHECK ──────────────────────────────────────────
  console.log('\n── Final Table Check')
  const tables = ['documents','tipo_cambio_history','tipo_cambio_alerts','sync_log','approved_suppliers']
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table).select('*', { count: 'exact', head: true })
    if (error) console.log(`  ❌ ${table}: ${error.message}`)
    else console.log(`  ✅ ${table} (${count || 0} rows)`)
  }

  console.log('\n✅ Supabase setup complete')
}

setupSupabase().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
