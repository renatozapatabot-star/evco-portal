/**
 * CRUZ · V1.5 F19 — Entrada 4×6" thermal label template.
 *
 * Rendered to PDF via @react-pdf/renderer so Vicente's phone can open the
 * file and hand it to the browser's print dialog (which then talks to his
 * thermal printer over the OS print queue). Direct IPP/Zebra driver push
 * is deferred — browser print is the common denominator.
 *
 * Output surface: 4×6 inches = 288×432 pt at 72dpi. White background is
 * correct (thermal printers need white — the CRUZ dark cockpit ends at
 * the label boundary). Silver + black ink.
 *
 * Pairs with F1 QR codes: `createEntradaQrCode()` is called first if the
 * entrada has no code yet. The QR data URL is embedded directly so the
 * label is self-contained.
 */
import React from 'react'
import {
  Document as PdfDoc,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'
import QRCode from 'qrcode'

export interface EntradaLabelInput {
  qrCode: string // short code, e.g. "ABCD23JKLM"
  qrDataUrl?: string | null // optional pre-rendered PNG data URL
  traficoRef: string
  clienteName: string
  dockAssigned?: string | null
  trailerNumber?: string | null
  receivedAt?: string | null // ISO
}

// 4" × 6" label at 72dpi → 288pt × 432pt.
const LABEL_WIDTH_PT = 288
const LABEL_HEIGHT_PT = 432

const styles = StyleSheet.create({
  page: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    color: 'var(--portal-ink-0)',
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#7A7E86',
    paddingBottom: 6,
  },
  brand: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 2,
    color: '#6B7280',
  },
  brandTag: {
    fontSize: 7,
    color: '#6B7280',
  },
  qrWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 10,
  },
  qrImage: {
    width: 180,
    height: 180,
  },
  qrCodeText: {
    fontFamily: 'Courier-Bold',
    fontSize: 11,
    letterSpacing: 2,
    color: '#111827',
    marginTop: 4,
  },
  infoBlock: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  labelKey: {
    fontSize: 7,
    color: '#6B7280',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  traficoRef: {
    fontFamily: 'Courier-Bold',
    fontSize: 20,
    color: '#111827',
    letterSpacing: 1,
  },
  cliente: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  dock: {
    fontFamily: 'Courier-Bold',
    fontSize: 16,
    color: '#111827',
  },
  small: {
    fontSize: 9,
    color: '#374151',
    fontFamily: 'Courier',
  },
  footer: {
    position: 'absolute',
    bottom: 10,
    left: 16,
    right: 16,
    fontSize: 6,
    color: '#6B7280',
    textAlign: 'center',
    borderTopWidth: 0.5,
    borderTopColor: '#E5E7EB',
    paddingTop: 4,
  },
})

/**
 * Format ISO timestamp in es-MX, Laredo timezone. Kept local to avoid a
 * React hook boundary (format-utils imports client config). The PDF lives
 * server-side; we must not pull a 'use client' module in.
 */
function fmtLabelDateTime(iso?: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Chicago',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d)
  } catch {
    return '—'
  }
}

export function EntradaLabelDocument({ input }: { input: EntradaLabelInput }) {
  const receivedAt = fmtLabelDateTime(input.receivedAt ?? new Date().toISOString())
  return (
    <PdfDoc>
      <Page size={[LABEL_WIDTH_PT, LABEL_HEIGHT_PT]} style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>CRUZ</Text>
          <Text style={styles.brandTag}>Patente 3596 · Aduana 240</Text>
        </View>

        <View style={styles.qrWrap}>
          {input.qrDataUrl ? (
            <Image src={input.qrDataUrl} style={styles.qrImage} />
          ) : (
            <Text style={styles.small}>QR pendiente</Text>
          )}
          <Text style={styles.qrCodeText}>{input.qrCode}</Text>
        </View>

        <View style={styles.infoBlock}>
          <Text style={styles.labelKey}>Embarque</Text>
          <Text style={styles.traficoRef}>{input.traficoRef}</Text>

          <Text style={[styles.labelKey, { marginTop: 6 }]}>Cliente</Text>
          <Text style={styles.cliente}>{input.clienteName}</Text>

          <View style={[styles.row, { marginTop: 8 }]}>
            <View>
              <Text style={styles.labelKey}>Andén</Text>
              <Text style={styles.dock}>{input.dockAssigned || '—'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.labelKey}>Caja</Text>
              <Text style={styles.dock}>{input.trailerNumber || '—'}</Text>
            </View>
          </View>

          <Text style={[styles.labelKey, { marginTop: 8 }]}>Recibida</Text>
          <Text style={styles.small}>{receivedAt}</Text>
        </View>

        <Text style={styles.footer}>
          CRUZ · Inteligencia aduanal · Patente 3596
        </Text>
      </Page>
    </PdfDoc>
  )
}

/**
 * Resolve a QR data URL — use pre-rendered if present, else generate
 * from the short code. Keeps the route handler thin.
 */
export async function ensureQrDataUrl(input: EntradaLabelInput): Promise<string> {
  if (input.qrDataUrl) return input.qrDataUrl
  return QRCode.toDataURL(input.qrCode, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 512,
  })
}

export async function renderEntradaLabelPdf(input: EntradaLabelInput): Promise<Buffer> {
  const qrDataUrl = await ensureQrDataUrl(input)
  const prepared: EntradaLabelInput = { ...input, qrDataUrl }
  return renderToBuffer(<EntradaLabelDocument input={prepared} />)
}
