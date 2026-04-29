const { createClient } = require('@supabase/supabase-js')
const mysql = require('mysql2/promise')
const soap = require('soap')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })
const { fetchAll } = require('./lib/paginate')
const { withSyncLog } = require('./lib/sync-log')
const { sendTelegram } = require('./lib/telegram')
const { translateEstatus } = require('./lib/translate-estatus')

// ─── Config ───
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
// Fallback tenant_id for companies without one in the DB (legacy EVCO rows).
// Single source of truth: scripts/lib/tenant-fallback.js. The Block EE
// ratchet counts declarations of this constant; importing keeps the count
// at 1 even when other scripts (e.g. full-sync-econta) need the value.
const { FALLBACK_TENANT_ID } = require('./lib/tenant-fallback')
const BATCH = 500
const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const OLLAMA_MODEL = 'qwen3:8b'
const timeoutTracker = {} // track retries per product
const OLLAMA_BATCH = 50
const CHECKPOINT_DIR = path.join(__dirname, '.sync-checkpoints')

// ─── Helpers ───
if (!fs.existsSync(CHECKPOINT_DIR)) fs.mkdirSync(CHECKPOINT_DIR, { recursive: true })

// Normalize legacy MXP (peso pre-1993 redenomination) to MXN.
//
// GlobalPC's MySQL has stale MXP literals in cb_factura, factura_aa,
// cl_cartera, ba_ingresos, ba_egresos, and ba_anticipos — all with
// post-1993 fechas. Without normalization the sync writes 39,895
// rows across 6 Supabase tables labeled with a deprecated ISO code.
// MXP and MXN are the same currency unit since 1993; the ISO 4217
// code rotation just made `MXP` retired. Every other code (USD/EUR/
// CAD/JPY/etc.) passes through unchanged. NULL stays NULL — we don't
// invent a label we can't justify.
function normalizeMoneda(m) {
  if (m == null) return m;
  const upper = String(m).trim().toUpperCase();
  if (upper === '') return null;
  if (upper === 'MXP') return 'MXN';
  return upper;
}

function loadCP(name) {
  const f = path.join(CHECKPOINT_DIR, name + '.json')
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'))
  return { offset: 0, synced: 0 }
}
function saveCP(name, data) {
  fs.writeFileSync(path.join(CHECKPOINT_DIR, name + '.json'), JSON.stringify(data))
}
function clearCP(name) {
  const f = path.join(CHECKPOINT_DIR, name + '.json')
  if (fs.existsSync(f)) fs.unlinkSync(f)
}

async function getMySQLTrafico() {
  return mysql.createConnection({
    host: process.env.GLOBALPC_DB_HOST,
    port: Number(process.env.GLOBALPC_DB_PORT),
    user: process.env.GLOBALPC_DB_USER,
    password: process.env.GLOBALPC_DB_PASS,
    database: 'bd_demo_38',
    connectTimeout: 15000,
  })
}

async function getMySQLeConta() {
  return mysql.createConnection({
    host: process.env.GLOBALPC_ECONTA_HOST,
    port: Number(process.env.GLOBALPC_ECONTA_PORT),
    user: process.env.GLOBALPC_ECONTA_USER,
    password: process.env.GLOBALPC_ECONTA_PASS,
    database: 'bd_econta_rz',
    connectTimeout: 15000,
  })
}

// Generic batch sync: pull from MySQL, upsert to Supabase
async function syncTable({ name, db, query, table, mapRow, conflictCol, countQuery }) {
  console.log(`\n📦 Syncing ${name}...`)
  const cp = loadCP(name)

  const [[{ total }]] = await db.query(countQuery)
  console.log(`   Total rows: ${total.toLocaleString()} · Resuming from ${cp.offset}`)

  let offset = cp.offset
  let synced = cp.synced
  const startTime = Date.now()

  while (offset < total) {
    const [rows] = await db.query(query + ` LIMIT ${BATCH} OFFSET ${offset}`)
    if (rows.length === 0) break

    const mapped = rows.map(mapRow)
    const { error } = await supabase.from(table).upsert(mapped, {
      onConflict: conflictCol,
      ignoreDuplicates: false,
    })

    if (error) {
      console.error(`   ❌ ${name} error at ${offset}: ${error.message}`)
      // If table doesn't exist, bail with instructions
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.error(`\n⚠️  Table "${table}" does not exist in Supabase.`)
        console.error(`   Run the SQL in: scripts/create-sync-tables.sql`)
        console.error(`   Paste it in the Supabase SQL Editor, then re-run this script.\n`)
        return false
      }
    } else {
      synced += rows.length
    }

    offset += rows.length

    if (synced % (BATCH * 2) < BATCH || offset >= total) {
      saveCP(name, { offset, synced })
      const pct = Math.round((offset / total) * 100)
      const elapsed = Math.round((Date.now() - startTime) / 60000)
      console.log(`   [${pct}%] ${synced.toLocaleString()}/${total.toLocaleString()} · ${elapsed}m`)
    }
  }

  clearCP(name)
  console.log(`   ✅ ${name}: ${synced.toLocaleString()} rows synced`)
  return true
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
async function run() {
  const t0 = Date.now()
  console.log('🚀 COMPREHENSIVE GLOBALPC + ECONTA SYNC')
  console.log('═'.repeat(50))

  // ─── Load active clients from Supabase ───
  const { data: companies, error: compErr } = await supabase
    .from('companies')
    .select('company_id, clave_cliente')
    .not('clave_cliente', 'is', null)
    .eq('active', true)

  if (compErr || !companies || companies.length === 0) {
    console.error('❌ Failed to load companies:', compErr?.message || 'no active companies found')
    return
  }

  const CLIENTS = companies.map(c => ({
    clave: c.clave_cliente,
    companyId: c.company_id,
    tenantId: FALLBACK_TENANT_ID,
  }))

  console.log(`📋 Syncing ${CLIENTS.length} client(s): ${CLIENTS.map(c => `${c.companyId} (${c.clave})`).join(', ')}`)

  // ─── PHASE 1: MySQL Tráfico (bd_demo_38) ───
  console.log('\n══ PHASE 1: MySQL Tráfico ══')
  let db
  try {
    db = await getMySQLTrafico()
    console.log('✅ MySQL Tráfico connected')
  } catch (e) {
    console.error('❌ MySQL Tráfico failed:', e.message)
    return
  }

  let tableMissing = false

  for (const client of CLIENTS) {
    const { clave, companyId, tenantId } = client
    console.log(`\n── Client: ${companyId} (${clave}) ──`)

    // 1. cb_trafico → traficos
    await syncTable({
      name: `traficos_${companyId}`, db,
      countQuery: `SELECT COUNT(*) as total FROM cb_trafico WHERE sCveTrafico LIKE '${clave}-%'`,
      query: `SELECT sCveTrafico AS trafico, sCveCliente AS cve_cliente,
        sCveAduana AS aduana, sNumPatente AS patente, sNumPedimento AS pedimento,
        iPesoBruto AS peso_bruto, ePesoBruto AS peso_unidad,
        sDescripcionMercancia AS descripcion_mercancia,
        dFechaLlegadaMercancia AS fecha_llegada, dFechaCruce AS fecha_cruce,
        dFechaPago AS fecha_pago, sCveTransportistaAmericano AS transp_ext,
        sCveTransportistaMexicano AS transp_mex, iCveEmbarque AS embarque,
        eCveRegimen AS regimen, iTipoCambio AS tipo_cambio,
        eColorSemaforo AS semaforo, sNumContenedor AS contenedor,
        iCantidadBultosRecibidos AS bultos, sReferenciaCliente AS ref_cliente,
        sCveProcedencia AS procedencia,
        dFechaIngreso AS created_at, dFechaActualizacion AS updated_at
      FROM cb_trafico WHERE sCveTrafico LIKE '${clave}-%' ORDER BY dFechaIngreso ASC`,
      table: 'traficos',
      conflictCol: 'trafico',
      mapRow: r => ({
        trafico: r.trafico, company_id: companyId, tenant_id: tenantId, tenant_slug: companyId,
        estatus: translateEstatus({ fecha_cruce: r.fecha_cruce, fecha_pago: r.fecha_pago }),
        descripcion_mercancia: r.descripcion_mercancia, peso_bruto: r.peso_bruto,
        fecha_llegada: r.fecha_llegada, pedimento: r.pedimento,
        transportista_extranjero: r.transp_ext, transportista_mexicano: r.transp_mex,
        embarque: r.embarque,
        aduana: r.aduana, patente: r.patente, regimen: r.regimen,
        tipo_cambio: r.tipo_cambio, fecha_cruce: r.fecha_cruce, fecha_pago: r.fecha_pago,
        semaforo: r.semaforo ? Number(r.semaforo) : null,
        contenedor: r.contenedor, peso_bruto_unidad: r.peso_unidad ? Number(r.peso_unidad) : null,
        bultos_recibidos: r.bultos, referencia_cliente: r.ref_cliente,
        pais_procedencia: r.procedencia,
        updated_at: new Date().toISOString(),
      }),
    })

    // 2. cb_entrada_bodega → entradas
    await syncTable({
      name: `entradas_${companyId}`, db,
      countQuery: `SELECT COUNT(*) as total FROM cb_entrada_bodega WHERE sCveCliente = '${clave}'`,
      query: `SELECT sCveEntradaBodega AS cve_entrada, iCveEmbarque AS embarque,
        sCveCliente AS cve_cliente, sCveProveedor AS proveedor,
        sCveTransportistaAmericano AS transp_am, sCveTransportistaMexicano AS transp_mx,
        eTipoOperacion AS tipo_op, eTipoCarga AS tipo_carga,
        iCantidadBultosRecibidos AS bultos, iPesoBruto AS peso_bruto, iPesoNeto AS peso_neto,
        sDescripcionMercancia AS desc_merc, dFechaLlegadaMercancia AS fecha_llegada,
        bFaltantes AS faltantes, bMercanciaDanada AS danada,
        bRecibioFacturas AS facturas, bRecibioPackingList AS packing,
        sRecibidoPor AS recibido, sNumPedido AS pedido,
        sNumTalon AS num_talon, sNumCajaTrailer AS num_caja_trailer
      FROM cb_entrada_bodega WHERE sCveCliente = '${clave}' ORDER BY dFechaIngreso ASC`,
      table: 'entradas',
      conflictCol: 'cve_entrada',
      mapRow: r => ({
        cve_entrada: r.cve_entrada, cve_embarque: r.embarque, cve_cliente: r.cve_cliente,
        cve_proveedor: r.proveedor, company_id: companyId, tenant_id: tenantId, tenant_slug: companyId,
        transportista_americano: r.transp_am, transportista_mexicano: r.transp_mx,
        tipo_operacion: r.tipo_op, tipo_carga: r.tipo_carga,
        cantidad_bultos: r.bultos, peso_bruto: r.peso_bruto, peso_neto: r.peso_neto,
        descripcion_mercancia: r.desc_merc, fecha_llegada_mercancia: r.fecha_llegada,
        tiene_faltantes: r.faltantes === '1', mercancia_danada: r.danada === '1',
        recibio_facturas: r.facturas === '1', recibio_packing_list: r.packing === '1',
        recibido_por: r.recibido, num_pedido: r.pedido,
        num_talon: r.num_talon || null, num_caja_trailer: r.num_caja_trailer || null,
        updated_at: new Date().toISOString(),
      }),
    })

    // 3. cb_factura → globalpc_facturas
    const ok3 = await syncTable({
      name: `globalpc_facturas_${companyId}`, db,
      countQuery: `SELECT COUNT(*) as total FROM cb_factura WHERE sCveCliente = '${clave}'`,
      query: `SELECT iFolio AS folio, sCveTrafico AS cve_trafico, sCveCliente AS cve_cliente,
        sCveProveedor AS cve_proveedor, sNumero AS numero, sCveIncoterm AS incoterm,
        sCveMoneda AS moneda, dFechaFacturacion AS fecha_facturacion,
        iValorComercial AS valor, iFlete AS flete, iSeguros AS seguros,
        iEmbalajes AS embalajes, iIncrementables AS incrementables,
        iDeducibles AS deducibles, sCoveVucem AS cove
      FROM cb_factura WHERE sCveCliente = '${clave}' ORDER BY iFolio ASC`,
      table: 'globalpc_facturas',
      conflictCol: 'folio',
      mapRow: r => ({
        folio: r.folio, cve_trafico: r.cve_trafico, cve_cliente: r.cve_cliente,
        cve_proveedor: r.cve_proveedor, numero: r.numero, incoterm: r.incoterm,
        moneda: normalizeMoneda(r.moneda), fecha_facturacion: r.fecha_facturacion,
        valor_comercial: r.valor, flete: r.flete, seguros: r.seguros,
        embalajes: r.embalajes, incrementables: r.incrementables,
        deducibles: r.deducibles, cove_vucem: r.cove,
        tenant_id: tenantId, company_id: companyId,  // Block EE
        updated_at: new Date().toISOString(),
      }),
    })
    if (ok3 === false) {
      console.error('\n🛑 Tables missing. Run scripts/create-sync-tables.sql in Supabase SQL Editor first.')
      tableMissing = true
      break
    }

    // 4. cb_producto_factura → globalpc_partidas
    await syncTable({
      name: `globalpc_partidas_${companyId}`, db,
      countQuery: `SELECT COUNT(*) as total FROM cb_producto_factura WHERE sCveCliente = '${clave}'`,
      query: `SELECT iFolio AS folio, iNumeroItem AS numero_item, sCveCliente AS cve_cliente,
        sCveProveedor AS cve_proveedor, sCveClienteProveedorProducto AS cve_producto,
        iPrecioUnitarioProducto AS precio, iCantidadProducto AS cantidad,
        iPeso AS peso, sCvePais AS pais, sMarca AS marca, sModelo AS modelo, sSerie AS serie
      FROM cb_producto_factura WHERE sCveCliente = '${clave}' ORDER BY iFolio ASC`,
      table: 'globalpc_partidas',
      conflictCol: 'folio,numero_item',
      mapRow: r => ({
        folio: r.folio, numero_item: r.numero_item, cve_cliente: r.cve_cliente,
        cve_proveedor: r.cve_proveedor, cve_producto: r.cve_producto,
        precio_unitario: r.precio, cantidad: r.cantidad, peso: r.peso,
        pais_origen: r.pais, marca: r.marca, modelo: r.modelo, serie: r.serie,
        tenant_id: tenantId,
        company_id: companyId,  // Block EE — every globalpc_* row owns its tenant.
      }),
    })

    // 5. cb_eventos_trafico → globalpc_eventos
    await syncTable({
      name: `globalpc_eventos_${companyId}`, db,
      countQuery: `SELECT COUNT(*) as total FROM cb_eventos_trafico WHERE sCveTrafico LIKE '${clave}-%'`,
      query: `SELECT iConsecutivo AS consecutivo, sCveTrafico AS cve_trafico,
        iConsecutivoEvento AS consecutivo_evento, dFecha AS fecha,
        sComentarios AS comentarios, sRegistradoPor AS registrado_por, sRemesa AS remesa
      FROM cb_eventos_trafico WHERE sCveTrafico LIKE '${clave}-%' ORDER BY iConsecutivo ASC`,
      table: 'globalpc_eventos',
      conflictCol: 'consecutivo',
      mapRow: r => ({
        consecutivo: r.consecutivo, cve_trafico: r.cve_trafico,
        consecutivo_evento: r.consecutivo_evento, fecha: r.fecha,
        comentarios: r.comentarios, registrado_por: r.registrado_por,
        remesa: r.remesa, tenant_id: tenantId, company_id: companyId,  // Block EE
      }),
    })

    // 6. cb_contenedores_trafico → globalpc_contenedores
    await syncTable({
      name: `globalpc_contenedores_${companyId}`, db,
      countQuery: `SELECT COUNT(*) as total FROM cb_contenedores_trafico WHERE sCveTrafico LIKE '${clave}-%'`,
      query: `SELECT iConsecutivo AS consecutivo, sCveTrafico AS cve_trafico,
        sNumeroCajaTrailer AS numero_caja, sCveContenedor AS cve_contenedor,
        sPlacas AS placas, sSello1 AS sello1, sSello2 AS sello2,
        bPaisMedioTransporte AS pais_transporte
      FROM cb_contenedores_trafico WHERE sCveTrafico LIKE '${clave}-%' ORDER BY iConsecutivo ASC`,
      table: 'globalpc_contenedores',
      conflictCol: 'consecutivo',
      mapRow: r => ({
        consecutivo: r.consecutivo, cve_trafico: r.cve_trafico,
        numero_caja: r.numero_caja, cve_contenedor: r.cve_contenedor,
        placas: r.placas, sello1: r.sello1, sello2: r.sello2,
        pais_transporte: r.pais_transporte, tenant_id: tenantId,
        company_id: companyId,  // Block EE
      }),
    })

    // 7. cb_orden_carga (via detalle join) → globalpc_ordenes_carga
    await syncTable({
      name: `globalpc_ordenes_carga_${companyId}`, db,
      countQuery: `SELECT COUNT(DISTINCT oc.iConsecutivo) as total FROM cb_orden_carga oc
        INNER JOIN cb_detalle_orden_carga doc ON oc.iConsecutivo = doc.iConsecutivoOrdenCarga
        WHERE doc.sCveTrafico LIKE '${clave}-%'`,
      query: `SELECT DISTINCT oc.iConsecutivo AS consecutivo, oc.dFecha AS fecha,
        oc.eTipoOrden AS tipo_orden, oc.dFechaSalida AS fecha_salida,
        oc.dFechaCruce AS fecha_cruce, oc.sNumCajaTrailer AS num_caja,
        CONCAT(oc.sSellos_1, ' ', oc.sSellos_2, ' ', oc.sSellos_3) AS sellos,
        oc.sCveTransfer AS cve_transfer, oc.sCveAduana AS cve_aduana, oc.sNumPatente AS num_patente
      FROM cb_orden_carga oc
      INNER JOIN cb_detalle_orden_carga doc ON oc.iConsecutivo = doc.iConsecutivoOrdenCarga
      WHERE doc.sCveTrafico LIKE '${clave}-%' ORDER BY oc.iConsecutivo ASC`,
      table: 'globalpc_ordenes_carga',
      conflictCol: 'consecutivo',
      mapRow: r => ({
        consecutivo: r.consecutivo, fecha: r.fecha, tipo_orden: r.tipo_orden,
        fecha_salida: r.fecha_salida, fecha_cruce: r.fecha_cruce,
        num_caja: r.num_caja, sellos: (r.sellos || '').trim(),
        cve_transfer: r.cve_transfer, cve_aduana: r.cve_aduana,
        num_patente: r.num_patente, tenant_id: tenantId,
        company_id: companyId,  // Block EE
      }),
    })

    // 8. cu_cliente_proveedor → globalpc_proveedores
    await syncTable({
      name: `globalpc_proveedores_${companyId}`, db,
      countQuery: `SELECT COUNT(*) as total FROM cu_cliente_proveedor WHERE sCveCliente = '${clave}'`,
      query: `SELECT sCveProveedor AS cve_proveedor, sCveCliente AS cve_cliente,
        sNombreProveedor AS nombre, sAliasProveedor AS alias,
        sIDFiscalProveedor AS id_fiscal, sCvePaisProveedor AS pais,
        sCiudadProveedor AS ciudad, sCalleProveedor AS calle,
        sNombreContacto AS contacto, sCuentaCorreoContacto AS email,
        sTelefonoContacto AS telefono
      FROM cu_cliente_proveedor WHERE sCveCliente = '${clave}' ORDER BY sCveProveedor ASC`,
      table: 'globalpc_proveedores',
      conflictCol: 'cve_proveedor,cve_cliente',
      mapRow: r => ({
        cve_proveedor: r.cve_proveedor, cve_cliente: r.cve_cliente,
        nombre: r.nombre, alias: r.alias, id_fiscal: r.id_fiscal,
        pais: r.pais, ciudad: r.ciudad, calle: r.calle,
        contacto: r.contacto, email_contacto: r.email,
        telefono: r.telefono, tenant_id: tenantId,
        company_id: companyId,  // Block EE
      }),
    })

    // 9. cu_cliente_proveedor_producto → globalpc_productos
    await syncTable({
      name: `globalpc_productos_${companyId}`, db,
      countQuery: `SELECT COUNT(*) as total FROM cu_cliente_proveedor_producto WHERE sCveCliente = '${clave}'`,
      query: `SELECT sCveClienteProveedorProducto AS cve_producto, sCveCliente AS cve_cliente,
        sCveProveedor AS cve_proveedor, sDescripcionProductoEspanol AS descripcion,
        sDescripcionProductoIngles AS descripcion_en,
        sCveFraccion AS fraccion, sCveUMT AS umt, sCvePais AS pais_origen,
        sMarca AS marca, iPrecioUnitario AS precio
      FROM cu_cliente_proveedor_producto WHERE sCveCliente = '${clave}' ORDER BY sCveClienteProveedorProducto ASC`,
      table: 'globalpc_productos',
      conflictCol: 'cve_producto,cve_cliente,cve_proveedor',
      mapRow: r => ({
        cve_producto: r.cve_producto, cve_cliente: r.cve_cliente,
        cve_proveedor: r.cve_proveedor, descripcion: r.descripcion,
        descripcion_ingles: r.descripcion_en,
        fraccion: r.fraccion, umt: r.umt,
        pais_origen: r.pais_origen, marca: r.marca,
        precio_unitario: r.precio, tenant_id: tenantId,
        company_id: companyId,  // Block EE — every globalpc_* row owns its tenant.
      }),
    })

    // 10. cb_bulto → globalpc_bultos
    await syncTable({
      name: `globalpc_bultos_${companyId}`, db,
      countQuery: `SELECT COUNT(*) as total FROM cb_bulto WHERE sCveEntradaBodega IN
        (SELECT sCveEntradaBodega FROM cb_entrada_bodega WHERE sCveCliente = '${clave}')`,
      query: `SELECT b.iConsecutivo AS consecutivo, b.sCveEntradaBodega AS cve_entrada,
        b.sCveBulto AS cve_bulto, b.iCantidadBultos AS cantidad, b.sMarcas AS descripcion
      FROM cb_bulto b
      WHERE b.sCveEntradaBodega IN
        (SELECT sCveEntradaBodega FROM cb_entrada_bodega WHERE sCveCliente = '${clave}')
      ORDER BY b.iConsecutivo ASC`,
      table: 'globalpc_bultos',
      conflictCol: 'consecutivo',
      mapRow: r => ({
        consecutivo: r.consecutivo, cve_entrada: r.cve_entrada,
        cve_bulto: r.cve_bulto, cantidad: r.cantidad,
        descripcion: r.descripcion, tenant_id: tenantId,
        company_id: companyId,  // Block EE
      }),
    })

    console.log(`\n✅ ${companyId} (${clave}) — Phase 1 complete`)
  }

  await db.end()
  if (tableMissing) return
  console.log('\n✅ Phase 1 complete — MySQL Tráfico (all clients)')

  // ─── PHASE 2: MySQL eConta (bd_econta_rz) ───
  console.log('\n══ PHASE 2: MySQL eConta ══')
  let ec
  try {
    ec = await getMySQLeConta()
    console.log('✅ MySQL eConta connected')
  } catch (e) {
    console.error('❌ MySQL eConta failed:', e.message)
    return
  }

  // 11. factura_aa → econta_facturas
  await syncTable({
    name: 'econta_facturas', db: ec,
    countQuery: `SELECT COUNT(*) as total FROM factura_aa`,
    query: `SELECT iConsecutivo AS consecutivo, iCveOficina AS cve_oficina,
      sCveClienteEconta AS cve_cliente, sSerieCliente AS serie, sFolioSAT AS folio,
      bTipoOperacion AS tipo_factura, dFechaHora AS fecha,
      rTotal AS subtotal, rIVA AS iva, rTotalCFD AS total,
      sCveTipoMoneda AS moneda, rTipoCambio AS tipo_cambio,
      sComentarios AS observaciones
    FROM factura_aa ORDER BY iConsecutivo ASC`,
    table: 'econta_facturas',
    conflictCol: 'consecutivo',
    mapRow: r => ({
      consecutivo: r.consecutivo, cve_oficina: r.cve_oficina,
      cve_cliente: r.cve_cliente, serie: r.serie, folio: r.folio,
      tipo_factura: r.tipo_factura, fecha: r.fecha,
      subtotal: r.subtotal, iva: r.iva, total: r.total,
      moneda: normalizeMoneda(r.moneda), tipo_cambio: r.tipo_cambio,
      observaciones: r.observaciones, tenant_id: FALLBACK_TENANT_ID,
    }),
  })

  // 12. factura_detalle_aa → econta_facturas_detalle
  await syncTable({
    name: 'econta_facturas_detalle', db: ec,
    countQuery: `SELECT COUNT(*) as total FROM factura_detalle_aa`,
    query: `SELECT iConsecutivoGeneral AS consecutivo, sReferencia AS referencia,
      sDescripcionServicioFD AS descripcion, rImporteFD AS importe,
      rIVAFD AS iva, iFolio AS consecutivo_factura
    FROM factura_detalle_aa ORDER BY iConsecutivoGeneral ASC`,
    table: 'econta_facturas_detalle',
    conflictCol: 'id',
    mapRow: r => ({
      consecutivo: r.consecutivo, consecutivo_factura: r.consecutivo_factura,
      descripcion: r.descripcion, importe: r.importe, iva: r.iva,
      referencia: r.referencia, tenant_id: FALLBACK_TENANT_ID,
    }),
  })

  // 13. cl_cartera → econta_cartera
  await syncTable({
    name: 'econta_cartera', db: ec,
    countQuery: `SELECT COUNT(*) as total FROM cl_cartera`,
    query: `SELECT iConsecutivo AS consecutivo, sCveCliente AS cve_cliente,
      eTipoCargoAbono AS tipo, sReferencia AS referencia, dFecha AS fecha,
      rCargo AS importe, rAbono AS saldo,
      sTipoMoneda AS moneda, sTipoCambio AS tipo_cambio,
      sPedimento AS observaciones
    FROM cl_cartera ORDER BY iConsecutivo ASC`,
    table: 'econta_cartera',
    conflictCol: 'consecutivo',
    mapRow: r => ({
      consecutivo: r.consecutivo, cve_cliente: r.cve_cliente,
      tipo: r.tipo, referencia: r.referencia, fecha: r.fecha,
      importe: r.importe, saldo: r.saldo,
      moneda: normalizeMoneda(r.moneda), tipo_cambio: r.tipo_cambio,
      observaciones: r.observaciones, tenant_id: FALLBACK_TENANT_ID,
    }),
  })

  // 14. cl_aplicaciones → econta_aplicaciones
  await syncTable({
    name: 'econta_aplicaciones', db: ec,
    countQuery: `SELECT COUNT(*) as total FROM cl_aplicaciones`,
    query: `SELECT iConsecutivo AS consecutivo,
      iConsecutivoCarteraCargo AS consecutivo_cargo,
      iConsecutivoCarteraAbono AS consecutivo_abono,
      rImporte AS importe, dFechaAplicacion AS fecha
    FROM cl_aplicaciones ORDER BY iConsecutivo ASC`,
    table: 'econta_aplicaciones',
    conflictCol: 'consecutivo',
    mapRow: r => ({
      consecutivo: r.consecutivo, consecutivo_cargo: r.consecutivo_cargo,
      consecutivo_abono: r.consecutivo_abono, importe: r.importe,
      fecha: r.fecha, tenant_id: FALLBACK_TENANT_ID,
    }),
  })

  // 15. ba_ingresos → econta_ingresos (columns verified correct)
  await syncTable({
    name: 'econta_ingresos', db: ec,
    countQuery: `SELECT COUNT(*) as total FROM ba_ingresos`,
    query: `SELECT iConsecutivo AS consecutivo, sCuentaContable AS cuenta_contable,
      sTipoIngreso AS tipo_ingreso, eFormaIngreso AS forma_ingreso,
      sCveCliente AS cve_cliente, iConsecutivoOficina AS oficina,
      sReferencia AS referencia, dFecha AS fecha, rImporte AS importe,
      iTipoCambio AS tipo_cambio, sCveMoneda AS moneda, sConcepto AS concepto
    FROM ba_ingresos ORDER BY iConsecutivo ASC`,
    table: 'econta_ingresos',
    conflictCol: 'consecutivo',
    mapRow: r => ({
      consecutivo: r.consecutivo, cuenta_contable: r.cuenta_contable,
      tipo_ingreso: r.tipo_ingreso, forma_ingreso: r.forma_ingreso,
      cve_cliente: r.cve_cliente, oficina: r.oficina, referencia: r.referencia,
      fecha: r.fecha, importe: r.importe, tipo_cambio: r.tipo_cambio,
      moneda: normalizeMoneda(r.moneda), concepto: r.concepto, tenant_id: FALLBACK_TENANT_ID,
    }),
  })

  // 16. ba_egresos → econta_egresos (columns verified correct)
  await syncTable({
    name: 'econta_egresos', db: ec,
    countQuery: `SELECT COUNT(*) as total FROM ba_egresos`,
    query: `SELECT iConsecutivo AS consecutivo, sCuentaContable AS cuenta_contable,
      eFormaEgreso AS forma_egreso, sTipoEgreso AS tipo_egreso,
      sCveCliente AS cve_cliente, sCveProveedor AS cve_proveedor,
      sBeneficiario AS beneficiario, sReferencia AS referencia,
      dFecha AS fecha, rImporte AS importe, sCveMoneda AS moneda,
      iTipoCambio AS tipo_cambio, sConcepto AS concepto
    FROM ba_egresos ORDER BY iConsecutivo ASC`,
    table: 'econta_egresos',
    conflictCol: 'consecutivo',
    mapRow: r => ({
      consecutivo: r.consecutivo, cuenta_contable: r.cuenta_contable,
      forma_egreso: r.forma_egreso, tipo_egreso: r.tipo_egreso,
      cve_cliente: r.cve_cliente, cve_proveedor: r.cve_proveedor,
      beneficiario: r.beneficiario, referencia: r.referencia,
      fecha: r.fecha, importe: r.importe, moneda: normalizeMoneda(r.moneda),
      tipo_cambio: r.tipo_cambio, concepto: r.concepto, tenant_id: FALLBACK_TENANT_ID,
    }),
  })

  // 17. ba_anticipos → econta_anticipos
  await syncTable({
    name: 'econta_anticipos', db: ec,
    countQuery: `SELECT COUNT(*) as total FROM ba_anticipos`,
    query: `SELECT iConsecutivo AS consecutivo, sCveCliente AS cve_cliente,
      iCveOficina AS oficina, sReferencia AS referencia,
      dFecha AS fecha, rImporte AS importe,
      sCveMoneda AS moneda, iTipoCambio AS tipo_cambio
    FROM ba_anticipos ORDER BY iConsecutivo ASC`,
    table: 'econta_anticipos',
    conflictCol: 'consecutivo',
    mapRow: r => ({
      consecutivo: r.consecutivo, cve_cliente: r.cve_cliente,
      oficina: r.oficina, referencia: r.referencia,
      fecha: r.fecha, importe: r.importe, moneda: normalizeMoneda(r.moneda),
      tipo_cambio: r.tipo_cambio, tenant_id: FALLBACK_TENANT_ID,
    }),
  })

  // 18. cg_polizas_contables → econta_polizas
  await syncTable({
    name: 'econta_polizas', db: ec,
    countQuery: `SELECT COUNT(*) as total FROM cg_polizas_contables`,
    query: `SELECT iConsecutivo AS consecutivo, iCveOficina AS cve_oficina,
      dFechaPoliza AS fecha, sNumeroPoliza AS numero_poliza,
      eTipoPoliza AS tipo_poliza, sNumDocumento AS num_documento,
      sObservaciones AS observaciones, rImporte AS importe
    FROM cg_polizas_contables ORDER BY iConsecutivo ASC`,
    table: 'econta_polizas',
    conflictCol: 'consecutivo',
    mapRow: r => ({
      consecutivo: r.consecutivo, cve_oficina: r.cve_oficina,
      fecha: r.fecha, numero_poliza: r.numero_poliza,
      tipo_poliza: r.tipo_poliza, num_documento: r.num_documento,
      observaciones: r.observaciones, importe: r.importe,
      tenant_id: FALLBACK_TENANT_ID,
    }),
  })

  await ec.end()
  console.log('\n✅ Phase 2 complete — MySQL eConta')

  // ─── PHASE 3: WSDL Document Pull ───
  // Token expires in 60s. Refresh every 45s.
  // Use getListaDocumentosTrafico per tipo_documento (getDocumentosNotificacionTrafico returns empty).
  // Use getDocumentoTrafico to download PDF content → Supabase Storage.
  console.log('\n══ PHASE 3: WSDL Document Pull ══')
  const WSDL_URL = 'https://trafico1web.globalpc.net/ws_trafico/consulta_documentos/ws_consulta_documentos.php?wsdl'
  try {
    const soapClient = await soap.createClientAsync(WSDL_URL)

    let wsdlKey = null
    let lastAuth = 0
    async function freshKey() {
      if (wsdlKey && Date.now() - lastAuth < 45000) return wsdlKey
      console.log('   [auth] Refreshing WSDL token...')
      const r = await soapClient.getWSAccesoAsync({
        token: 'Z9C',
        usr: process.env.GLOBALPC_USER,
        pwd: process.env.GLOBALPC_PASS,
      })
      const resp = r[0]?.return || r[0]
      wsdlKey = resp?.key
      if (resp?.error === 'TRUE' || resp?.error === '1' || !wsdlKey) {
        console.log('   [auth] ❌ Auth failed:', JSON.stringify(resp).slice(0, 200))
        wsdlKey = null
      }
      lastAuth = Date.now()
      return wsdlKey
    }

    let key = await freshKey()
    console.log('   [auth] Key:', key ? key.slice(0, 15) + '...' : 'NULL')
    if (!key) {
      console.log('⚠️  WSDL auth failed — skipping document pull')
    } else {
      console.log('✅ WSDL authenticated (refresh every 45s)')

      // Get doc types — use fresh key
      key = await freshKey()
      const typesResp = await soapClient.getTipoDocumentosTraficoAsync({ key })
      const typesRaw = typesResp[0]?.return
      const docTypes = typesRaw?.TipoDocumentoTrafico?.item || []
      console.log(`   ${docTypes.length} document types available`)
      if (docTypes.length === 0) {
        console.log('   [debug] getTipoDocumentosTrafico raw:', JSON.stringify(typesRaw).slice(0, 300))
      }

      // Focus on high-value types first: FACTURA, CARTA, LISTA DE EMPAQUE, PEDIMENTO, COVE, etc.
      const priorityTypes = ['1', '20', '100', '101', '102', '107', '108', '112', '131', '133', '134']
      const sortedTypes = [
        ...docTypes.filter(dt => priorityTypes.includes(dt.tipo_documento)),
        ...docTypes.filter(dt => !priorityTypes.includes(dt.tipo_documento)),
      ]

      for (const client of CLIENTS) {
        const { clave, companyId } = client
        console.log(`\n── WSDL docs: ${companyId} (${clave}) ──`)

        const traficos = await fetchAll(supabase
          .from('traficos')
          .select('trafico')
          .like('trafico', `${clave}-%`)
          .order('fecha_llegada', { ascending: false, nullsFirst: false }))

        if (!traficos || traficos.length === 0) {
          console.log(`   No tráficos for ${companyId} — skipping`)
          continue
        }

        console.log(`   ${traficos.length} tráficos to scan (most recent first)`)
        console.log(`   First 3: ${traficos.slice(0, 3).map(t => t.trafico).join(', ')}`)

        // Quick sanity check — verify first tráfico returns docs
        key = await freshKey()
        try {
          const testResp = await soapClient.getListaDocumentosTraficoAsync({
            clave_trafico: traficos[0].trafico, tipo_documento: '1', key
          })
          const testDocs = testResp[0]?.return?.ListaDocumentosTrafico
          if (testDocs) {
            const items = Array.isArray(testDocs.item) ? testDocs.item : [testDocs.item]
            console.log(`   ✅ Sanity check: ${traficos[0].trafico} type 1 → ${items.length} docs`)
          } else {
            console.log(`   ⚠️  Sanity check: ${traficos[0].trafico} type 1 → 0 docs`)
          }
        } catch (e) {
          console.log(`   ⚠️  Sanity check error: ${e.message.slice(0, 80)}`)
        }

        let totalDocs = 0
        let filesUploaded = 0
        let scanned = 0
        const cpName = `wsdl_docs_${companyId}`
        const cp = loadCP(cpName)

        for (let i = cp.offset; i < traficos.length; i++) {
          const t = traficos[i].trafico
          key = await freshKey()

          for (const dt of sortedTypes) {
            try {
              key = await freshKey()
              const resp = await soapClient.getListaDocumentosTraficoAsync({
                clave_trafico: t, tipo_documento: dt.tipo_documento, key
              })
              const docs = resp[0]?.return?.ListaDocumentosTrafico
              if (!docs) continue

              const items = Array.isArray(docs.item) ? docs.item : [docs.item]
              for (const doc of items.filter(Boolean)) {
                const docId = doc.id
                const docName = doc.descripcion || doc.nombre || `${t}_${dt.tipo_documento}`

                // Check if already exists (no unique constraint, so manual dedup)
                const { data: existing } = await supabase.from('documents')
                  .select('id')
                  .eq('document_type', dt.descripcion)
                  .eq('tenant_slug', companyId)
                  .filter('metadata->>globalpc_id', 'eq', docId)
                  .limit(1)

                if (!existing || existing.length === 0) {
                  const { error: docErr } = await supabase.from('documents').insert({
                    document_type: dt.descripcion,
                    generated_by: 'GlobalPC-WSDL',
                    metadata: { trafico: t, globalpc_id: docId, nombre: docName, tipo_id: dt.tipo_documento },
                    tenant_slug: companyId,
                  })
                  if (docErr) {
                    console.log(`   ❌ UPSERT FAILED: ${docErr.message}`)
                  } else {
                    totalDocs++
                    console.log(`   ✅ ${t} | ${dt.descripcion} | ${docName}`)
                  }
                } else {
                  totalDocs++ // Already exists, still count it
                }

                // Download actual PDF content
                if (docId) {
                  try {
                    key = await freshKey()
                    const contentResp = await soapClient.getDocumentoTraficoAsync({ id_documento: docId, key })
                    const content = contentResp[0]?.return
                    if (content?.error === '0' && content?.contenido) {
                      const buf = Buffer.from(content.contenido, 'base64')
                      const safeName = (content.nombre || docName || `${docId}.pdf`).replace(/[^a-zA-Z0-9._-]/g, '_')
                      const tipoFolder = dt.descripcion.replace(/\s+/g, '_')
                      const filePath = `${t}/${tipoFolder}/${safeName}`
                      const { error: upErr } = await supabase.storage
                        .from('expedientes')
                        .upload(filePath, buf, {
                          contentType: content.tipo || 'application/pdf',
                          upsert: true,
                        })
                      if (!upErr) {
                        filesUploaded++
                        const { data: urlData } = supabase.storage.from('expedientes').getPublicUrl(filePath)
                        await supabase.from('documents').update({
                          file_url: urlData?.publicUrl || filePath,
                        }).eq('tenant_slug', companyId)
                          .filter('metadata->>globalpc_id', 'eq', docId)
                      }
                    }
                  } catch (e) { /* content download failed — catalog entry still saved */ }
                }
              }
            } catch (e) { /* type not found — normal */ }
          }

          scanned++
          if (scanned <= 10) {
            console.log(`   ${t}: ${totalDocs} total docs so far · ${filesUploaded} PDFs`)
          }
          if (scanned % 50 === 0) {
            saveCP(cpName, { offset: i + 1, synced: totalDocs })
            console.log(`   WSDL [${companyId}]: ${scanned}/${traficos.length} tráficos · ${totalDocs} docs · ${filesUploaded} PDFs`)
          }
        }

        clearCP(cpName)
        console.log(`\n✅ WSDL [${companyId}]: ${totalDocs} docs cataloged · ${filesUploaded} PDFs uploaded from ${scanned} tráficos`)
      }
    }
  } catch (e) {
    console.log('⚠️  WSDL error:', e.message, '— skipping Phase 3')
  }

  // ─── PHASE 4: Ollama TIGIE Classification ───
  console.log('\n══ PHASE 4: Ollama Fraccion Classification (qwen3:32b) ══')
  try {
    // Check Ollama is available
    const ollamaCheck = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5000) })
    if (!ollamaCheck.ok) throw new Error('Ollama not responding')
    const ollamaModels = await ollamaCheck.json()
    const hasModel = ollamaModels.models?.some(m => m.name.includes('qwen3:32b'))
    if (!hasModel) throw new Error('qwen3:32b model not found in Ollama')
    console.log(`✅ Ollama connected — ${OLLAMA_MODEL} available`)

    // Load checkpoint
    const fracCP = loadCP('fraccion_classify')
    let classified = fracCP.synced || 0
    let lastId = fracCP.lastId || null
    console.log(`   Resuming from: ${classified} classified${lastId ? `, after id=${lastId}` : ''}`)

    let totalClassified = classified
    let batchCount = 0
    let done = false

    while (!done) {
      // Fetch products with null fraccion from Supabase
      let query = supabase
        .from('globalpc_productos')
        .select('id, cve_producto, descripcion, descripcion_ingles')
        .or('fraccion.is.null,fraccion.eq.')
        .order('id', { ascending: true })
        .limit(OLLAMA_BATCH)

      if (lastId) query = query.gt('id', lastId)

      const { data: products, error: fetchErr } = await query
      if (fetchErr) { console.error('   ❌ Supabase fetch error:', fetchErr.message); break }
      if (!products || products.length === 0) { console.log('   ✅ No more products to classify'); done = true; break }

      // Classify each product via Ollama
      for (const prod of products) {
        const desc = prod.descripcion || prod.descripcion_ingles || prod.cve_producto
        if (!desc) { lastId = prod.id; continue }

        const prompt = `Classify this product under Mexico's TIGIE tariff schedule. Return only the 8-digit fraccion arancelaria. Product: ${desc}`

        try {
          const res = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: OLLAMA_MODEL,
              prompt,
              stream: false,
              options: { temperature: 0.1, num_predict: 30 }
            }),
            signal: AbortSignal.timeout(30000)
          })

          if (!res.ok) { console.error(`   Ollama HTTP ${res.status} for ${prod.cve_producto}`); lastId = prod.id; continue }
          const data = await res.json()
          const raw = data.response?.trim() || ''
          // Extract 8-digit fraccion (may have dots: 3901.10.01 or plain: 39011001)
          const match = raw.match(/(\d{4})[.\s]?(\d{2})[.\s]?(\d{2})/)
          if (match) {
            const fraccion = `${match[1]}.${match[2]}.${match[3]}`
            const { error: upErr } = await supabase
              .from('globalpc_productos')
              .update({ fraccion, fraccion_source: 'ollama_qwen3_8b', fraccion_classified_at: new Date().toISOString() })
              .eq('id', prod.id)
            if (upErr) console.error(`   ❌ Update error for ${prod.cve_producto}: ${upErr.message}`)
            else totalClassified++
          }
        } catch (e) {
          const key = prod.cve_producto
          timeoutTracker[key] = (timeoutTracker[key] || 0) + 1
          if (timeoutTracker[key] >= 3) {
            console.error(`   ⛔ Skipping ${key} after 3 failures`)
            await supabase.from('globalpc_productos').update({ fraccion_source: 'skip_timeout' }).eq('id', prod.id)
          } else {
            console.error(`   Ollama timeout/error for ${key}: ${e.message} (attempt ${timeoutTracker[key]}/3)`)
          }
        }
        lastId = prod.id
      }

      batchCount++

      // Checkpoint every 500 (10 batches of 50)
      if (batchCount % 10 === 0) {
        saveCP('fraccion_classify', { synced: totalClassified, lastId })
        console.log(`   [checkpoint] ${totalClassified.toLocaleString()} classified, last_id=${lastId}`)
      }

    }

    clearCP('fraccion_classify')
    console.log(`   ✅ Phase 4 complete — ${totalClassified.toLocaleString()} products classified`)
  } catch (e) {
    console.log('⚠️  Ollama error:', e.message, '— skipping Phase 4')
  }

  // ─── DONE ───
  const totalMin = Math.round((Date.now() - t0) / 60000)
  console.log('\n' + '═'.repeat(50))
  console.log(`✅ ALL PHASES COMPLETE — ${totalMin} minutes`)

  // Revalidate portal
  if (process.env.REVALIDATE_SECRET) {
    const paths = ['/', '/traficos', '/entradas', '/pedimentos', '/expedientes', '/cuentas']
    for (const p of paths) {
      try { await fetch(`https://evco-portal.vercel.app/api/revalidate?path=${p}&secret=${process.env.REVALIDATE_SECRET}`) } catch(e) {}
    }
    console.log('✅ Portal revalidated')
  }

  console.log(`📄 Sync completo · ${totalMin} min · MySQL ✅ · eConta ✅ · WSDL ✅ · TIGIE ✅`)
}

// Top-level execution gated on `require.main === module` so this file
// can be `require()`d for unit testing (test/normalize-moneda.test.js
// imports `normalizeMoneda` without firing a real sync).
if (require.main === module) {
  withSyncLog(supabase, { sync_type: 'globalpc', company_id: null }, run).catch(async err => {
    console.error('Fatal error:', err)
    // Operational resilience rule #1 (.claude/rules/operational-resilience.md):
    // sync failures MUST fire Telegram before the morning report. Block EE
    // reference writer — silent death here is SEV-1. Non-blocking: best-effort
    // alert, then exit non-zero so pm2/cron knows it failed.
    try {
      await sendTelegram(
        `🔴 <b>globalpc-sync FAILED</b>\n\n` +
        `<code>${String(err?.message ?? err).slice(0, 500)}</code>\n\n` +
        `Host: ${require('os').hostname()}\n` +
        `Run: ${new Date().toISOString()}`
      )
    } catch (tgErr) {
      console.error('Telegram alert also failed:', tgErr.message)
    }
    process.exit(1)
  })
}

module.exports = { normalizeMoneda }
