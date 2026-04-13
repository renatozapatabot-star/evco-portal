import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { isValidHsCode, nextCertificateNumber } from '@/lib/usmca/certificate-number'
import type { UsmcaCertRow } from '@/lib/usmca/types'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const bodySchema = z.object({
  trafico_id: z.string().optional(),
  certifier_role: z.enum(['exporter', 'importer', 'producer']),
  certifier_name: z.string().min(2).max(200),
  certifier_title: z.string().max(120).optional(),
  certifier_address: z.string().max(400).optional(),
  certifier_email: z.string().email().optional().or(z.literal('')),
  certifier_phone: z.string().max(40).optional(),
  exporter_name: z.string().max(200).optional(),
  exporter_address: z.string().max(400).optional(),
  producer_name: z.string().max(200).optional(),
  producer_address: z.string().max(400).optional(),
  importer_name: z.string().max(200).optional(),
  importer_address: z.string().max(400).optional(),
  goods_description: z.string().min(5).max(2000),
  hs_code: z.string().refine(isValidHsCode, 'HS inválido — mínimo 6 dígitos (formato XXXX.XX)'),
  origin_criterion: z.enum(['A', 'B', 'C', 'D']),
  rvc_method: z.string().max(80).optional(),
  country_of_origin: z.string().min(2).max(3).default('US'),
  blanket_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  blanket_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(1000).optional(),
}).refine(
  d => !d.blanket_from || !d.blanket_to || d.blanket_to >= d.blanket_from,
  { message: 'blanket_to debe ser posterior a blanket_from', path: ['blanket_to'] },
).refine(
  d => !d.blanket_from || !d.blanket_to
    || (Date.parse(d.blanket_to) - Date.parse(d.blanket_from)) / 86400000 <= 366,
  { message: 'Blanket period no puede exceder 12 meses (USMCA Art. 5.2)', path: ['blanket_to'] },
)

function err(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) return err('UNAUTHORIZED', 'Sesión requerida', 401)
  if (!['admin', 'broker', 'operator'].includes(session.role)) {
    return err('FORBIDDEN', 'Sólo admin, broker u operador pueden emitir certificados', 403)
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join('; '), 400)
  }

  const companyId = request.cookies.get('company_id')?.value ?? null
  const certificateNumber = await nextCertificateNumber(supabase)

  const { data: inserted, error: insErr } = await supabase
    .from('usmca_certificates')
    .insert({
      certificate_number: certificateNumber,
      company_id: companyId,
      trafico_id: parsed.data.trafico_id ?? null,
      certifier_role: parsed.data.certifier_role,
      certifier_name: parsed.data.certifier_name,
      certifier_title: parsed.data.certifier_title ?? null,
      certifier_address: parsed.data.certifier_address ?? null,
      certifier_email: parsed.data.certifier_email || null,
      certifier_phone: parsed.data.certifier_phone ?? null,
      exporter_name: parsed.data.exporter_name ?? null,
      exporter_address: parsed.data.exporter_address ?? null,
      producer_name: parsed.data.producer_name ?? null,
      producer_address: parsed.data.producer_address ?? null,
      importer_name: parsed.data.importer_name ?? null,
      importer_address: parsed.data.importer_address ?? null,
      goods_description: parsed.data.goods_description,
      hs_code: parsed.data.hs_code,
      origin_criterion: parsed.data.origin_criterion,
      rvc_method: parsed.data.rvc_method ?? null,
      country_of_origin: parsed.data.country_of_origin,
      blanket_from: parsed.data.blanket_from ?? null,
      blanket_to: parsed.data.blanket_to ?? null,
      notes: parsed.data.notes ?? null,
      generated_by: session.role,
      status: 'draft',
    })
    .select()
    .single<UsmcaCertRow>()

  if (insErr || !inserted) {
    return err('INTERNAL_ERROR', `No se pudo guardar certificado: ${insErr?.message ?? 'unknown'}`, 500)
  }

  return NextResponse.json({ data: { certificate: inserted }, error: null })
}
