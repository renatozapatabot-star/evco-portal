// Map raw GlobalPC carrier codes to display names
// Based on pre-flight data: TRANS_MEX_81, TRANS_EXT_46, numeric IDs, "VARIOS"
const CARRIER_MAP: Record<string, string> = {
  'VARIOS':          'Varios / Múltiples',
  'TRANS_MEX_81':    'Transportes MEX 81',
  'TRANS_MEX_7':     'Transportes MEX 7',
  'TRANS_MEX_19':    'Transportes MEX 19',
  'TRANS_MEX_494':   'Transportes MEX 494',
  'TRANS_MEX_64':    'Transportes MEX 64',
  'TRANS_MEX_13':    'Transportes MEX 13',
  'TRANS_MEX_5':     'Transportes MEX 5',
  'TRANS_MEX_568':   'Transportes MEX 568',
  'TRANS_MEX_293':   'Transportes MEX 293',
  'TRANS_MEX_119':   'Transportes MEX 119',
  'TRANS_EXT_46':    'Carrier EXT 46',
  'TRANS_EXT_7':     'Carrier EXT 7',
  'TRANS_EXT_1':     'Carrier EXT 1',
  'TRANS_EXT_6':     'Carrier EXT 6',
  'TRANS_EXT_9':     'Carrier EXT 9',
  'TRANS_EXT_62':    'Carrier EXT 62',
}

export const fmtCarrier = (code: string | null | undefined): string => {
  if (!code) return ''
  const s = String(code).trim()
  if (CARRIER_MAP[s]) return CARRIER_MAP[s]
  // Try numeric ID → mapped key (e.g. "81" → "TRANS_MEX_81")
  if (/^\d+$/.test(s)) {
    const mxKey = `TRANS_MEX_${s}`
    const extKey = `TRANS_EXT_${s}`
    if (CARRIER_MAP[mxKey]) return CARRIER_MAP[mxKey]
    if (CARRIER_MAP[extKey]) return CARRIER_MAP[extKey]
    return 'Transporte asignado'
  }
  // Clean up raw codes
  return s
    .replace(/^TRANS_MEX_/, 'Transp. MX ')
    .replace(/^TRANS_EXT_/, 'Carrier US ')
    .replace(/_/g, ' ')
    .trim()
}

export const countryFlag = (code: string | null | undefined): string => {
  if (!code) return ''
  const flags: Record<string, string> = {
    'US': '🇺🇸', 'USA': '🇺🇸', 'ESTADOS UNIDOS': '🇺🇸',
    'MX': '🇲🇽', 'MEX': '🇲🇽', 'MEXICO': '🇲🇽', 'MÉXICO': '🇲🇽',
    'CA': '🇨🇦', 'CAN': '🇨🇦', 'CANADA': '🇨🇦',
    'CN': '🇨🇳', 'CHN': '🇨🇳', 'CHINA': '🇨🇳',
    'DE': '🇩🇪', 'DEU': '🇩🇪', 'ALEMANIA': '🇩🇪',
    'JP': '🇯🇵', 'JPN': '🇯🇵', 'JAPON': '🇯🇵',
    'KR': '🇰🇷', 'KOR': '🇰🇷', 'KOREA': '🇰🇷',
    'TW': '🇹🇼', 'TWN': '🇹🇼', 'TAIWAN': '🇹🇼',
    'IT': '🇮🇹', 'ITA': '🇮🇹', 'ITALIA': '🇮🇹',
    'FR': '🇫🇷', 'FRA': '🇫🇷', 'FRANCIA': '🇫🇷',
    'GB': '🇬🇧', 'GBR': '🇬🇧', 'UK': '🇬🇧',
    'BR': '🇧🇷', 'BRA': '🇧🇷', 'BRASIL': '🇧🇷',
    'IN': '🇮🇳', 'IND': '🇮🇳', 'INDIA': '🇮🇳',
  }
  return flags[code.toUpperCase()] || ''
}
