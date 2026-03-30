const { createClient } = require('@supabase/supabase-js')
const mysql = require('mysql2/promise')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const COMPANY_ID = 'evco'

function fmtNum(n) { return Number(n || 0).toLocaleString('es-MX') }

async function sendTelegram(message) {
  if (!TELEGRAM_TOKEN) { console.log(message); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
  })
}

async function run() {
  console.log('🕸️  Client Relationship Intelligence — Starting...\n')

  let conn
  try {
    conn = await mysql.createConnection({
      host: process.env.GLOBALPC_DB_HOST,
      port: Number(process.env.GLOBALPC_DB_PORT),
      user: process.env.GLOBALPC_DB_USER,
      password: process.env.GLOBALPC_DB_PASS,
      database: 'bd_demo_38',
      connectTimeout: 15000,
    })
    console.log('✅ MySQL connected\n')
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message)
    return
  }

  try {
    // Query client records
    const [clients] = await conn.query(`
      SELECT
        c.cve_cliente,
        c.nombre,
        c.rfc,
        c.direccion,
        c.ciudad,
        c.estado,
        c.pais
      FROM cu_cliente c
    `)
    console.log(`👥 Clients: ${fmtNum(clients.length)}`)

    // Query client-supplier-product relationships
    const [relationships] = await conn.query(`
      SELECT
        cpp.cve_cliente,
        cpp.cve_proveedor,
        cpp.descripcion_producto,
        cpp.fraccion,
        cpp.unidad_medida,
        cpp.pais_origen
      FROM cu_cliente_proveedor_producto cpp
    `)
    console.log(`🔗 Client-Supplier-Product relationships: ${fmtNum(relationships.length)}`)

    // Query supplier list
    const [suppliers] = await conn.query(`
      SELECT DISTINCT
        f.proveedor,
        COUNT(*) as operation_count,
        SUM(f.valor_total) as total_value,
        MIN(f.fecha) as first_operation,
        MAX(f.fecha) as last_operation
      FROM cb_factura f
      WHERE f.proveedor IS NOT NULL AND f.proveedor != ''
      GROUP BY f.proveedor
      ORDER BY operation_count DESC
    `)
    console.log(`🏭 Active suppliers: ${fmtNum(suppliers.length)}\n`)

    // Build supplier profiles
    const supplierProfiles = {}
    suppliers.forEach(s => {
      supplierProfiles[s.proveedor] = {
        name: s.proveedor,
        operations: Number(s.operation_count) || 0,
        totalValue: Number(s.total_value) || 0,
        firstOp: s.first_operation,
        lastOp: s.last_operation,
        products: new Set(),
        fracciones: new Set(),
      }
    })

    // Map products to suppliers
    relationships.forEach(r => {
      const sp = Object.values(supplierProfiles).find(
        s => s.name && r.cve_proveedor && s.name.toLowerCase().includes(r.cve_proveedor.toString().toLowerCase())
      )
      if (sp) {
        if (r.descripcion_producto) sp.products.add(r.descripcion_producto)
        if (r.fraccion) sp.fracciones.add(r.fraccion)
      }
    })

    // Reliability scoring
    const scored = Object.values(supplierProfiles).map(s => {
      let score = 50 // Base score

      // Volume bonus (more operations = more reliable)
      if (s.operations >= 50) score += 20
      else if (s.operations >= 20) score += 15
      else if (s.operations >= 10) score += 10
      else if (s.operations >= 5) score += 5

      // Recency bonus
      if (s.lastOp) {
        const daysSince = (Date.now() - new Date(s.lastOp).getTime()) / 86400000
        if (daysSince < 30) score += 15
        else if (daysSince < 90) score += 10
        else if (daysSince < 180) score += 5
        else score -= 10 // Inactive penalty
      }

      // Longevity bonus
      if (s.firstOp && s.lastOp) {
        const monthsActive = (new Date(s.lastOp) - new Date(s.firstOp)) / (86400000 * 30)
        if (monthsActive > 24) score += 10
        else if (monthsActive > 12) score += 5
      }

      // Product diversity bonus
      if (s.products.size > 5) score += 5

      return {
        ...s,
        products: Array.from(s.products),
        fracciones: Array.from(s.fracciones),
        reliabilityScore: Math.max(0, Math.min(100, score)),
        tier: score >= 80 ? 'gold' : score >= 60 ? 'silver' : score >= 40 ? 'bronze' : 'watch',
      }
    })

    // Single-source risk detection
    const productSupplierMap = {}
    relationships.forEach(r => {
      if (!r.descripcion_producto) return
      const key = r.descripcion_producto.toLowerCase().trim()
      if (!productSupplierMap[key]) productSupplierMap[key] = new Set()
      if (r.cve_proveedor) productSupplierMap[key].add(String(r.cve_proveedor))
    })

    const singleSourceRisks = Object.entries(productSupplierMap)
      .filter(([, suppliers]) => suppliers.size === 1)
      .map(([product, suppliers]) => ({
        product,
        supplier: Array.from(suppliers)[0],
      }))

    console.log(`⚠️  Single-source risks: ${singleSourceRisks.length} products with only 1 supplier\n`)

    // Save supplier profiles to Supabase (update supplier_contacts)
    const updates = scored.filter(s => s.name).map(s => ({
      proveedor: s.name,
      company_id: COMPANY_ID,
      operation_count: s.operations,
      total_value: s.totalValue,
      first_operation: s.firstOp ? new Date(s.firstOp).toISOString().split('T')[0] : null,
      last_operation: s.lastOp ? new Date(s.lastOp).toISOString().split('T')[0] : null,
      product_count: s.products.length,
      reliability_score: s.reliabilityScore,
      tier: s.tier,
      updated_at: new Date().toISOString(),
    }))

    const BATCH = 200
    let saved = 0
    for (let i = 0; i < updates.length; i += BATCH) {
      const batch = updates.slice(i, i + BATCH)
      const { error } = await supabase.from('supplier_contacts').upsert(batch, {
        onConflict: 'proveedor,company_id',
        ignoreDuplicates: false,
      })
      if (error) {
        console.error(`Batch error:`, error.message)
      } else {
        saved += batch.length
      }
    }
    console.log(`✅ Updated ${fmtNum(saved)} supplier profiles\n`)

    // Save single-source risks to compliance_predictions
    if (singleSourceRisks.length > 0) {
      const riskRecords = singleSourceRisks.slice(0, 50).map(r => ({
        prediction_type: 'supply_chain_risk',
        entity_id: r.product.substring(0, 100),
        description: `Producto "${r.product.substring(0, 80)}" tiene un solo proveedor: ${r.supplier}`,
        risk_level: 'medium',
        confidence: 0.85,
        company_id: COMPANY_ID,
        created_at: new Date().toISOString(),
      }))

      const { error } = await supabase.from('compliance_predictions').upsert(riskRecords, {
        onConflict: 'prediction_type,entity_id',
        ignoreDuplicates: false,
      })
      if (error) console.error('Compliance predictions error:', error.message)
      else console.log(`⚠️  ${riskRecords.length} supply chain risks saved`)
    }

    // Build D3 network data for portal
    const networkData = {
      nodes: [
        { id: 'evco', label: 'EVCO Plastics', type: 'client', size: 100 },
        ...scored.filter(s => s.operations >= 3).slice(0, 40).map(s => ({
          id: s.name,
          label: s.name.substring(0, 30),
          type: 'supplier',
          size: Math.max(10, Math.min(60, s.operations)),
          tier: s.tier,
          score: s.reliabilityScore,
        })),
      ],
      links: scored.filter(s => s.operations >= 3).slice(0, 40).map(s => ({
        source: 'evco',
        target: s.name,
        value: s.operations,
        products: s.products.slice(0, 5),
      })),
      metadata: {
        totalSuppliers: suppliers.length,
        totalRelationships: relationships.length,
        singleSourceRisks: singleSourceRisks.length,
        generated: new Date().toISOString(),
      },
    }

    // Save network data to Supabase for portal
    const { error: netError } = await supabase.from('compliance_predictions').upsert({
      prediction_type: 'supplier_network',
      entity_id: 'network_graph_data',
      description: JSON.stringify(networkData),
      risk_level: 'info',
      confidence: 1,
      company_id: COMPANY_ID,
      created_at: new Date().toISOString(),
    }, { onConflict: 'prediction_type,entity_id' })

    if (netError) console.error('Network data error:', netError.message)
    else console.log(`🕸️  Network graph data saved (${networkData.nodes.length} nodes, ${networkData.links.length} links)`)

    // Summary
    const tiers = { gold: 0, silver: 0, bronze: 0, watch: 0 }
    scored.forEach(s => { tiers[s.tier] = (tiers[s.tier] || 0) + 1 })

    console.log(`\n📊 Supplier Tiers:`)
    console.log(`   🥇 Gold: ${tiers.gold}`)
    console.log(`   🥈 Silver: ${tiers.silver}`)
    console.log(`   🥉 Bronze: ${tiers.bronze}`)
    console.log(`   👀 Watch: ${tiers.watch}`)

    await sendTelegram(
      `🕸️ <b>Client Intelligence — Complete</b>\n\n` +
      `Suppliers profiled: ${fmtNum(scored.length)}\n` +
      `🥇 Gold: ${tiers.gold} | 🥈 Silver: ${tiers.silver}\n` +
      `🥉 Bronze: ${tiers.bronze} | 👀 Watch: ${tiers.watch}\n\n` +
      `Single-source risks: ${singleSourceRisks.length}\n` +
      `Network nodes: ${networkData.nodes.length}\n\n` +
      `CRUZ 🦀`
    )

    console.log('\n✅ Client Relationship Intelligence — Complete')

  } catch (err) {
    console.error('❌ Error:', err.message)
    await sendTelegram(`❌ Client Intelligence failed: ${err.message}`)
  } finally {
    if (conn) await conn.end()
  }
}

run()
