/**
 * CRUZ Customs Domain Knowledge — embedded reference data
 * Used by CRUZ AI to answer classification, T-MEC, and compliance questions
 * without hitting the database for every query.
 *
 * Source: TIGIE, RGCE, Ley Aduanera, T-MEC Capítulo 4
 */

// ── TIGIE Chapter Index (Secciones I-XXI, Capítulos 1-98) ──
export const TIGIE_CHAPTERS: Record<string, { section: string; description: string; commonFractions: string[] }> = {
  '01': { section: 'I', description: 'Animales vivos', commonFractions: [] },
  '02': { section: 'I', description: 'Carne y despojos comestibles', commonFractions: [] },
  '03': { section: 'I', description: 'Pescados y crustáceos', commonFractions: [] },
  '04': { section: 'I', description: 'Leche, huevos, miel', commonFractions: [] },
  '05': { section: 'I', description: 'Productos de origen animal', commonFractions: [] },
  '06': { section: 'II', description: 'Plantas vivas y floricultura', commonFractions: [] },
  '07': { section: 'II', description: 'Hortalizas, plantas, raíces', commonFractions: [] },
  '08': { section: 'II', description: 'Frutas y frutos comestibles', commonFractions: [] },
  '09': { section: 'II', description: 'Café, té, yerba mate, especias', commonFractions: [] },
  '10': { section: 'II', description: 'Cereales', commonFractions: [] },
  '15': { section: 'III', description: 'Grasas y aceites animales/vegetales', commonFractions: [] },
  '17': { section: 'IV', description: 'Azúcares y confitería', commonFractions: [] },
  '20': { section: 'IV', description: 'Preparaciones de hortalizas/frutas', commonFractions: [] },
  '22': { section: 'IV', description: 'Bebidas, líquidos alcohólicos, vinagre', commonFractions: [] },
  '25': { section: 'V', description: 'Sal, azufre, tierras, piedras, yeso', commonFractions: [] },
  '27': { section: 'V', description: 'Combustibles minerales, aceites, ceras', commonFractions: [] },
  '28': { section: 'VI', description: 'Productos químicos inorgánicos', commonFractions: [] },
  '29': { section: 'VI', description: 'Productos químicos orgánicos', commonFractions: [] },
  '30': { section: 'VI', description: 'Productos farmacéuticos', commonFractions: [] },
  '32': { section: 'VI', description: 'Extractos curtientes, tintas, pigmentos', commonFractions: [] },
  '33': { section: 'VI', description: 'Aceites esenciales, perfumería, cosmética', commonFractions: [] },
  '34': { section: 'VI', description: 'Jabón, ceras, velas, pastas', commonFractions: [] },
  '35': { section: 'VI', description: 'Materias albuminoideas, colas, enzimas', commonFractions: [] },
  '38': { section: 'VI', description: 'Productos diversos de industrias químicas', commonFractions: [] },
  '39': { section: 'VII', description: 'Plásticos y sus manufacturas', commonFractions: ['3901.10.01', '3901.20.01', '3901.90.99', '3902.10.01', '3903.19.99', '3907.61.01', '3909.20.01', '3920.10.01'] },
  '40': { section: 'VII', description: 'Caucho y sus manufacturas', commonFractions: ['4011.10.01', '4016.93.01'] },
  '44': { section: 'IX', description: 'Madera, carbón vegetal', commonFractions: [] },
  '48': { section: 'X', description: 'Papel y cartón', commonFractions: ['4819.10.01'] },
  '49': { section: 'X', description: 'Productos editoriales, prensa', commonFractions: [] },
  '54': { section: 'XI', description: 'Filamentos sintéticos o artificiales', commonFractions: [] },
  '55': { section: 'XI', description: 'Fibras sintéticas o artificiales discontinuas', commonFractions: [] },
  '56': { section: 'XI', description: 'Guata, fieltro, telas sin tejer, cordeles', commonFractions: [] },
  '59': { section: 'XI', description: 'Telas impregnadas, recubiertas', commonFractions: [] },
  '63': { section: 'XI', description: 'Artículos textiles confeccionados', commonFractions: [] },
  '68': { section: 'XIII', description: 'Manufacturas de piedra, yeso, cemento', commonFractions: [] },
  '70': { section: 'XIII', description: 'Vidrio y sus manufacturas', commonFractions: [] },
  '72': { section: 'XV', description: 'Fundición, hierro y acero', commonFractions: ['7210.49.01', '7219.34.01', '7225.40.01'] },
  '73': { section: 'XV', description: 'Manufacturas de fundición, hierro, acero', commonFractions: ['7304.31.01', '7306.30.01', '7318.15.01'] },
  '74': { section: 'XV', description: 'Cobre y sus manufacturas', commonFractions: [] },
  '76': { section: 'XV', description: 'Aluminio y sus manufacturas', commonFractions: ['7606.12.01', '7607.11.01'] },
  '82': { section: 'XV', description: 'Herramientas y cuchillería', commonFractions: [] },
  '83': { section: 'XV', description: 'Manufacturas diversas de metales comunes', commonFractions: [] },
  '84': { section: 'XVI', description: 'Reactores nucleares, calderas, máquinas', commonFractions: ['8477.10.01', '8481.80.99', '8413.70.99'] },
  '85': { section: 'XVI', description: 'Máquinas, aparatos y material eléctrico', commonFractions: ['8504.40.99', '8536.90.99', '8544.49.01'] },
  '87': { section: 'XVII', description: 'Vehículos automóviles, tractores, ciclos', commonFractions: ['8708.29.99', '8708.99.99'] },
  '90': { section: 'XVIII', description: 'Instrumentos y aparatos de óptica, medida', commonFractions: [] },
  '94': { section: 'XX', description: 'Muebles, artículos de cama, alumbrado', commonFractions: ['9403.20.01'] },
  '95': { section: 'XX', description: 'Juguetes, juegos, artículos de deporte', commonFractions: [] },
  '96': { section: 'XX', description: 'Manufacturas diversas', commonFractions: [] },
}

// ── T-MEC Rules of Origin (simplified by section) ──
export const TMEC_RULES: Record<string, { rule: string; requirements: string }> = {
  'plasticos_39': {
    rule: 'Cambio de capítulo (CC) o Valor de Contenido Regional (VCR) ≥ 60% método de transacción',
    requirements: 'Certificado de origen T-MEC. Proveedor debe declarar país de manufactura.',
  },
  'metales_72_76': {
    rule: 'Proceso de fundición o manufactura sustancial en territorio T-MEC',
    requirements: 'Certificado de origen. Si solo hay procesamiento menor (corte, pulido), no califica.',
  },
  'maquinaria_84_85': {
    rule: 'VCR ≥ 50% método de costo neto, o cambio de subpartida (CTSH)',
    requirements: 'Certificado de origen con lista de componentes y costos. Partes de terceros países se restan del VCR.',
  },
  'automotriz_87': {
    rule: 'VCR ≥ 75% para vehículos, ≥ 70% para partes esenciales (motor, transmisión)',
    requirements: 'Certificado de origen con requisitos laborales de valor alto (LVC). Acero y aluminio deben ser originarios.',
  },
  'quimicos_28_38': {
    rule: 'Reacción química que produce nuevo compuesto con CAS distinto, o CC',
    requirements: 'Certificado de origen. Mezcla simple no califica como reacción química.',
  },
  'textiles_50_63': {
    rule: 'Regla de hilado en adelante (yarn-forward) — hilo debe fabricarse en territorio T-MEC',
    requirements: 'Certificado de origen. Excepciones para cantidades de minimis (<10% del peso).',
  },
  'default': {
    rule: 'Cambio de clasificación arancelaria a nivel de capítulo (CC) o VCR ≥ 50%',
    requirements: 'Certificado de origen T-MEC vigente. Proveedor en país T-MEC (US, MX, CA).',
  },
}

// ── DTA Rate Tiers ──
export const DTA_INFO = {
  description: 'Derecho de Trámite Aduanero — se calcula sobre el valor aduana en MXN',
  tiers: {
    A1: { rate: 0.008, description: 'Importación definitiva (régimen estándar)', note: '8 al millar' },
    IN: { type: 'fixed', amount: 408, description: 'IMMEX/maquiladora — cuota fija', note: '$408 MXN fijo' },
    ITE: { rate: 0, description: 'Importación temporal (retorna) — exento', note: 'T-MEC exento' },
    ITR: { rate: 0, description: 'Importación temporal para reexportación', note: 'T-MEC exento' },
    IMD: { rate: 0.008, description: 'Importación definitiva con T-MEC', note: '8 al millar, IGI exento' },
  },
  formula: 'DTA = valor_aduana_MXN × tasa_DTA',
}

// ── IVA Calculation ──
export const IVA_INFO = {
  rate: 0.16,
  description: 'Impuesto al Valor Agregado — 16% sobre base cascada',
  formula: 'IVA = (valor_aduana + DTA + IGI) × 0.16',
  warning: 'NUNCA calcular IVA como valor_factura × 0.16. La base incluye DTA e IGI.',
}

// ── MVE / E2 Requirements ──
export const MVE_INFO = {
  description: 'Manifestación de Valor en Aduana — formato E2',
  deadline: 'Obligatorio desde 31 marzo 2026 para todas las importaciones',
  requirements: [
    'Número de pedimento',
    'Valor declarado en USD + tipo de cambio',
    'Descripción detallada de mercancía',
    'Fracción arancelaria (8 dígitos)',
    'País de origen y procedencia',
    'Nombre y RFC del importador',
    'Nombre del proveedor extranjero',
    'Incoterm y condiciones de venta',
  ],
  penalty: 'Multa de $1,610 a $7,190 MXN por omisión o datos incorrectos (Art. 185-A CFF)',
}

// ── Aduana 240 / Nuevo Laredo ──
export const ADUANA_240 = {
  name: 'Nuevo Laredo, Tamaulipas',
  code: '240',
  bridges: [
    { name: 'World Trade Bridge', type: 'Comercial', hours: '24/7 para carga comercial', avgCrossing: '2-4 horas' },
    { name: 'Puente Colombia', type: 'Comercial', hours: '8:00-22:00 L-S', avgCrossing: '1-3 horas' },
    { name: 'Puente Juárez-Lincoln', type: 'Mixto', hours: '24/7', avgCrossing: 'Variable' },
    { name: 'Gateway to the Americas', type: 'Mixto', hours: '24/7', avgCrossing: 'Variable' },
  ],
  procedures: {
    semaforo: 'Asignación verde/rojo en paso 8 del proceso. Verde = libre. Rojo = reconocimiento aduanero.',
    horario_optimo: 'Cruces más rápidos: 6-8 AM entre semana. Evitar viernes 2-6 PM.',
    documentos: 'Pedimento, factura comercial, COVE, carta porte, BL/AWB, certificado de origen (si T-MEC)',
  },
}

// ── Common NOMs for Import ──
export const COMMON_NOMS: Record<string, { nom: string; applies_to: string; authority: string }> = {
  NOM_051: { nom: 'NOM-051-SCFI/SSA1-2010', applies_to: 'Alimentos y bebidas — etiquetado', authority: 'SE/SSA' },
  NOM_004: { nom: 'NOM-004-SE-2021', applies_to: 'Textiles — etiquetado de información', authority: 'SE' },
  NOM_020: { nom: 'NOM-020-SCFI-1997', applies_to: 'Productos electrónicos — seguridad', authority: 'SE' },
  NOM_024: { nom: 'NOM-024-SCFI-2013', applies_to: 'Equipos electrónicos — radiación', authority: 'SE' },
  NOM_141: { nom: 'NOM-141-SSA1/SCFI-2012', applies_to: 'Cosméticos — etiquetado', authority: 'SSA/SE' },
  NOM_186: { nom: 'NOM-186-SSA1/SCFI-2013', applies_to: 'Cacao, chocolate — especificaciones', authority: 'SSA/SE' },
  NOM_003: { nom: 'NOM-003-SCFI-2014', applies_to: 'Productos eléctricos — seguridad', authority: 'SE' },
}

// ── Knowledge Lookup Function ──
export function lookupKnowledge(query: string): string {
  const q = query.toLowerCase()
  const results: string[] = []

  // Chapter lookup
  if (q.includes('fracción') || q.includes('capítulo') || q.includes('clasifica') || q.includes('tigie')) {
    const chapterMatch = q.match(/(\d{2})\.?(\d{2})?/)
    if (chapterMatch) {
      const ch = chapterMatch[1]
      const info = TIGIE_CHAPTERS[ch]
      if (info) {
        results.push(`Capítulo ${ch}: ${info.description} (Sección ${info.section})`)
        if (info.commonFractions.length > 0) {
          results.push(`Fracciones comunes: ${info.commonFractions.join(', ')}`)
        }
      }
    }
  }

  // T-MEC rules
  if (q.includes('t-mec') || q.includes('tmec') || q.includes('usmca') || q.includes('origen') || q.includes('regla')) {
    const chMatch = q.match(/(\d{2})/)
    if (chMatch) {
      const ch = parseInt(chMatch[1])
      let ruleKey = 'default'
      if (ch >= 39 && ch <= 40) ruleKey = 'plasticos_39'
      else if (ch >= 72 && ch <= 76) ruleKey = 'metales_72_76'
      else if (ch >= 84 && ch <= 85) ruleKey = 'maquinaria_84_85'
      else if (ch === 87) ruleKey = 'automotriz_87'
      else if (ch >= 28 && ch <= 38) ruleKey = 'quimicos_28_38'
      else if (ch >= 50 && ch <= 63) ruleKey = 'textiles_50_63'
      const rule = TMEC_RULES[ruleKey]
      results.push(`T-MEC para capítulo ${ch}: ${rule.rule}`)
      results.push(`Requisitos: ${rule.requirements}`)
    } else {
      results.push(`T-MEC general: ${TMEC_RULES.default.rule}`)
    }
  }

  // DTA
  if (q.includes('dta') || q.includes('trámite aduanero')) {
    results.push(`DTA: ${DTA_INFO.description}`)
    for (const [key, tier] of Object.entries(DTA_INFO.tiers)) {
      results.push(`  ${key}: ${tier.description} — ${tier.note}`)
    }
  }

  // IVA
  if (q.includes('iva') || q.includes('impuesto al valor')) {
    results.push(`IVA: ${IVA_INFO.description}`)
    results.push(`Fórmula: ${IVA_INFO.formula}`)
    results.push(`⚠️ ${IVA_INFO.warning}`)
  }

  // MVE
  if (q.includes('mve') || q.includes('manifestación') || q.includes('e2')) {
    results.push(`MVE: ${MVE_INFO.description}`)
    results.push(`Plazo: ${MVE_INFO.deadline}`)
    results.push(`Requisitos: ${MVE_INFO.requirements.join(', ')}`)
    results.push(`Sanción: ${MVE_INFO.penalty}`)
  }

  // Bridge/crossing
  if (q.includes('puente') || q.includes('bridge') || q.includes('cruce') || q.includes('world trade')) {
    for (const b of ADUANA_240.bridges) {
      results.push(`${b.name}: ${b.type} · ${b.hours} · Promedio: ${b.avgCrossing}`)
    }
    results.push(`Horario óptimo: ${ADUANA_240.procedures.horario_optimo}`)
  }

  // NOM
  if (q.includes('nom') || q.includes('norma')) {
    for (const [, nom] of Object.entries(COMMON_NOMS)) {
      results.push(`${nom.nom}: ${nom.applies_to} (${nom.authority})`)
    }
  }

  return results.length > 0 ? results.join('\n') : ''
}
