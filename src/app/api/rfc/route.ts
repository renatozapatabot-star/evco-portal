import { NextRequest, NextResponse } from 'next/server'

function validateRFC(rfc: string) {
  const r = rfc.trim().toUpperCase(); const errors: string[] = []
  const moral = /^[A-ZÑ&]{3}[0-9]{6}[A-Z0-9]{3}$/; const fisica = /^[A-ZÑ&]{4}[0-9]{6}[A-Z0-9]{3}$/
  const isMoral = moral.test(r); const isFisica = fisica.test(r)
  if (!isMoral && !isFisica) { errors.push('Formato RFC inválido'); if (r.length !== 12 && r.length !== 13) errors.push(`Longitud: ${r.length} (esperado 12-13)`) }
  if (['XAXX010101000', 'XEXX010101000'].includes(r)) errors.push('RFC genérico')
  return { valid: errors.length === 0, type: isMoral ? 'Persona Moral' : isFisica ? 'Persona Física' : 'Desconocido', errors }
}

export async function GET(request: NextRequest) {
  const rfc = request.nextUrl.searchParams.get('rfc')
  if (!rfc) return NextResponse.json({ error: 'RFC required' }, { status: 400 })
  return NextResponse.json({ rfc: rfc.trim().toUpperCase(), ...validateRFC(rfc), note: 'Validación formato. Para verificar en SAT: sat.gob.mx/consultas/RFC' })
}
