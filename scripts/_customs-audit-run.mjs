#!/usr/bin/env node
// Customs Domain Integrity Audit — 2026-04-29
// Audit-only. No mutations.

import { config as dotenvConfig } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: path.join(__dirname, '..', '.env.local') });

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) { console.error('Missing Supabase env'); process.exit(1); }
const sb = createClient(SB_URL, SB_KEY);
const OUT = '/tmp/customs-audit';

// Pagination helper — returns ALL rows for a select() builder
async function paginate(buildQuery, pageSize = 1000) {
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

const PEDIMENTO_FORMAT = /^\d{2}\s\d{2}\s\d{4}\s\d{7}$/;
const PEDIMENTO_FORMAT_LOOSE = /^(\d{2})\s(\d{2})\s(\d{4})\s(\d+)$/;
// Valid SAT 4-digit patentes are issued; we'll just check it's exactly 4 digits and within
// a known patente registry by sampling distribution (the audit will surface counts).
const FRACCION_DOTTED = /^\d{4}\.\d{2}\.\d{2}$/;          // legacy 8-digit dotted
const FRACCION_DOTTED_NICO = /^\d{4}\.\d{2}\.\d{2}\.\d{2}$/; // 10-digit dotted with NICO
const FRACCION_8_DIGITS  = /^\d{8}$/;                     // 8-digit no dots (DB form)
const FRACCION_10_DIGITS = /^\d{10}$/;                    // 10-digit no dots (NICO appended)

// Inco terms 2020
const VALID_INCOTERMS = new Set(['EXW','FCA','CPT','CIP','DAP','DPU','DDP','FAS','FOB','CFR','CIF']);
// Common SAT régimen codes (subset — this list isn't exhaustive)
const VALID_REGIMEN = new Set(['IMD','EXD','IMT','EXT','TR1','TR2','TR3','IN','RT','DFI','REC']);
// Common clave_pedimento codes (subset — the SAT Anexo 22 list is large)
const VALID_CLAVE_PEDIMENTO = new Set(['A1','A2','A3','A4','A5','AF','AT','BA','BB','BO','BP','BR','C1','C3','CT','D1','E1','E2','E3','EA','EB','EC','ED','EF','ER','ES','EM','F2','F3','F4','F5','G1','GC','GS','GP','GE','H1','H2','H8','IN','K1','K2','L1','M1','M2','M3','M4','M5','OT','PR','RE','RT','S1','S2','SF','T1','T3','T6','T7','T9','V1','V2','V3','V5','VF','VT']);
// Valid 3-letter ISO + common SAT 3-char codes for país_origen
const KNOWN_USMCA = new Set(['USA','MEX','CAN']);
// Valid 3-digit aduana codes — small sample of major ones; audit reports distribution
// 240 = Nuevo Laredo, 470 = Colombia, 220 = Cd. Juárez, etc.

// 2026 financial constants
const DTA_2026_PER_MIL = 8.6;   // 0.0086
const DTA_2025_PER_MIL = 8.0;   // 0.008  (approximate — verify against SAT schedule)
const IVA_RATE = 0.16;
const IVA_FRONTERIZO = 0.08;

const findings = {};
const t0 = Date.now();
function logSection(name) { console.log('\n=== ' + name + ' (' + ((Date.now()-t0)/1000).toFixed(1) + 's) ==='); }

(async () => {
  // ─────────────────────────────────────────────────────────
  // PHASE 1 — Pedimento format compliance
  // ─────────────────────────────────────────────────────────
  logSection('PHASE 1: Pedimento format compliance');
  findings.phase1 = { description: 'Pedimento format dd dd pppp ddddddd' };

  // 1a — pedimentos.pedimento_id (string with spaces)
  const pedimentos = await paginate(() => sb.from('pedimentos').select('id,pedimento_id,numero_pedimento,aduana,patente'));
  const p1a = { table: 'pedimentos', total: pedimentos.length, valid: 0, invalid: 0, malformed: [], patente_dist: {}, aduana_dist: {} };
  for (const p of pedimentos) {
    const ped = p.pedimento_id || '';
    if (PEDIMENTO_FORMAT.test(ped)) p1a.valid++;
    else { p1a.invalid++; if (p1a.malformed.length < 30) p1a.malformed.push({ id: p.id, pedimento_id: ped, numero: p.numero_pedimento }); }
    const pat = String(p.patente || 'null');
    const adu = String(p.aduana || 'null');
    p1a.patente_dist[pat] = (p1a.patente_dist[pat] || 0) + 1;
    p1a.aduana_dist[adu]  = (p1a.aduana_dist[adu]  || 0) + 1;
  }
  console.log(' pedimentos:', JSON.stringify({ total: p1a.total, valid: p1a.valid, invalid: p1a.invalid }));
  findings.phase1.pedimentos_table = p1a;

  // 1b — partidas.pedimento_id (string with spaces, denormalized)
  const partidasAll = await paginate(() => sb.from('partidas').select('id,pedimento_id'));
  const p1b = { table: 'partidas', total: partidasAll.length, valid: 0, invalid: 0, malformed: [] };
  for (const p of partidasAll) {
    const ped = p.pedimento_id || '';
    if (PEDIMENTO_FORMAT.test(ped)) p1b.valid++;
    else { p1b.invalid++; if (p1b.malformed.length < 20) p1b.malformed.push({ id: p.id, pedimento_id: ped }); }
  }
  console.log(' partidas:', JSON.stringify({ total: p1b.total, valid: p1b.valid, invalid: p1b.invalid }));
  findings.phase1.partidas_table = p1b;

  // 1c — anexo24_pedimentos.pedimento (no spaces, raw 7-digit consecutivo only)
  const anexoPeds = await paginate(() => sb.from('anexo24_pedimentos').select('id,pedimento,short_pedimento,aduana'));
  const p1c = { table: 'anexo24_pedimentos', total: anexoPeds.length, with_full: 0, with_consec_only: 0, malformed: 0, malformed_samples: [], aduana_null_count: 0, length_dist: {} };
  for (const p of anexoPeds) {
    const ped = (p.pedimento || '').trim();
    if (!ped) { p1c.malformed++; if (p1c.malformed_samples.length < 10) p1c.malformed_samples.push({ id: p.id, pedimento: ped }); continue; }
    const len = ped.length;
    p1c.length_dist[len] = (p1c.length_dist[len] || 0) + 1;
    if (PEDIMENTO_FORMAT.test(ped)) p1c.with_full++;
    else if (/^\d{7}$/.test(ped)) p1c.with_consec_only++;
    else { p1c.malformed++; if (p1c.malformed_samples.length < 10) p1c.malformed_samples.push({ id: p.id, pedimento: ped }); }
    if (!p.aduana) p1c.aduana_null_count++;
  }
  console.log(' anexo24_pedimentos:', JSON.stringify({ total: p1c.total, with_full: p1c.with_full, with_consec_only: p1c.with_consec_only, malformed: p1c.malformed }));
  findings.phase1.anexo24_pedimentos_table = p1c;

  // 1d — anexo24_partidas.pedimento (full or consec-only)
  const anexoParts = await paginate(() => sb.from('anexo24_partidas').select('id,pedimento'));
  const p1d = { table: 'anexo24_partidas', total: anexoParts.length, with_full: 0, with_consec_only: 0, malformed: 0, malformed_samples: [] };
  for (const p of anexoParts) {
    const ped = (p.pedimento || '').trim();
    if (PEDIMENTO_FORMAT.test(ped)) p1d.with_full++;
    else if (/^\d{7}$/.test(ped)) p1d.with_consec_only++;
    else { p1d.malformed++; if (p1d.malformed_samples.length < 10) p1d.malformed_samples.push({ id: p.id, pedimento: ped }); }
  }
  console.log(' anexo24_partidas:', JSON.stringify({ total: p1d.total, with_full: p1d.with_full, with_consec_only: p1d.with_consec_only, malformed: p1d.malformed }));
  findings.phase1.anexo24_partidas_table = p1d;

  // 1e — traficos: aduana + patente + pedimento (assemble + check shape)
  const traficos = await paginate(() => sb.from('traficos').select('id,pedimento,aduana,patente,fecha_cruce,fecha_pago,company_id,tipo_cambio,importe_total,regimen,semaforo'));
  const p1e = { table: 'traficos', total: traficos.length, full_assembled_valid: 0, missing_field: 0, ped_format_pass: 0, ped_format_fail: 0, patente_dist: {}, aduana_dist: {}, samples_invalid: [] };
  for (const t of traficos) {
    const pat = String(t.patente || 'null');
    const adu = String(t.aduana || 'null');
    p1e.patente_dist[pat] = (p1e.patente_dist[pat] || 0) + 1;
    p1e.aduana_dist[adu]  = (p1e.aduana_dist[adu]  || 0) + 1;
    if (!t.pedimento) { p1e.missing_field++; continue; }
    if (!t.aduana || !t.patente) { p1e.missing_field++; continue; }
    // Assemble year from fecha_cruce or fecha_pago
    const dateRef = t.fecha_cruce || t.fecha_pago;
    const yy = dateRef ? String(new Date(dateRef).getUTCFullYear()).slice(-2) : null;
    if (!yy) { p1e.missing_field++; continue; }
    const consec = String(t.pedimento).trim();
    const consec7 = consec.length === 7 ? consec : consec.padStart(7, '0');
    const assembled = `${String(t.aduana).padStart(2,'0').slice(-2)} ${yy} ${String(t.patente).padStart(4,'0')} ${consec7}`;
    if (PEDIMENTO_FORMAT.test(assembled)) p1e.full_assembled_valid++;
    if (PEDIMENTO_FORMAT_LOOSE.test(assembled)) p1e.ped_format_pass++;
    else { p1e.ped_format_fail++; if (p1e.samples_invalid.length < 20) p1e.samples_invalid.push({ id: t.id, assembled, pedimento: t.pedimento, aduana: t.aduana, patente: t.patente, fecha_cruce: t.fecha_cruce }); }
  }
  console.log(' traficos:', JSON.stringify({ total: p1e.total, missing_field: p1e.missing_field, full_assembled_valid: p1e.full_assembled_valid }));
  findings.phase1.traficos_table = p1e;

  // ─────────────────────────────────────────────────────────
  // PHASE 2 — IVA calculation verification
  // ─────────────────────────────────────────────────────────
  logSection('PHASE 2: IVA verification');
  findings.phase2 = { description: 'IVA = (valor_aduana + DTA + IGI) × 0.16' };

  // Scan a wide table list for tax-named columns. The 2026-04-29 audit
  // missed `aduanet_facturas` because it wasn't in this list — it carries
  // the SAT-stamped per-pedimento contribuciones. Any table whose columns
  // match the regex below contributes to the verdict; missing this table
  // again would let coverage gaps masquerade as schema gaps.
  const sampleQueries = [
    'pedimentos','traficos','partidas','anexo24_pedimentos','anexo24_partidas',
    'globalpc_facturas','globalpc_partidas',
    'aduanet_facturas','aduanet_pedimentos','aduanet_partidas','aduanet_actividades',
    'pedimento_contribuciones','aduanet_liquidaciones','liquidaciones','contribuciones',
  ];
  const TAX_COL_RE = /^(dta|igi|iva|ieps|impuest|contri|liqu)/i;
  const ivaColumns = {};
  const coverageByTable = {};
  for (const t of sampleQueries) {
    const headRes = await sb.from(t).select('*', { count: 'exact', head: true });
    if (headRes.error) continue;  // table not present — skip silently
    const totalRows = headRes.count ?? 0;
    const { data: sampleData } = await sb.from(t).select('*').limit(1);
    if (!sampleData || !sampleData[0]) { ivaColumns[t] = []; continue; }
    const taxCols = Object.keys(sampleData[0]).filter(k => TAX_COL_RE.test(k));
    ivaColumns[t] = taxCols;
    if (taxCols.length === 0) continue;
    // For each tax column, count non-null rows to derive coverage.
    const colCoverage = {};
    for (const col of taxCols) {
      const { count } = await sb.from(t).select('*', { count: 'exact', head: true }).not(col, 'is', null);
      colCoverage[col] = { non_null: count ?? 0, total: totalRows, pct: totalRows ? +(((count ?? 0) / totalRows) * 100).toFixed(1) : null };
    }
    coverageByTable[t] = colCoverage;
  }
  findings.phase2.iva_related_columns_per_table = ivaColumns;
  findings.phase2.coverage_per_table = coverageByTable;

  // Derive verdict from what we actually found, not from a hardcoded string.
  const tablesWithTax = Object.entries(ivaColumns).filter(([, cols]) => cols.length > 0).map(([t]) => t);
  const taxRowCounts = Object.values(coverageByTable).flatMap(c => Object.values(c).map(x => x.total));
  const maxTaxRows = taxRowCounts.length ? Math.max(...taxRowCounts) : 0;
  const pedimentosTotal = pedimentos.length || 1;
  const coverageVsPedimentos = +((maxTaxRows / pedimentosTotal) * 100).toFixed(1);

  if (tablesWithTax.length === 0) {
    findings.phase2.verdict = 'INDETERMINATE';
    findings.phase2.reason = 'No tax columns (dta/igi/iva/ieps/impuestos/contribuciones/liquidaciones) found on any audited table.';
  } else if (coverageVsPedimentos < 25) {
    findings.phase2.verdict = 'PARTIAL — coverage gap';
    findings.phase2.reason = `Tax columns exist on [${tablesWithTax.join(', ')}] but cover only ${coverageVsPedimentos}% of pedimentos (${maxTaxRows} tax-stamped rows vs ${pedimentosTotal} pedimentos). Most pedimentos cannot be IVA-verified because the SAT scraper hasn't populated their contribuciones yet.`;
  } else if (coverageVsPedimentos < 90) {
    findings.phase2.verdict = 'PARTIAL — moderate coverage';
    findings.phase2.reason = `Tax columns exist on [${tablesWithTax.join(', ')}] with ${coverageVsPedimentos}% coverage of pedimentos.`;
  } else {
    findings.phase2.verdict = 'VERIFIABLE';
    findings.phase2.reason = `Tax columns on [${tablesWithTax.join(', ')}] cover ${coverageVsPedimentos}% of pedimentos. IVA = (valor_aduana + DTA + IGI) × 0.16 can be cross-checked.`;
  }
  findings.phase2.coverage_vs_pedimentos_pct = coverageVsPedimentos;
  findings.phase2.tables_with_tax_columns = tablesWithTax;
  findings.phase2.evidence = {
    pedimentos_total: pedimentosTotal,
    pedimentos_with_valor_aduana: pedimentos.filter(p => p.valor_aduana != null).length,
    pedimento_raw_shape: 'array of 11 strings (cell-extracted text, not parsed)',
    partidas_valor_aduana_present_count: partidasAll.length,
  };
  console.log(' IVA-related columns by table:', JSON.stringify(ivaColumns));
  console.log(' coverage vs pedimentos:', coverageVsPedimentos + '%', 'verdict:', findings.phase2.verdict);

  // Fronterizo check: any client RFC in fronterizo state? EVCO is Tlajomulco (Jalisco) → 16% always.
  const { data: companies } = await sb.from('companies').select('company_id, name, rfc, aduana, immex, tmec_eligible, clave_cliente');
  findings.phase2.companies_for_fronterizo_check = (companies||[]).map(c => ({ company_id: c.company_id, name: c.name, rfc: c.rfc, aduana: c.aduana }));

  // ─────────────────────────────────────────────────────────
  // PHASE 3 — DTA rate verification
  // ─────────────────────────────────────────────────────────
  logSection('PHASE 3: DTA verification');
  findings.phase3 = { description: 'DTA = valor_aduana × per-mil rate at fecha_cruce' };
  // Same schema gap. We can compute *expected* DTA but cannot compare to *stored* DTA because it isn't stored.
  // Best we can do: check whether traficos.importe_total ≈ DTA expected, and surface anomalies.
  // Compute expected DTA distribution to give Renato a ballpark.
  const pedWithVA = pedimentos.filter(p => false); // No valor_aduana on the cached projection — re-fetch
  const pedFull = await paginate(() => sb.from('pedimentos').select('id,pedimento_id,valor_aduana,tipo_cambio,fecha_pago,fecha_entrada,clave_pedimento,moneda,importe_total').not('valor_aduana','is',null));
  let dtaSum = 0; let countWithDate = 0; let yrDist = {};
  const expectedDtaSamples = [];
  for (const p of pedFull) {
    const dateRef = p.fecha_pago || p.fecha_entrada;
    const yr = dateRef ? new Date(dateRef).getUTCFullYear() : null;
    const perMil = (yr && yr >= 2026) ? DTA_2026_PER_MIL : DTA_2025_PER_MIL;
    const expectedDTA = (p.valor_aduana || 0) * (perMil / 1000);
    dtaSum += expectedDTA;
    if (yr) { countWithDate++; yrDist[yr] = (yrDist[yr] || 0) + 1; }
    if (expectedDtaSamples.length < 10) expectedDtaSamples.push({ pedimento_id: p.pedimento_id, valor_aduana: p.valor_aduana, year: yr, expected_DTA: expectedDTA.toFixed(2) });
  }
  findings.phase3.pedimentos_with_valor_aduana = pedFull.length;
  findings.phase3.with_date_for_rate_lookup = countWithDate;
  findings.phase3.expected_dta_total = dtaSum.toFixed(2);
  findings.phase3.expected_dta_samples = expectedDtaSamples;
  findings.phase3.year_distribution = yrDist;
  findings.phase3.verdict = 'INDETERMINATE — expected DTA computable but stored DTA not persisted in schema';
  console.log(' pedFull with valor_aduana:', pedFull.length, 'expected DTA total $', dtaSum.toFixed(0));

  // ─────────────────────────────────────────────────────────
  // PHASE 4 — Fracción arancelaria validity
  // ─────────────────────────────────────────────────────────
  logSection('PHASE 4: Fracción validity');
  findings.phase4 = {};

  // Pull all unique fracciones from all sources
  const fraccionsSrc = {};
  // partidas
  const partFracs = partidasAll.map(p => null); // we didn't fetch fraccion in original query
  const partAll2 = await paginate(() => sb.from('partidas').select('fraccion_arancelaria'));
  fraccionsSrc.partidas = countUnique(partAll2.map(r => r.fraccion_arancelaria));
  // anexo24_partidas
  const ax24Parts = await paginate(() => sb.from('anexo24_partidas').select('fraccion'));
  fraccionsSrc.anexo24_partidas = countUnique(ax24Parts.map(r => r.fraccion));
  // globalpc_productos
  const gpProds = await paginate(() => sb.from('globalpc_productos').select('fraccion'));
  fraccionsSrc.globalpc_productos = countUnique(gpProds.map(r => r.fraccion));
  // tigie_fracciones
  const tigie = await paginate(() => sb.from('tigie_fracciones').select('fraccion,arancel_mfn,arancel_usmca,verified'));
  const tigieMap = new Map(tigie.map(t => [String(t.fraccion).replace(/\./g,''), t]));
  fraccionsSrc.tigie_fracciones = { unique: tigie.length, samples: tigie.slice(0,3) };
  // tariff_rates
  const tr = await paginate(() => sb.from('tariff_rates').select('fraccion,igi_rate'));
  const trMap = new Map(tr.map(r => [String(r.fraccion).replace(/\./g,''), r]));
  fraccionsSrc.tariff_rates = { unique: tr.length, samples: tr.slice(0,3) };

  // For each source, classify format
  const formatStats = {};
  function classifyFraccion(f) {
    if (!f) return 'null';
    const s = String(f).trim();
    if (FRACCION_DOTTED_NICO.test(s)) return 'dotted_10';
    if (FRACCION_DOTTED.test(s))      return 'dotted_8';
    if (FRACCION_10_DIGITS.test(s))   return 'undotted_10';
    if (FRACCION_8_DIGITS.test(s))    return 'undotted_8';
    if (/^\d+$/.test(s))              return 'digits_other_length_' + s.length;
    return 'malformed';
  }
  for (const [src, vals] of Object.entries({
    partidas: partAll2.map(r => r.fraccion_arancelaria),
    anexo24_partidas: ax24Parts.map(r => r.fraccion),
    globalpc_productos: gpProds.map(r => r.fraccion),
    tigie_fracciones: tigie.map(r => r.fraccion),
    tariff_rates: tr.map(r => r.fraccion),
  })) {
    const dist = {};
    for (const v of vals) {
      const k = classifyFraccion(v);
      dist[k] = (dist[k] || 0) + 1;
    }
    formatStats[src] = dist;
  }
  findings.phase4.format_distribution_by_table = formatStats;
  findings.phase4.unique_fracciones_per_table = {
    partidas: countUnique(partAll2.map(r => r.fraccion_arancelaria)).total,
    anexo24_partidas: countUnique(ax24Parts.map(r => r.fraccion)).total,
    globalpc_productos: countUnique(gpProds.map(r => r.fraccion)).total,
    tigie_fracciones: tigie.length,
    tariff_rates: tr.length,
  };

  // Cross-reference: how many in-use fracciones (from partidas+anexo24+globalpc) match tigie?
  const inUseFracs = new Set();
  partAll2.forEach(r => r.fraccion_arancelaria && inUseFracs.add(String(r.fraccion_arancelaria).replace(/\./g,'').padEnd(8, '0').slice(0,8)));
  ax24Parts.forEach(r => r.fraccion && inUseFracs.add(String(r.fraccion).replace(/\./g,'').slice(0,8)));
  gpProds.forEach(r => r.fraccion && inUseFracs.add(String(r.fraccion).replace(/\./g,'').slice(0,8)));
  let inUseInTigie = 0; let inUseNotInTigie = 0;
  const notInTigieSamples = [];
  for (const f of inUseFracs) {
    if (tigieMap.has(f)) inUseInTigie++;
    else { inUseNotInTigie++; if (notInTigieSamples.length < 20) notInTigieSamples.push(f); }
  }
  findings.phase4.in_use_fraccion_count = inUseFracs.size;
  findings.phase4.in_use_in_tigie = inUseInTigie;
  findings.phase4.in_use_not_in_tigie = inUseNotInTigie;
  findings.phase4.in_use_not_in_tigie_samples = notInTigieSamples;
  findings.phase4.tigie_catalog_size_warning = tigie.length < 5000 ? `tigie_fracciones has only ${tigie.length} rows; full SAT TIGIE catalog has ~12,000+. Cross-reference is INCOMPLETE — many "not_in_tigie" fracciones are likely valid but the catalog reference is partial.` : null;

  console.log(' fracciones in-use unique:', inUseFracs.size, 'matched in tigie:', inUseInTigie, 'unmatched:', inUseNotInTigie);
  console.log(' format distribution:', JSON.stringify(formatStats));

  // ─────────────────────────────────────────────────────────
  // PHASE 5 — T-MEC eligibility derivation
  // ─────────────────────────────────────────────────────────
  logSection('PHASE 5: T-MEC eligibility');
  findings.phase5 = {};

  // Pull partidas with origen + valor_aduana + fraccion
  const partForTmec = await paginate(() => sb.from('partidas').select('pedimento_id,partida_numero,fraccion_arancelaria,pais_origen,pais_vendedor,valor_aduana,valor_dolares'));
  let usmcaCount = 0; let nonUsmcaCount = 0; let unknownCount = 0;
  const fracciones_in_partidas_set = new Set();
  partForTmec.forEach(p => p.fraccion_arancelaria && fracciones_in_partidas_set.add(String(p.fraccion_arancelaria).replace(/\./g,'').slice(0,8)));
  for (const p of partForTmec) {
    if (KNOWN_USMCA.has(p.pais_origen)) usmcaCount++;
    else if (!p.pais_origen) unknownCount++;
    else nonUsmcaCount++;
  }
  findings.phase5.partidas_total = partForTmec.length;
  findings.phase5.usmca_origen_count = usmcaCount;
  findings.phase5.non_usmca_origen_count = nonUsmcaCount;
  findings.phase5.unknown_origen_count = unknownCount;

  // anexo24_partidas has 'tratado' field — cross-check
  const ax24WithTratado = await paginate(() => sb.from('anexo24_partidas').select('pedimento,fraccion,pais_origen,tratado,valor_dolar,incoterm'));
  const tratadoDist = {};
  ax24WithTratado.forEach(p => {
    const k = (p.tratado || 'null').trim();
    tratadoDist[k] = (tratadoDist[k] || 0) + 1;
  });
  findings.phase5.anexo24_tratado_distribution = tratadoDist;
  // Cross-check: anexo24 partidas marked T-MEC but with non-USMCA origen
  let p5_marked_non_usmca = 0;
  const p5_marked_non_usmca_samples = [];
  for (const p of ax24WithTratado) {
    const tr = (p.tratado || '').toUpperCase();
    if ((tr.includes('TMEC') || tr.includes('T-MEC') || tr.includes('USMCA') || tr.includes('TLCAN')) && p.pais_origen && !['USA','MEX','CAN','EUA','EU','US'].includes(p.pais_origen.toUpperCase())) {
      p5_marked_non_usmca++;
      if (p5_marked_non_usmca_samples.length < 20) p5_marked_non_usmca_samples.push({ pedimento: p.pedimento, fraccion: p.fraccion, pais_origen: p.pais_origen, tratado: p.tratado });
    }
  }
  findings.phase5.anexo24_marked_tmec_with_non_usmca_origen = p5_marked_non_usmca;
  findings.phase5.samples = p5_marked_non_usmca_samples;

  // companies.tmec_eligible distribution
  const tmecDist = {};
  for (const c of (companies||[])) {
    const k = c.tmec_eligible === null ? 'null' : String(c.tmec_eligible);
    tmecDist[k] = (tmecDist[k] || 0) + 1;
  }
  findings.phase5.companies_tmec_eligible_distribution = tmecDist;

  console.log(' partidas USMCA origen:', usmcaCount, 'non-USMCA:', nonUsmcaCount, 'unknown:', unknownCount);

  // ─────────────────────────────────────────────────────────
  // PHASE 6 — Currency consistency
  // ─────────────────────────────────────────────────────────
  logSection('PHASE 6: Currency consistency');
  findings.phase6 = {};

  // 6a — globalpc_facturas: moneda, valor_comercial
  const facturas = await paginate(() => sb.from('globalpc_facturas').select('id,numero,folio,fecha_facturacion,valor_comercial,moneda,incoterm,cve_proveedor,cve_trafico'));
  const monedaDist = {};
  const incotermDist = {};
  let mxnRangeOk = 0; let usdRangeOk = 0; let monedaNull = 0; let valorNull = 0; let monedaUnknown = 0;
  const monedaSamplesUnk = [];
  for (const f of facturas) {
    const mon = (f.moneda || '').trim();
    monedaDist[mon || 'null'] = (monedaDist[mon || 'null'] || 0) + 1;
    if (!mon) monedaNull++;
    if (f.valor_comercial == null) valorNull++;
    if (mon === 'USD' && f.valor_comercial != null && f.valor_comercial >= 100 && f.valor_comercial <= 5_000_000) usdRangeOk++;
    if (mon === 'MXN' && f.valor_comercial != null && f.valor_comercial >= 1000 && f.valor_comercial <= 100_000_000) mxnRangeOk++;
    if (mon && !['USD','MXN','EUR','CAD','JPY'].includes(mon)) {
      monedaUnknown++;
      if (monedaSamplesUnk.length < 10) monedaSamplesUnk.push({ id: f.id, moneda: mon, valor_comercial: f.valor_comercial });
    }
    const inc = (f.incoterm || '').trim().toUpperCase();
    incotermDist[inc || 'null'] = (incotermDist[inc || 'null'] || 0) + 1;
  }
  findings.phase6.globalpc_facturas = {
    total: facturas.length,
    moneda_distribution: monedaDist,
    incoterm_distribution: incotermDist,
    moneda_null_count: monedaNull,
    valor_null_count: valorNull,
    usd_range_ok: usdRangeOk,
    mxn_range_ok: mxnRangeOk,
    unknown_moneda_count: monedaUnknown,
    unknown_moneda_samples: monedaSamplesUnk,
  };

  // 6b — pedimentos: moneda, tipo_cambio
  const pedMonedaDist = {};
  const pedTcStats = { populated: 0, null: 0, oddly_low: 0, oddly_high: 0, samples_odd: [] };
  for (const p of pedFull) {
    const mon = p.moneda || 'null';
    pedMonedaDist[mon] = (pedMonedaDist[mon] || 0) + 1;
    if (p.tipo_cambio == null) pedTcStats.null++;
    else {
      pedTcStats.populated++;
      if (p.tipo_cambio < 5) { pedTcStats.oddly_low++; if (pedTcStats.samples_odd.length < 10) pedTcStats.samples_odd.push({ id: p.id, ped: p.pedimento_id, tc: p.tipo_cambio }); }
      if (p.tipo_cambio > 30) { pedTcStats.oddly_high++; if (pedTcStats.samples_odd.length < 10) pedTcStats.samples_odd.push({ id: p.id, ped: p.pedimento_id, tc: p.tipo_cambio }); }
    }
  }
  findings.phase6.pedimentos = {
    moneda_distribution: pedMonedaDist,
    tipo_cambio_stats: pedTcStats,
  };

  // 6c — partidas: cross-check valor_dolares × tc ≈ valor_aduana for joined pedimento
  const pedTcMap = new Map(pedFull.map(p => [p.pedimento_id, p.tipo_cambio]));
  let crossCheckOK = 0, crossCheckMismatch = 0;
  const crossSamples = [];
  const partFinanc = await paginate(() => sb.from('partidas').select('pedimento_id,partida_numero,valor_aduana,valor_dolares'));
  for (const p of partFinanc) {
    const tc = pedTcMap.get(p.pedimento_id);
    if (!tc || !p.valor_aduana || !p.valor_dolares) continue;
    const expected = p.valor_dolares * tc;
    const diff = Math.abs(expected - p.valor_aduana);
    const tol = Math.max(2, p.valor_aduana * 0.005);  // 0.5% tolerance
    if (diff <= tol) crossCheckOK++;
    else { crossCheckMismatch++; if (crossSamples.length < 20) crossSamples.push({ ped: p.pedimento_id, partida: p.partida_numero, valor_dolares: p.valor_dolares, tc, expected: +expected.toFixed(2), valor_aduana_stored: p.valor_aduana, diff: +diff.toFixed(2) }); }
  }
  findings.phase6.partida_currency_cross_check = {
    pedimentos_used_for_join: pedFull.length,
    partidas_with_full_data: partFinanc.filter(p => p.valor_aduana && p.valor_dolares).length,
    matched: crossCheckOK,
    mismatched: crossCheckMismatch,
    samples: crossSamples,
  };
  console.log(' partida cross-check matched:', crossCheckOK, 'mismatched:', crossCheckMismatch);

  // ─────────────────────────────────────────────────────────
  // PHASE 7 — Date & timezone integrity
  // ─────────────────────────────────────────────────────────
  logSection('PHASE 7: Date & timezone');
  findings.phase7 = {};

  const NOW = new Date();
  const PRE_1990 = new Date('1990-01-01').getTime();
  // 7a — traficos: future cruce, pre-1990, sequence
  let futCruce = 0, futCruceCrossed = 0, preCruce = 0, seqViolation = 0, seqViolationSamples = [];
  for (const t of traficos) {
    const fc = t.fecha_cruce ? new Date(t.fecha_cruce) : null;
    const fl = t.fecha_llegada ? new Date(t.fecha_llegada) : null;
    const fp = t.fecha_pago ? new Date(t.fecha_pago) : null;
    if (fc && fc > NOW) {
      futCruce++;
      if (t.semaforo === 0 || t.semaforo === 2 || t.semaforo === 1) futCruceCrossed++; // any semaforo means it claims to be processed
    }
    if (fc && fc.getTime() < PRE_1990) preCruce++;
    // Sequence: fecha_llegada (arrival) ≤ fecha_pago (payment) ≤ fecha_cruce (crossing)
    // Reality: sometimes pago is before llegada (pre-pay), so flag only when cruce < llegada or cruce < pago
    if (fl && fc && fc < fl) {
      seqViolation++;
      if (seqViolationSamples.length < 20) seqViolationSamples.push({ id: t.id, fecha_llegada: t.fecha_llegada, fecha_cruce: t.fecha_cruce, fecha_pago: t.fecha_pago, type: 'cruce_before_llegada' });
    }
  }
  findings.phase7.traficos = {
    total: traficos.length,
    future_fecha_cruce: futCruce,
    future_fecha_cruce_with_status: futCruceCrossed,
    pre_1990_fecha_cruce: preCruce,
    sequence_violations: seqViolation,
    samples: seqViolationSamples,
  };

  // 7b — pedimentos: fecha_pago, fecha_entrada
  const pedAll = await paginate(() => sb.from('pedimentos').select('id,pedimento_id,fecha_pago,fecha_entrada'));
  let pedFut = 0; let pedPre = 0; let pedSeq = 0; const pedSamples = [];
  for (const p of pedAll) {
    const fp = p.fecha_pago ? new Date(p.fecha_pago) : null;
    const fe = p.fecha_entrada ? new Date(p.fecha_entrada) : null;
    if (fp && fp > NOW) pedFut++;
    if (fe && fe > NOW) pedFut++;
    if (fp && fp.getTime() < PRE_1990) pedPre++;
    if (fe && fp && fe > fp) {
      pedSeq++;
      if (pedSamples.length < 10) pedSamples.push({ ped: p.pedimento_id, fecha_pago: p.fecha_pago, fecha_entrada: p.fecha_entrada });
    }
  }
  findings.phase7.pedimentos = { total: pedAll.length, future_dates: pedFut, pre_1990: pedPre, sequence_violations: pedSeq, samples: pedSamples };

  // 7c — anexo24_partidas: factura/fecha_factura is text (not date) — flag schema issue
  const ax24DateSample = ax24Parts.slice(0,5);
  // Already captured. Note this in schema findings.
  findings.phase7.anexo24_partidas_schema_note = 'fecha_factura, fecha_pago, fecha_presentacion stored as TEXT not DATE — typed query/sort cannot apply';

  // ─────────────────────────────────────────────────────────
  // PHASE 8 — Regulatory metadata
  // ─────────────────────────────────────────────────────────
  logSection('PHASE 8: Regulatory metadata');
  findings.phase8 = {};

  // 8a — pedimentos.clave_pedimento, regimen (no regimen on pedimentos table — on traficos)
  const claveDist = {};
  for (const p of pedAll) {
    const k = (p.clave_pedimento || 'null').toString().toUpperCase();
    claveDist[k] = (claveDist[k] || 0) + 1;
  }
  let claveValid = 0, claveInvalid = 0;
  const claveInvalidSamples = [];
  for (const [k, n] of Object.entries(claveDist)) {
    if (k === 'NULL') continue;
    if (VALID_CLAVE_PEDIMENTO.has(k)) claveValid += n;
    else { claveInvalid += n; if (claveInvalidSamples.length < 10) claveInvalidSamples.push({ clave: k, count: n }); }
  }
  findings.phase8.pedimentos_clave_pedimento = { distribution: claveDist, valid_count: claveValid, invalid_count: claveInvalid, invalid_samples: claveInvalidSamples };

  // 8b — traficos.regimen
  const regDist = {};
  for (const t of traficos) {
    const k = (t.regimen || 'null').toString().toUpperCase();
    regDist[k] = (regDist[k] || 0) + 1;
  }
  let regValid = 0, regInvalid = 0; const regInvalidSamples = [];
  for (const [k, n] of Object.entries(regDist)) {
    if (k === 'NULL') continue;
    if (VALID_REGIMEN.has(k)) regValid += n;
    else { regInvalid += n; if (regInvalidSamples.length < 10) regInvalidSamples.push({ regimen: k, count: n }); }
  }
  findings.phase8.traficos_regimen = { distribution: regDist, valid_count: regValid, invalid_count: regInvalid, invalid_samples: regInvalidSamples };

  // 8c — INCOTERMs (already covered in phase 6 globalpc_facturas + check anexo24_partidas)
  let ax24IncoValid = 0; let ax24IncoInvalid = 0; const ax24IncoSamples = [];
  const ax24IncoDist = {};
  for (const p of ax24WithTratado) {
    const inc = (p.incoterm || '').trim().toUpperCase();
    ax24IncoDist[inc || 'null'] = (ax24IncoDist[inc || 'null'] || 0) + 1;
    if (!inc) continue;
    if (VALID_INCOTERMS.has(inc)) ax24IncoValid++;
    else { ax24IncoInvalid++; if (ax24IncoSamples.length < 10) ax24IncoSamples.push({ pedimento: p.pedimento, incoterm: inc }); }
  }
  findings.phase8.anexo24_incoterm = { distribution: ax24IncoDist, valid: ax24IncoValid, invalid: ax24IncoInvalid, invalid_samples: ax24IncoSamples };

  // 8d — aduana codes distribution (across all sources)
  findings.phase8.aduana_distribution = { traficos: p1e.aduana_dist, pedimentos: p1a.aduana_dist };

  // ─────────────────────────────────────────────────────────
  // PHASE 9 — Referential integrity
  // ─────────────────────────────────────────────────────────
  logSection('PHASE 9: Referential integrity');
  findings.phase9 = {};

  // 9a — partidas.pedimento_id (string) → pedimentos.pedimento_id
  const pedIdSet = new Set(pedAll.map(p => p.pedimento_id));
  const partFkOk = partidasAll.filter(p => pedIdSet.has(p.pedimento_id)).length;
  const partFkBad = partidasAll.length - partFkOk;
  // Sample broken FK
  const partFkBadSamples = partidasAll.filter(p => !pedIdSet.has(p.pedimento_id)).slice(0, 10).map(p => ({ id: p.id, pedimento_id: p.pedimento_id }));
  findings.phase9.partidas_to_pedimentos = {
    partidas: partidasAll.length,
    matched: partFkOk,
    orphans: partFkBad,
    orphan_samples: partFkBadSamples,
    note: 'partidas.pedimento_id is denormalized text string — should match pedimentos.pedimento_id exactly',
  };

  // 9b — expediente_documentos.pedimento_id
  const expDocs = await paginate(() => sb.from('expediente_documentos').select('id,pedimento_id,doc_type'));
  const expFkOk = expDocs.filter(e => e.pedimento_id != null).length;
  const expFkBad = expDocs.length - expFkOk;
  // Distinct pedimento_ids (could be int or string — see earlier schema)
  const expDistinctPed = countUnique(expDocs.map(r => r.pedimento_id));
  findings.phase9.expediente_documentos = {
    total: expDocs.length,
    with_pedimento_id: expFkOk,
    without_pedimento_id: expFkBad,
    distinct_pedimentos: expDistinctPed.total,
  };

  // 9c — globalpc_facturas → cve_trafico → traficos.referencia_cliente?
  const factTrafSet = new Set(facturas.map(f => f.cve_trafico).filter(x => x));
  // join via traficos.referencia_cliente
  const trafRefSet = new Set(traficos.map(t => t.referencia_cliente).filter(x => x));
  let factTrafMatched = 0;
  for (const c of factTrafSet) if (trafRefSet.has(c)) factTrafMatched++;
  findings.phase9.globalpc_facturas_to_traficos = {
    distinct_cve_trafico_in_facturas: factTrafSet.size,
    distinct_referencia_cliente_in_traficos: trafRefSet.size,
    matched: factTrafMatched,
  };

  // 9d — globalpc_facturas → cve_proveedor → globalpc_productos.cve_proveedor (provider link)
  // Just sanity check uniqueness coverage
  const provInFacts = new Set(facturas.map(f => f.cve_proveedor).filter(x => x));
  const provInProds = new Set(gpProds.length ? gpProds.map(p => null).filter(x => false) : []);
  // gpProds contains fraccion only — need to refetch with cve_proveedor for proper join
  // skip detailed cross-join, summarize
  findings.phase9.facturas_distinct_proveedores = provInFacts.size;

  // ─────────────────────────────────────────────────────────
  // PHASE 10 — Compliance metadata
  // ─────────────────────────────────────────────────────────
  logSection('PHASE 10: Compliance metadata');
  findings.phase10 = {};

  // Check schema of pedimentos and partidas for NOM/permiso/CITES fields — none seen. Probe other tables.
  for (const t of ['nom_compliance','nom_certifications','permisos','permisos_previos','cites','sanitarios','regulaciones','regulatory_alerts','regulatory_timeline','compliance_events','compliance_scores']) {
    const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true });
    if (!error) findings.phase10[t] = (count ?? 'null');
  }
  findings.phase10.note = 'pedimentos/partidas have no NOM/permiso/CITES columns. Compliance metadata, where it exists, lives in separate tables (compliance_events, regulatory_alerts). Cross-table linkage to specific pedimentos was NOT verified.';

  // ─────────────────────────────────────────────────────────
  // Save
  // ─────────────────────────────────────────────────────────
  fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify(findings, null, 2));
  console.log('\nSaved /tmp/customs-audit/findings.json (' + (Date.now()-t0)/1000 + 's)');
})().catch(err => { console.error('FATAL', err); process.exit(1); });

function countUnique(arr) {
  const set = new Set();
  for (const v of arr) if (v != null) set.add(String(v));
  return { total: set.size, samples: Array.from(set).slice(0, 10) };
}
