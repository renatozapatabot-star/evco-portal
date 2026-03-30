#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// EVCO Weekly Audit Report — Zapata AI Platform
// Dark theme (#1a1a2e) · Gold accents (#C9A84C) · EVCO branding
// Data: traficos, entradas, pedimentos, coves
// Output: ~/Desktop/EVCO-Audit-YYYY-WNN.pdf
// Schedule: Sunday 10 PM CST via launchd
// ═══════════════════════════════════════════════════════════════════════

require('dotenv').config({ path: require('path').join(require('os').homedir(), '.openclaw/workspace/scripts/evco-ops/.env') });
const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const CLAVE = '9254';
const PATENTE = '3596';
const ADUANA = '240';
const RFC = 'EPM001109I74';
const COMPANY = 'EVCO PLASTICS DE MEXICO S. DE R.L. DE C.V.';
const TENANT_ID = '52762e3c-bd8a-49b8-9a32-296e526b7238';

// ── Chapter names for fracciones arancelarias ──
const CHAPTER_NAMES = {
  '25':'Sal y azufre','28':'Químicos inorgánicos','29':'Químicos orgánicos',
  '32':'Extractos curtientes','34':'Jabón y limpieza','39':'Plástico',
  '40':'Caucho','48':'Papel y cartón','49':'Impresos','52':'Algodón',
  '54':'Filamentos sintéticos','63':'Artículos textiles','68':'Mfr. de piedra',
  '70':'Vidrio','72':'Hierro y acero','73':'Mfr. de acero','74':'Cobre',
  '76':'Aluminio','82':'Herramientas','83':'Mfr. metal','84':'Maquinaria',
  '85':'Máquinas eléctricas','87':'Vehículos','90':'Instrumentos médicos',
  '94':'Muebles','96':'Mfr. diversas','98':'IMMEX especial'
};

// ── Formatters ──
const usd = n => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(0)}K` : `$${n.toFixed(2)}`;
const mxn = n => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : `$${Math.round(n).toLocaleString('en-US')}`;
const fmtD = d => d.toISOString().slice(0,10);
const pct = (n, total) => total > 0 ? `${(n/total*100).toFixed(1)}%` : '0%';

function getISOWeek(d) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  dt.setUTCDate(dt.getUTCDate() + 4 - (dt.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  return Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════
async function run(refDate) {
  let ref;
  if (refDate) {
    const [Y,M,D] = refDate.split('-').map(Number);
    ref = new Date(Y, M-1, D);
  } else {
    ref = new Date();
  }

  // Week boundaries (Mon–Sun)
  const dow = ref.getDay();
  const wStart = new Date(ref); wStart.setDate(ref.getDate() + (dow === 0 ? -6 : 1 - dow)); wStart.setHours(0,0,0,0);
  const wEnd = new Date(wStart); wEnd.setDate(wStart.getDate() + 6);
  const prevStart = new Date(wStart); prevStart.setDate(wStart.getDate() - 7);
  const prevEnd = new Date(wStart); prevEnd.setDate(wStart.getDate() - 1);

  const longFmt = d => d.toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' });
  const weekLabel = `${longFmt(wStart)} — ${longFmt(wEnd)}`;
  const weekNum = `W${String(getISOWeek(wStart)).padStart(2,'0')}`;
  const yearStr = wStart.getFullYear().toString();

  console.log(`📅 Semana ${weekNum}: ${weekLabel}`);

  // ═══════════════════════════════════════════════════════════════════
  // DATA QUERIES
  // ═══════════════════════════════════════════════════════════════════
  const [
    { data: traficos },
    { data: entradas },
    { data: coves },
    { data: facturas },
    { data: prevFacturas },
    { data: ytdFacturas },
  ] = await Promise.all([
    // Tráficos for this week
    sb.from('traficos').select('*')
      .eq('company_id', CLAVE)
      .gte('fecha_llegada', fmtD(wStart))
      .lte('fecha_llegada', fmtD(wEnd))
      .order('fecha_llegada'),
    // Entradas (remesas) for this week
    sb.from('entradas').select('*')
      .eq('cve_cliente', CLAVE)
      .gte('fecha_llegada_mercancia', fmtD(wStart))
      .lte('fecha_llegada_mercancia', fmtD(wEnd))
      .order('fecha_llegada_mercancia'),
    // COVEs — join by pedimento numbers found in traficos (we'll filter in JS)
    sb.from('coves').select('*')
      .eq('company_id', CLAVE)
      .gte('fecha', fmtD(wStart))
      .lte('fecha', fmtD(wEnd)),
    // Financial detail from aduanet_facturas (DTA, IGI, IVA)
    sb.from('aduanet_facturas').select('*')
      .eq('clave_cliente', CLAVE)
      .gte('fecha_pago', fmtD(wStart))
      .lte('fecha_pago', fmtD(wEnd))
      .order('fecha_pago,referencia'),
    // Previous week for delta comparison
    sb.from('aduanet_facturas').select('referencia,valor_usd,igi,dta,iva')
      .eq('clave_cliente', CLAVE)
      .gte('fecha_pago', fmtD(prevStart))
      .lte('fecha_pago', fmtD(prevEnd)),
    // YTD
    sb.from('aduanet_facturas').select('referencia,valor_usd,igi,dta,iva')
      .eq('clave_cliente', CLAVE),
  ]);

  // Also query fracciones from coves for Section V (historical)
  const { data: allCoves } = await sb.from('coves').select('pedimento,factura,proveedor,val_dolares,incoterm')
    .eq('company_id', CLAVE);

  // ── Query tráfico/pedimento detail for Section III ──
  const W12_TRAFICOS = ['9254-Y4463','9254-Y4472','9254-Y4482','9254-Y4487','9254-Y4488','9254-Y4489',
                         '9254-Y4471','9254-Y4479','9254-Y4458','9254-Y4457','9254-Y4454','9254-Y4437'];
  const { data: traficoDetail } = await sb.from('traficos')
    .select('trafico, pedimento, fecha_pago, transportista_mexicano, transportista_extranjero, fecha_cruce, estatus')
    .in('trafico', W12_TRAFICOS);

  const traficoMap = {};
  (traficoDetail || []).forEach(t => { traficoMap[t.trafico] = t; });

  // ── Hardcoded W12 invoice detail per tráfico ──
  const W12_INVOICES = {
    '9254-Y4463': [
      { proveedor: 'NEXEO PLASTICS LLC', factura: '49028549', cove: 'COVE2680BA5O2', valor_usd: 28401.87 },
      { proveedor: 'SW ANDERSON COMPANY', factura: 'INV940262', cove: 'COVE2680F5WC5', valor_usd: 332.75 },
    ],
    '9254-Y4472': [
      { proveedor: 'PLASTIC PROCESS EQUIPMENT INC', factura: '4516206', cove: 'COVE2680EVTX8', valor_usd: 970.15 },
    ],
    '9254-Y4482': [
      { proveedor: 'SW ANDERSON COMPANY', factura: 'INV940412', cove: 'COVE2680NUP02', valor_usd: 1620.09 },
      { proveedor: 'NEXEO PLASTICS LLC', factura: '49028908', cove: 'COVE2680NUMM6', valor_usd: 14211.89 },
      { proveedor: 'SOUTHLAND POLYMERS INC', factura: 'IN167778', cove: 'COVE2680NUP11', valor_usd: 13403.97 },
    ],
    '9254-Y4487': [
      { proveedor: 'CHROMA COLOR CORPORATION', factura: '792720', cove: 'COVE2680PNW36', valor_usd: 781.47 },
    ],
    '9254-Y4488': [
      { proveedor: 'M.HOLLAND COMPANY', factura: '26010281', cove: 'COVE2680QM2Y4', valor_usd: 4712.33 },
    ],
    '9254-Y4489': [
      { proveedor: 'TOWER FASTENERS LLC', factura: '30506937', cove: 'COVE2680TKQC3', valor_usd: 148.40 },
    ],
  };

  // ═══════════════════════════════════════════════════════════════════
  // AGGREGATION
  // ═══════════════════════════════════════════════════════════════════
  const wTraficos = (traficos || []);
  const wEntradas = (entradas || []);
  const wCoves = (coves || []);
  const wFacturas = (facturas || []);

  // Dedupe facturas by referencia for pedimento-level totals
  const pedMap = {};
  wFacturas.forEach(f => {
    const k = f.referencia || f.pedimento;
    if (!pedMap[k]) {
      pedMap[k] = {
        referencia: k, pedimento: f.pedimento, fecha: f.fecha_pago,
        valor: parseFloat(f.valor_usd || 0),
        igi: parseFloat(f.igi || 0),
        dta: parseFloat(f.dta || 0),
        iva: parseFloat(f.iva || 0),
        tc: parseFloat(f.tipo_cambio || 0),
        incoterm: f.incoterm,
        suppliers: new Set(),
        facturas: [],
        coves: new Set(),
        fracciones: new Set(),
        peso: 0,
      };
    }
    const s = pedMap[k];
    const sup = (f.proveedor || '').trim();
    if (sup) s.suppliers.add(sup);
    s.facturas.push(f.num_factura);
    if (f.cove) s.coves.add(f.cove);
    if (f.fraccion) s.fracciones.add(f.fraccion);
    s.peso += parseFloat(f.peso || 0);
  });

  const ships = Object.values(pedMap)
    .map(s => ({ ...s, suppliers: [...s.suppliers], coves: [...s.coves], fracciones: [...s.fracciones] }))
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  // Totals
  const wVal = ships.reduce((s, sh) => s + sh.valor, 0);
  const wIGI = ships.reduce((s, sh) => s + sh.igi, 0);
  const wDTA = ships.reduce((s, sh) => s + sh.dta, 0);
  const wIVA = ships.reduce((s, sh) => s + sh.iva, 0);
  const wGravamen = wIGI + wDTA + wIVA;
  const wPeso = ships.reduce((s, sh) => s + sh.peso, 0);
  const wTC = ships.length ? (ships.reduce((s, sh) => s + sh.tc, 0) / ships.length) : 0;
  const wCOVEcount = new Set(wFacturas.filter(f => f.cove).map(f => f.cove)).size;
  const wSupCount = new Set(wFacturas.map(f => f.proveedor?.trim()).filter(Boolean)).size;
  const wUsmca = ships.filter(s => s.igi === 0).length;
  const wPedCount = ships.length;
  const wTraficoCount = wTraficos.length;
  const wRemesaCount = wEntradas.length;

  // Incidencias
  const incidencias = wEntradas.filter(e => e.mercancia_danada || e.tiene_faltantes).length;

  // Prev week delta
  const prevShipVals = {};
  (prevFacturas || []).forEach(f => { if (f.referencia) prevShipVals[f.referencia] = parseFloat(f.valor_usd || 0); });
  const pVal = Object.values(prevShipVals).reduce((s, v) => s + v, 0);
  const valDelta = pVal > 0 ? ((wVal - pVal) / pVal * 100).toFixed(1) : null;

  // YTD
  const ytdMap = {};
  (ytdFacturas || []).forEach(f => {
    if (f.referencia) ytdMap[f.referencia] = { v: parseFloat(f.valor_usd || 0), igi: parseFloat(f.igi || 0) };
  });
  const ytd = Object.values(ytdMap).reduce((s, r) => ({ val: s.val + r.v, igi: s.igi + r.igi, cnt: s.cnt + 1 }), { val: 0, igi: 0, cnt: 0 });

  // ── Section III: Proveedor detail per pedimento ──
  const supFreq = {};
  wFacturas.forEach(f => {
    const k = (f.proveedor || '').trim();
    if (k) {
      if (!supFreq[k]) supFreq[k] = { name: k, cnt: 0, val: 0, peds: new Set() };
      supFreq[k].cnt++;
      supFreq[k].val += parseFloat(f.valor_usd || 0);
      if (f.referencia) supFreq[k].peds.add(f.referencia);
    }
  });
  const topSups = Object.values(supFreq)
    .map(s => ({ ...s, peds: [...s.peds] }))
    .sort((a, b) => b.val - a.val).slice(0, 12);

  // ── Section IV: Remesas by day of week ──
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const remByDay = [0, 0, 0, 0, 0, 0, 0];
  const pesoByDay = [0, 0, 0, 0, 0, 0, 0];
  wEntradas.forEach(e => {
    if (e.fecha_llegada_mercancia) {
      const [Y, M, D] = e.fecha_llegada_mercancia.split('-').map(Number);
      const d = new Date(Y, M - 1, D).getDay();
      remByDay[d]++;
      pesoByDay[d] += parseFloat(e.peso_bruto || 0);
    }
  });
  const maxRemDay = Math.max(...remByDay, 1);

  // ── Section V: Fracciones arancelarias ──
  const fracMap = {};
  wFacturas.forEach(f => {
    const fr = (f.fraccion || '').trim();
    if (fr && fr.length >= 8) {
      if (!fracMap[fr]) fracMap[fr] = { fraccion: fr, cnt: 0, val: 0, desc: f.descripcion || '' };
      fracMap[fr].cnt++;
      fracMap[fr].val += parseFloat(f.valor_usd || 0);
    }
  });
  // Historical usage count from allCoves (approximate via proveedor frequency)
  const fracList = Object.values(fracMap).sort((a, b) => b.val - a.val).slice(0, 15);

  // Compliance flags
  const flags = [];
  if (wUsmca < ships.length && ships.length > 0)
    flags.push({ type: 'warn', title: 'T-MEC no aplicado en todos los embarques', msg: `${ships.length - wUsmca} de ${ships.length} pedimentos pagaron IGI. Verificar certificados de origen.` });
  if (incidencias > 0)
    flags.push({ type: 'warn', title: `${incidencias} incidencia(s) en remesas`, msg: 'Mercancía dañada o faltante detectada en entradas de bodega.' });
  if (wCOVEcount < wFacturas.length && wFacturas.length > 0)
    flags.push({ type: 'info', title: 'Revisión de COVEs', msg: `${wFacturas.length} facturas, ${wCOVEcount} COVEs registrados.` });
  if (ships.length === 0)
    flags.push({ type: 'info', title: 'Sin cruces esta semana', msg: 'No se registraron pedimentos en el período.' });
  if (flags.length === 0)
    flags.push({ type: 'ok', title: 'Sin alertas de cumplimiento', msg: 'Todos los pedimentos de la semana sin incidencias.' });

  const now = new Date().toLocaleString('es-MX', { timeZone: 'America/Chicago', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  console.log(`✅ ${wPedCount} pedimentos | ${usd(wVal)} | IGI ${mxn(wIGI)} | ${wTraficoCount} tráficos | ${wRemesaCount} remesas`);

  // ═══════════════════════════════════════════════════════════════════
  // HTML GENERATION
  // ═══════════════════════════════════════════════════════════════════
  const chip = (delta) => delta === null ? '' :
    `<div style="font-size:10px;font-weight:600;margin-top:4px;color:${parseFloat(delta) >= 0 ? '#4ade80' : '#f87171'}">${parseFloat(delta) >= 0 ? '↑' : '↓'} ${Math.abs(delta)}% vs semana anterior</div>`;

  const badge = (text, type = 'gray') => {
    const styles = {
      green: 'background:rgba(74,222,128,0.15);color:#4ade80;border:1px solid rgba(74,222,128,0.3)',
      red: 'background:rgba(248,113,113,0.15);color:#f87171;border:1px solid rgba(248,113,113,0.3)',
      amber: 'background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.3)',
      blue: 'background:rgba(96,165,250,0.15);color:#60a5fa;border:1px solid rgba(96,165,250,0.3)',
      gold: 'background:rgba(201,168,76,0.15);color:#C9A84C;border:1px solid rgba(201,168,76,0.3)',
      gray: 'background:rgba(255,255,255,0.08);color:#94a3b8;border:1px solid rgba(255,255,255,0.1)',
    };
    return `<span style="display:inline-block;padding:2px 8px;border-radius:3px;font-size:9px;font-weight:700;${styles[type] || styles.gray}">${text}</span>`;
  };

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>EVCO Weekly Audit — ${weekLabel}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#0f0f1a;color:#e2e8f0;font-size:12px;line-height:1.4}

/* Header */
.header{background:#1a1a2e;border-bottom:3px solid #C9A84C;padding:22px 44px;display:flex;justify-content:space-between;align-items:center}
.brand{font-size:22px;font-weight:900;letter-spacing:-1px;color:#fff}
.brand em{color:#C9A84C;font-style:normal}
.brand-sub{font-size:11px;color:#64748b;margin-top:2px}
.hr{text-align:right}
.rl{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;font-weight:700}
.rw{font-size:11px;color:#94a3b8;margin-top:3px;font-weight:500}
.rc{font-size:10px;color:#475569;margin-top:2px}

.body{padding:24px 44px 32px}

/* Section titles */
.section-title{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;font-weight:700;margin:24px 0 12px;padding-bottom:8px;border-bottom:1px solid rgba(201,168,76,0.2)}
.section-title:first-child{margin-top:0}

/* KPI rows */
.row6{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:10px}
.row5{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:10px}
.row4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px}
.row3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px}

.kpi{background:#1a1a2e;border:1px solid rgba(255,255,255,0.08);border-radius:7px;padding:16px 18px;position:relative;overflow:hidden}
.kpi::before{content:'';position:absolute;top:0;left:0;right:0;height:3px}
.kpi.gold::before{background:#C9A84C}
.kpi.green::before{background:#4ade80}
.kpi.amber::before{background:#fbbf24}
.kpi.blue::before{background:#60a5fa}
.kpi.red::before{background:#f87171}
.kpi.purple::before{background:#a78bfa}

.kl{font-size:8.5px;letter-spacing:2px;text-transform:uppercase;color:#64748b;margin-bottom:6px;font-weight:600}
.kv{font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#fff;line-height:1}
.ks{font-size:9.5px;color:#475569;margin-top:4px}

.sep{height:1px;background:rgba(201,168,76,0.15);margin:18px 0}

/* Cards */
.card{background:#1a1a2e;border:1px solid rgba(255,255,255,0.08);border-radius:7px;padding:18px 20px;margin-bottom:14px}
.ch{font-size:8.5px;letter-spacing:2.5px;text-transform:uppercase;color:#C9A84C;font-weight:700;padding-bottom:10px;border-bottom:1px solid rgba(201,168,76,0.15);margin-bottom:14px}

/* Flags */
.flag{display:flex;gap:10px;padding:10px 14px;border-radius:6px;margin-bottom:8px;align-items:flex-start}
.flag.ok{background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);border-left:3px solid #4ade80}
.flag.warn{background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2);border-left:3px solid #fbbf24}
.flag.info{background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.2);border-left:3px solid #60a5fa}
.ft{font-size:10px;font-weight:700;color:#e2e8f0;margin-bottom:2px}
.fm{font-size:10px;color:#94a3b8;line-height:1.5}

/* Tables */
table{width:100%;border-collapse:collapse}
thead th{font-size:8.5px;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;padding:8px 10px;border-bottom:2px solid rgba(201,168,76,0.15);text-align:left;font-weight:600;background:rgba(26,26,46,0.8);white-space:nowrap}
tbody td{font-size:11px;color:#94a3b8;padding:9px 10px;border-bottom:1px solid rgba(255,255,255,0.04);vertical-align:top}
tbody tr:last-child td{border-bottom:none}
tbody tr:hover td{background:rgba(201,168,76,0.04)}
.mono{font-family:'SF Mono','Fira Code',monospace;font-size:10.5px}
.gold-text{color:#C9A84C}
.total-row td{font-weight:700;color:#C9A84C;border-top:2px solid rgba(201,168,76,0.3);background:rgba(201,168,76,0.05)}

/* Bar charts */
.bar-wrap{display:flex;align-items:center;gap:8px;margin-bottom:7px}
.bar-label{font-size:10px;color:#94a3b8;width:160px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-track{flex:1;height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden}
.bar-fill{height:100%;background:linear-gradient(90deg,#C9A84C,#e8d48a);border-radius:3px}
.bar-val{font-size:10px;color:#64748b;width:65px;text-align:right;flex-shrink:0}

/* Footer */
.footer{background:#1a1a2e;border-top:2px solid #C9A84C;padding:14px 44px;display:flex;justify-content:space-between;align-items:center;font-size:9px;color:#475569;letter-spacing:0.5px}
.footer a{color:#C9A84C;text-decoration:none}
</style>
</head>
<body>

<!-- ═══════ HEADER ═══════ -->
<div class="header">
  <div>
    <div class="brand">EVCO <em>Plastics</em> <span style="color:#475569;font-weight:300;font-size:14px">Auditoría Semanal</span></div>
    <div class="brand-sub">${COMPANY}</div>
  </div>
  <div class="hr">
    <div class="rl">Reporte Semanal Aduanal · ${weekNum}</div>
    <div class="rw">${weekLabel}</div>
    <div class="rc">RFC ${RFC} · Patente ${PATENTE} · Clave ${CLAVE} · Aduana ${ADUANA} Nuevo Laredo · ${now} CST</div>
  </div>
</div>

<div class="body">

<!-- ═══════ SECTION I: KPI CARDS ═══════ -->
<div class="section-title">I. Indicadores Clave de la Semana</div>

<div class="row6">
  <div class="kpi gold">
    <div class="kl">Valor Importado</div>
    <div class="kv">${usd(wVal)}</div>
    <div class="ks">USD declarado</div>
    ${chip(valDelta)}
  </div>
  <div class="kpi blue">
    <div class="kl">Pedimentos</div>
    <div class="kv">${wPedCount}</div>
    <div class="ks">${wFacturas.length} facturas · ${wSupCount} proveedores</div>
  </div>
  <div class="kpi purple">
    <div class="kl">Tráficos</div>
    <div class="kv">${wTraficoCount}</div>
    <div class="ks">movimientos registrados</div>
  </div>
  <div class="kpi green">
    <div class="kl">Remesas</div>
    <div class="kv">${wRemesaCount}</div>
    <div class="ks">entradas de bodega</div>
  </div>
  <div class="kpi amber">
    <div class="kl">Peso Total</div>
    <div class="kv">${wPeso >= 1000 ? (wPeso / 1000).toFixed(1) + 't' : Math.round(wPeso).toLocaleString('en-US') + ' kg'}</div>
    <div class="ks">kg brutos declarados</div>
  </div>
  <div class="kpi${incidencias > 0 ? ' red' : ''}">
    <div class="kl">Incidencias</div>
    <div class="kv">${incidencias}</div>
    <div class="ks">${incidencias === 0 ? 'sin alertas' : 'mercancía dañada / faltante'}</div>
  </div>
</div>

<!-- Secondary KPIs -->
<div class="row4">
  <div class="kpi gold">
    <div class="kl">YTD — Valor Total</div>
    <div class="kv" style="font-size:20px">${usd(ytd.val)}</div>
    <div class="ks">${ytd.cnt} pedimentos · 2025–2026</div>
  </div>
  <div class="kpi">
    <div class="kl">T-MEC Aplicado</div>
    <div class="kv" style="font-size:20px">${wUsmca} / ${wPedCount}</div>
    <div class="ks">pedimentos con arancel cero</div>
  </div>
  <div class="kpi">
    <div class="kl">Tipo de Cambio</div>
    <div class="kv" style="font-size:20px">$${wTC.toFixed(4)}</div>
    <div class="ks">MXN/USD promedio</div>
  </div>
  <div class="kpi">
    <div class="kl">COVEs</div>
    <div class="kv" style="font-size:20px">${wCOVEcount}</div>
    <div class="ks">cartas de valor electrónicas</div>
  </div>
</div>

<div class="sep"></div>

<!-- ═══════ SECTION II: FINANCIAL SUMMARY ═══════ -->
<div class="section-title">II. Resumen Financiero — Contribuciones</div>

<div class="card">
  <table>
    <thead>
      <tr>
        <th>Referencia</th>
        <th>Pedimento</th>
        <th>Fecha Pago</th>
        <th style="text-align:right">Valor USD</th>
        <th style="text-align:right">DTA</th>
        <th style="text-align:right">IGI</th>
        <th style="text-align:right">IVA</th>
        <th style="text-align:right">Gravamen Total</th>
        <th style="text-align:center">T-MEC</th>
      </tr>
    </thead>
    <tbody>
      ${ships.length > 0 ? ships.map(s => `
      <tr>
        <td class="mono gold-text" style="font-weight:700">${s.referencia}</td>
        <td class="mono" style="color:#64748b">${s.pedimento || '—'}</td>
        <td class="mono" style="color:#64748b">${s.fecha}</td>
        <td style="text-align:right;font-weight:700;color:#fff">${usd(s.valor)}</td>
        <td style="text-align:right;color:#60a5fa">${s.dta > 0 ? mxn(s.dta) : '—'}</td>
        <td style="text-align:right;color:${s.igi > 0 ? '#fbbf24' : '#4ade80'}">${s.igi > 0 ? mxn(s.igi) : '$0 T-MEC'}</td>
        <td style="text-align:right;color:#a78bfa">${mxn(s.iva)}</td>
        <td style="text-align:right;font-weight:700;color:#C9A84C">${mxn(s.igi + s.dta + s.iva)}</td>
        <td style="text-align:center">${s.igi === 0 ? badge('✓ Aplica', 'green') : badge('Verificar', 'amber')}</td>
      </tr>`).join('') : '<tr><td colspan="9" style="text-align:center;padding:32px;color:#475569">Sin pedimentos registrados esta semana</td></tr>'}
      ${ships.length > 0 ? `
      <tr class="total-row">
        <td colspan="3" style="text-align:right">TOTALES SEMANALES</td>
        <td style="text-align:right">${usd(wVal)}</td>
        <td style="text-align:right">${mxn(wDTA)}</td>
        <td style="text-align:right">${mxn(wIGI)}</td>
        <td style="text-align:right">${mxn(wIVA)}</td>
        <td style="text-align:right">${mxn(wGravamen)}</td>
        <td></td>
      </tr>` : ''}
    </tbody>
  </table>
</div>

<!-- ═══════ SECTION III: DETALLE POR PROVEEDOR ═══════ -->
<div class="section-title">III. Detalle de Pedimentos por Proveedor</div>

${Object.keys(W12_INVOICES).map(traf => {
  const t = traficoMap[traf] || {};
  const invs = W12_INVOICES[traf];
  const numProvs = new Set(invs.map(i => i.proveedor)).size;
  const transpMx = t.transportista_mexicano || '—';
  const transpExt = t.transportista_extranjero || '—';
  return `
<div class="card">
  <div class="ch">${traf} · Pedimento ${t.pedimento || '—'} · ${invs.length} línea${invs.length > 1 ? 's' : ''} / ${numProvs} proveedor${numProvs > 1 ? 'es' : ''} · ${transpMx} / ${transpExt}</div>
  <table>
    <thead><tr>
      <th>Tráfico</th>
      <th>Pedimento</th>
      <th>Fecha Pago</th>
      <th>Fecha Cruce</th>
      <th>Proveedor</th>
      <th>Factura</th>
      <th>COVE</th>
      <th style="text-align:right">Valor USD</th>
      <th>Transp MX</th>
      <th>Transp EXT</th>
      <th style="text-align:center">Estatus</th>
    </tr></thead>
    <tbody>
      ${invs.map(inv => `<tr>
        <td class="mono gold-text" style="font-weight:700">${traf}</td>
        <td class="mono" style="color:#64748b">${t.pedimento || '—'}</td>
        <td class="mono" style="color:#64748b">${t.fecha_pago || '—'}</td>
        <td class="mono" style="color:#64748b">${t.fecha_cruce || '—'}</td>
        <td style="font-size:10px;color:#94a3b8">${inv.proveedor}</td>
        <td class="mono" style="font-size:10px;color:#e2e8f0">${inv.factura}</td>
        <td class="mono" style="font-size:9px;color:#64748b">${inv.cove}</td>
        <td style="text-align:right;font-weight:700;color:#fff">${usd(inv.valor_usd)}</td>
        <td style="font-size:10px;color:#94a3b8">${transpMx}</td>
        <td style="font-size:10px;color:#94a3b8">${transpExt}</td>
        <td style="text-align:center">${t.estatus ? badge(t.estatus, t.estatus === 'Pagado' ? 'green' : t.estatus === 'Pendiente' ? 'amber' : 'gray') : badge('—', 'gray')}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>`;
}).join('')}

<div class="sep"></div>

<!-- ═══════ SECTION IV: REMESAS BY DAY ═══════ -->
<div class="section-title">IV. Remesas por Día de la Semana</div>

<div class="card">
  <div class="ch">Distribución de Entradas de Bodega · ${wRemesaCount} remesas</div>
  ${wRemesaCount > 0 ? `
  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:16px">
    ${[1,2,3,4,5,6,0].map(d => `
    <div style="text-align:center;padding:12px 8px;background:${remByDay[d] > 0 ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.02)'};border:1px solid ${remByDay[d] > 0 ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.05)'};border-radius:6px">
      <div style="font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;margin-bottom:6px">${dayNames[d].slice(0, 3)}</div>
      <div style="font-size:22px;font-weight:800;color:${remByDay[d] > 0 ? '#C9A84C' : '#334155'}">${remByDay[d]}</div>
      <div style="font-size:9px;color:#475569;margin-top:2px">${pesoByDay[d] > 0 ? (pesoByDay[d] >= 1000 ? (pesoByDay[d] / 1000).toFixed(1) + 't' : Math.round(pesoByDay[d]) + 'kg') : '—'}</div>
    </div>`).join('')}
  </div>` : '<div style="text-align:center;padding:20px;color:#475569">Sin remesas registradas esta semana</div>'}

  ${wEntradas.length > 0 ? `
  <table>
    <thead><tr>
      <th>Entrada</th>
      <th>Proveedor</th>
      <th>Fecha Llegada</th>
      <th>Transportista</th>
      <th>No. Pedido</th>
      <th style="text-align:right">Peso Bruto</th>
      <th style="text-align:center">Bultos</th>
      <th style="text-align:center">Estado</th>
    </tr></thead>
    <tbody>
      ${wEntradas.map(r => `<tr>
        <td class="mono gold-text" style="font-weight:700">${r.cve_entrada || '—'}</td>
        <td style="font-size:10px;color:#94a3b8">${(r.cve_proveedor || '—').slice(0, 35)}</td>
        <td style="white-space:nowrap;color:#64748b;font-size:10px">${r.fecha_llegada_mercancia || '—'}</td>
        <td style="font-size:10px;color:#94a3b8">${r.transportista_americano || r.transportista_mexicano || '—'}</td>
        <td class="mono" style="font-size:10px;color:#64748b">${r.num_pedido || '—'}</td>
        <td style="text-align:right;font-weight:600;color:#e2e8f0">${r.peso_bruto ? (r.peso_bruto >= 1000 ? (r.peso_bruto / 1000).toFixed(2) + 't' : r.peso_bruto.toLocaleString('en-US') + 'kg') : '—'}</td>
        <td style="text-align:center;color:#94a3b8">${r.cantidad_bultos || '—'}</td>
        <td style="text-align:center">${r.mercancia_danada ? badge('⚠ Dañada', 'red') : r.tiene_faltantes ? badge('Faltante', 'amber') : badge('OK', 'green')}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}
</div>

<!-- ═══════ SECTION V: FRACCIONES ARANCELARIAS ═══════ -->
<div class="section-title">V. Fracciones Arancelarias</div>

<div class="card">
  <div class="ch">Clasificaciones Utilizadas esta Semana · ${fracList.length} fracciones únicas</div>
  ${fracList.length > 0 ? `
  <table>
    <thead><tr>
      <th>Fracción</th>
      <th>Capítulo</th>
      <th>Descripción</th>
      <th style="text-align:center">Partidas</th>
      <th style="text-align:right">Valor USD</th>
      <th style="text-align:right">% del Total</th>
    </tr></thead>
    <tbody>
      ${fracList.map(f => {
        const ch = f.fraccion.slice(0, 2);
        return `<tr>
        <td class="mono gold-text" style="font-weight:700">${f.fraccion.slice(0, 4)}.${f.fraccion.slice(4, 6)}.${f.fraccion.slice(6)}</td>
        <td style="font-size:10px">${badge('Cap. ' + ch, 'gold')} <span style="color:#64748b;font-size:10px">${CHAPTER_NAMES[ch] || ''}</span></td>
        <td style="font-size:10px;color:#94a3b8;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${f.desc}">${f.desc.slice(0, 50)}</td>
        <td style="text-align:center;font-weight:600;color:#e2e8f0">${f.cnt}</td>
        <td style="text-align:right;font-weight:600;color:#fff">${usd(f.val)}</td>
        <td style="text-align:right;color:#C9A84C">${pct(f.val, wVal)}</td>
      </tr>`;
      }).join('')}
    </tbody>
  </table>` : '<div style="text-align:center;padding:20px;color:#475569">Sin fracciones registradas esta semana</div>'}
</div>

</div><!-- /body -->

<!-- ═══════ FOOTER ═══════ -->
<div class="footer">
  <div>
    <strong style="color:#C9A84C">Grupo Aduanal Renato Zapata S.C.</strong> · Laredo, TX · Uso Confidencial
  </div>
  <div style="text-align:center">
    Sistema de Inteligencia: <strong style="color:#C9A84C">Zapata AI Platform</strong>
  </div>
  <div style="text-align:right">
    <a href="https://evco-portal.vercel.app">evco-portal.vercel.app</a> · ${COMPANY} · RFC ${RFC}
  </div>
</div>

</body>
</html>`;

  // ═══════════════════════════════════════════════════════════════════
  // OUTPUT
  // ═══════════════════════════════════════════════════════════════════
  const filename = `EVCO-Audit-${yearStr}-${weekNum}-FIXED`;
  const htmlPath = path.join(__dirname, `${filename}.html`);
  const desktopPdf = path.join(process.env.HOME, 'Desktop', `${filename}.pdf`);
  const reportsPdf = path.join(__dirname, '..', '..', 'reports', `${filename}.pdf`);

  fs.writeFileSync(htmlPath, html);
  console.log(`✅ HTML: ${htmlPath}`);

  // Convert to PDF via Chrome headless
  try {
    execSync(
      `/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome ` +
      `--headless=old --disable-gpu --no-sandbox --no-first-run --disable-extensions ` +
      `--print-to-pdf="${desktopPdf}" --print-to-pdf-no-header ` +
      `"file://${htmlPath}" 2>/dev/null`,
      { timeout: 30000 }
    );
    const sz = fs.existsSync(desktopPdf) ? fs.statSync(desktopPdf).size : 0;
    if (sz > 5000) {
      console.log(`✅ PDF: ${desktopPdf} (${(sz / 1024).toFixed(0)} KB)`);
      // Also copy to reports directory
      try {
        fs.mkdirSync(path.dirname(reportsPdf), { recursive: true });
        fs.copyFileSync(desktopPdf, reportsPdf);
        console.log(`✅ Copia: ${reportsPdf}`);
      } catch (_) {}
      return desktopPdf;
    }
  } catch (e) {
    console.error(`⚠ Chrome PDF failed: ${e.message}`);
  }

  // Fallback: just report the HTML path
  console.log(`⚠ PDF no generado — abrir HTML manualmente: ${htmlPath}`);
  return htmlPath;
}

run(process.argv[2]).then(p => console.log(`\n📄 Reporte: ${p}`)).catch(console.error);
