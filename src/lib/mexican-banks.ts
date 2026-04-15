/**
 * ZAPATA AI · Block 11 — Mexican bank catalog (Banxico bank codes).
 *
 * Static inline copy of the `mexican_banks` seed rows so the BankSelector
 * ships <100ms without a round-trip. Server-side validation still goes
 * through Supabase via the FK on pece_payments.bank_code.
 */

export interface MexicanBank {
  bank_code: string
  name: string
  swift_code: string | null
  accepts_pece: boolean
}

export const MEXICAN_BANKS: readonly MexicanBank[] = [
  { bank_code: '002', name: 'BBVA México', swift_code: 'BCMRMXMM', accepts_pece: true },
  { bank_code: '014', name: 'Santander', swift_code: 'BMSXMXMM', accepts_pece: true },
  { bank_code: '021', name: 'HSBC', swift_code: 'BIMEXMXM', accepts_pece: true },
  { bank_code: '036', name: 'Banjercito', swift_code: 'BJEMMXMT', accepts_pece: true },
  { bank_code: '040', name: 'Banco del Bajío', swift_code: 'BAJIMXMM', accepts_pece: true },
  { bank_code: '042', name: 'Banca Mifel', swift_code: 'MIFEMXMT', accepts_pece: true },
  { bank_code: '044', name: 'Scotiabank', swift_code: 'MBCOMXMM', accepts_pece: true },
  { bank_code: '058', name: 'Banregio', swift_code: 'BRGOMXMM', accepts_pece: true },
  { bank_code: '059', name: 'Invex', swift_code: 'INVEMXMT', accepts_pece: true },
  { bank_code: '060', name: 'Bansi', swift_code: 'BNSIMXMM', accepts_pece: true },
  { bank_code: '062', name: 'Afirme', swift_code: 'AFIRMXMT', accepts_pece: true },
  { bank_code: '072', name: 'Banorte', swift_code: 'MENOMXMT', accepts_pece: true },
  { bank_code: '102', name: 'ABC Capital', swift_code: null, accepts_pece: true },
  { bank_code: '103', name: 'American Express Bank', swift_code: null, accepts_pece: true },
  { bank_code: '106', name: 'Bank of America', swift_code: 'BOFAMX2X', accepts_pece: true },
  { bank_code: '108', name: 'MUFG Bank México', swift_code: 'BOTKMXMX', accepts_pece: true },
  { bank_code: '110', name: 'JP Morgan', swift_code: 'CHASMXMX', accepts_pece: true },
  { bank_code: '112', name: 'BMonex', swift_code: 'MONXMXMT', accepts_pece: true },
  { bank_code: '113', name: 'Ve por Más', swift_code: 'VXBXMXMT', accepts_pece: true },
  { bank_code: '116', name: 'ING Bank', swift_code: null, accepts_pece: false },
  { bank_code: '124', name: 'Deutsche Bank', swift_code: null, accepts_pece: true },
  { bank_code: '126', name: 'Credit Suisse', swift_code: 'CSFBMXMX', accepts_pece: true },
  { bank_code: '127', name: 'Azteca', swift_code: 'AZTKMXMT', accepts_pece: true },
  { bank_code: '128', name: 'Autofin', swift_code: null, accepts_pece: true },
  { bank_code: '129', name: 'Barclays', swift_code: 'BARCMXMM', accepts_pece: true },
  { bank_code: '130', name: 'Compartamos', swift_code: 'COMPMXMX', accepts_pece: true },
  { bank_code: '132', name: 'Multiva', swift_code: 'BMULMXMM', accepts_pece: true },
  { bank_code: '133', name: 'Actinver', swift_code: 'ACTIMXMT', accepts_pece: true },
  { bank_code: '135', name: 'Nafin', swift_code: 'NAFIMXMT', accepts_pece: true },
  { bank_code: '136', name: 'Interacciones', swift_code: null, accepts_pece: true },
  { bank_code: '137', name: 'BanCoppel', swift_code: 'BCOPMXMT', accepts_pece: true },
  { bank_code: '138', name: 'ABC Capital 2', swift_code: null, accepts_pece: true },
  { bank_code: '140', name: 'Banco Inmobiliario', swift_code: 'BAIMXMM', accepts_pece: true },
  { bank_code: '141', name: 'Volkswagen Bank', swift_code: null, accepts_pece: true },
  { bank_code: '143', name: 'CIBanco', swift_code: 'CIBMXMM', accepts_pece: true },
  { bank_code: '145', name: 'BBase', swift_code: null, accepts_pece: true },
  { bank_code: '147', name: 'Bankaool', swift_code: null, accepts_pece: true },
  { bank_code: '148', name: 'Pagatodo', swift_code: null, accepts_pece: true },
  { bank_code: '149', name: 'Forjadores', swift_code: null, accepts_pece: true },
  { bank_code: '150', name: 'Inmobiliario Mexicano', swift_code: null, accepts_pece: true },
  { bank_code: '151', name: 'Donde', swift_code: null, accepts_pece: true },
  { bank_code: '152', name: 'Bancrea', swift_code: null, accepts_pece: true },
  { bank_code: '154', name: 'Banco Base', swift_code: null, accepts_pece: true },
  { bank_code: '155', name: 'ICBC', swift_code: null, accepts_pece: true },
  { bank_code: '156', name: 'Sabadell', swift_code: 'BSABMXMX', accepts_pece: true },
  { bank_code: '157', name: 'Shinhan', swift_code: null, accepts_pece: true },
  { bank_code: '158', name: 'Mizuho', swift_code: 'MHCBMXMM', accepts_pece: true },
  { bank_code: '159', name: 'Bank of China', swift_code: 'BKCHMXMM', accepts_pece: true },
  { bank_code: '160', name: 'Banco S3', swift_code: null, accepts_pece: true },
  { bank_code: '166', name: 'Banco de México', swift_code: 'BDMXMXMM', accepts_pece: false },
  { bank_code: '168', name: 'Hipotecaria Federal', swift_code: null, accepts_pece: false },
  { bank_code: '600', name: 'Monex', swift_code: null, accepts_pece: true },
  { bank_code: '601', name: 'GBM', swift_code: 'GBMEMXMT', accepts_pece: true },
  { bank_code: '606', name: 'Bulltick', swift_code: null, accepts_pece: true },
  { bank_code: '607', name: 'Value', swift_code: null, accepts_pece: true },
  { bank_code: '608', name: 'Vector', swift_code: null, accepts_pece: true },
  { bank_code: '610', name: 'B&B', swift_code: null, accepts_pece: true },
  { bank_code: '614', name: 'Accival', swift_code: null, accepts_pece: true },
  { bank_code: '615', name: 'Merrill Lynch', swift_code: null, accepts_pece: true },
  { bank_code: '616', name: 'Finamex', swift_code: null, accepts_pece: true },
  { bank_code: '617', name: 'Valmex', swift_code: null, accepts_pece: true },
  { bank_code: '618', name: 'Unica', swift_code: null, accepts_pece: true },
  { bank_code: '619', name: 'MAPFRE', swift_code: null, accepts_pece: true },
  { bank_code: '620', name: 'Profuturo', swift_code: null, accepts_pece: true },
  { bank_code: '621', name: 'Actinver 2', swift_code: null, accepts_pece: true },
  { bank_code: '622', name: 'Actinver 3', swift_code: null, accepts_pece: true },
  { bank_code: '623', name: 'Skandia', swift_code: null, accepts_pece: true },
  { bank_code: '626', name: 'Intercam', swift_code: 'INBKMXMM', accepts_pece: true },
  { bank_code: '627', name: 'Opciones Empresariales', swift_code: null, accepts_pece: true },
  { bank_code: '628', name: 'CB Intercam', swift_code: null, accepts_pece: true },
  { bank_code: '629', name: 'CI Bolsa', swift_code: null, accepts_pece: true },
  { bank_code: '630', name: 'Multivalores', swift_code: null, accepts_pece: true },
  { bank_code: '631', name: 'CB Actinver', swift_code: null, accepts_pece: true },
  { bank_code: '632', name: 'Order', swift_code: null, accepts_pece: true },
  { bank_code: '633', name: 'JP Morgan CB', swift_code: null, accepts_pece: true },
  { bank_code: '636', name: 'HDI Seguros', swift_code: null, accepts_pece: true },
  { bank_code: '637', name: 'Zurich', swift_code: null, accepts_pece: true },
  { bank_code: '638', name: 'Nueva Wal-Mart', swift_code: null, accepts_pece: true },
  { bank_code: '640', name: 'CB JP Morgan', swift_code: null, accepts_pece: true },
  { bank_code: '642', name: 'Reforma CB', swift_code: null, accepts_pece: true },
  { bank_code: '646', name: 'STP', swift_code: 'STPEMXMX', accepts_pece: true },
  { bank_code: '647', name: 'Telecomm', swift_code: null, accepts_pece: true },
  { bank_code: '648', name: 'Evercore', swift_code: null, accepts_pece: true },
  { bank_code: '649', name: 'Skandia Operadora', swift_code: null, accepts_pece: true },
  { bank_code: '651', name: 'Segmty', swift_code: null, accepts_pece: true },
  { bank_code: '652', name: 'Asea', swift_code: null, accepts_pece: true },
  { bank_code: '653', name: 'Kuspit', swift_code: null, accepts_pece: true },
  { bank_code: '656', name: 'Unagra', swift_code: null, accepts_pece: true },
  { bank_code: '659', name: 'Opcipre', swift_code: null, accepts_pece: true },
  { bank_code: '901', name: 'CLS', swift_code: null, accepts_pece: false },
  { bank_code: '902', name: 'Indeval', swift_code: null, accepts_pece: false },
]

/**
 * Normalize query (lowercased, diacritics stripped) for name searches.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Filter banks by free-text query. Matches bank_code prefix OR normalized name substring.
 * Empty query returns the full list (optionally filtered by PECE eligibility).
 */
export function filterBanks(
  query: string,
  opts: { onlyPece?: boolean } = {},
): readonly MexicanBank[] {
  const source = opts.onlyPece ? MEXICAN_BANKS.filter(b => b.accepts_pece) : MEXICAN_BANKS
  const q = normalize(query)
  if (!q) return source
  return source.filter(b => {
    if (b.bank_code.startsWith(q)) return true
    const nn = normalize(b.name)
    return nn.includes(q)
  })
}

/**
 * Look up a single bank by code. O(n) over ~87 rows — acceptable.
 */
export function getBankByCode(code: string): MexicanBank | null {
  return MEXICAN_BANKS.find(b => b.bank_code === code) ?? null
}
