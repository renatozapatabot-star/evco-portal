/**
 * GET /api/pitch-pdf — renders the 1-page pitch PDF on demand.
 *
 * Reuses the existing React-PDF pitch document already authored for
 * the cold-email campaign (scripts/cold-outreach/pitch-pdf.tsx).
 * Public endpoint — any prospect can download. No session required.
 *
 * Cache-Control: immutable content per build (design is locked),
 * so we let Vercel/edge cache for 1 hour. Bust via redeploy.
 *
 * Response: application/pdf with Content-Disposition set to inline
 * for browser preview; callers that want a download pass ?download=1.
 */

import { renderToBuffer } from '@react-pdf/renderer'
import { NextRequest, NextResponse } from 'next/server'
import { PitchPDF, type PitchData } from '../../../../scripts/cold-outreach/pitch-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GENERIC_PITCH: PitchData = {
  recipientCompany: 'su operación',
  generatedDate: new Date().toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }),
  opinionRef: 'RZC-PITCH-PUBLIC',
  portalUrl: 'portal.renatozapata.com',
  cta: {
    email: 'renato@renatozapata.com',
    whatsapp: '+52 956 123 4567',
  },
}

export async function GET(req: NextRequest) {
  const download = req.nextUrl.searchParams.get('download') === '1'

  // Optional per-call personalization via query params. Safe defaults
  // fall back to the generic pitch.
  const recipientCompany =
    req.nextUrl.searchParams.get('firm')?.trim().slice(0, 120) ||
    GENERIC_PITCH.recipientCompany
  const recipientFirstName =
    req.nextUrl.searchParams.get('name')?.trim().slice(0, 80) || undefined

  const data: PitchData = {
    ...GENERIC_PITCH,
    recipientCompany,
    recipientFirstName,
    // Refresh the date each render so the PDF always reads "today"
    generatedDate: new Date().toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  }

  let buffer: Buffer
  try {
    buffer = await renderToBuffer(<PitchPDF data={data} />)
  } catch {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'pdf_render_failed',
        },
      },
      { status: 500 },
    )
  }

  // Buffer → Uint8Array for NextResponse body
  const body = new Uint8Array(buffer)

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': download
        ? 'attachment; filename="renato-zapata-pitch.pdf"'
        : 'inline; filename="renato-zapata-pitch.pdf"',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
