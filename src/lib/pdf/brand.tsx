/**
 * CRUZ · Shared PDF brand components.
 *
 * Extracted from Block 5's `classification-pdf.tsx` so every PDF surface
 * (hoja de clasificación, Anexo 24, DODA, Carta Porte, AVC) renders the same
 * silver wordmark + stylized eagle + footer. Output must remain byte-identical
 * for existing callers — any style change here ripples through 5+ PDFs.
 */
import React from 'react'
import {
  Text,
  View,
  StyleSheet,
  Svg,
  Path,
  Defs,
  LinearGradient,
  Stop,
} from '@react-pdf/renderer'

export const PDF_SILVER = '#C0C5CE'
export const PDF_SILVER_BRIGHT = '#E8EAED'
export const PDF_SILVER_DIM = '#7A7E86'
export const PDF_TEXT_MUTED = '#6B7280'
export const PDF_TEXT_PRIMARY = '#111827'
export const PDF_BORDER = '#E5E7EB'
export const PDF_ZEBRA = '#F9FAFB'

// Silhouette path kept deliberately simple so @react-pdf renders reliably.
export const EAGLE_PATH =
  'M20 2 L24 8 L30 6 L26 12 L34 14 L28 18 L36 22 L28 22 L30 30 L24 26 L20 34 L16 26 L10 30 L12 22 L4 22 L12 18 L6 14 L14 12 L10 6 L16 8 Z'

const headerStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1.5,
    borderBottomColor: PDF_SILVER,
    paddingBottom: 10,
    marginBottom: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  wordmark: { marginLeft: 10, flexDirection: 'column' },
  brandName: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: PDF_SILVER_DIM,
    letterSpacing: 3,
  },
  brandSubtitle: { fontSize: 8, color: PDF_TEXT_MUTED, marginTop: 2 },
  headerRight: { flexDirection: 'column', alignItems: 'flex-end' },
  sheetTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: PDF_TEXT_PRIMARY,
    letterSpacing: 1,
  },
  sheetDate: { fontSize: 8, color: PDF_TEXT_MUTED, marginTop: 2 },
})

const footerStyles = StyleSheet.create({
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 28,
    right: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: PDF_TEXT_MUTED,
    borderTopWidth: 0.5,
    borderTopColor: PDF_BORDER,
    paddingTop: 6,
  },
})

interface HeaderProps {
  title: string
  subtitle?: string
  gradientId?: string
  /**
   * When the @react-pdf renderer's gradient serialization fails (or any
   * downstream PDF viewer renders gradients poorly), set this true to render
   * the eagle as a flat-fill silhouette. Default false preserves existing
   * gradient behaviour for callers that look correct already.
   */
  solidFallback?: boolean
  /**
   * Eagle mark size in points. Default 56 — large enough to read on letter
   * at standard zoom. Was 40 before; bumped because the gradient eagle was
   * reported as nearly invisible in some viewers.
   */
  eagleSize?: number
  /**
   * Hide the eagle mark entirely — wordmark-only header. Used on surfaces
   * where the icon competes with dense content (Anexo 24 tabular export).
   * Default false preserves existing hero-PDF behavior.
   */
  hideEagle?: boolean
}

export function AguilaPdfHeader({
  title,
  subtitle,
  gradientId = 'silverGrad',
  solidFallback = false,
  eagleSize = 56,
  hideEagle = false,
}: HeaderProps) {
  return (
    <View style={headerStyles.header} fixed>
      <View style={headerStyles.headerLeft}>
        {!hideEagle && (
          <Svg width={eagleSize} height={eagleSize} viewBox="0 0 40 36">
            {!solidFallback && (
              <Defs>
                <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={PDF_SILVER_BRIGHT} />
                  <Stop offset="0.5" stopColor={PDF_SILVER} />
                  <Stop offset="1" stopColor={PDF_SILVER_DIM} />
                </LinearGradient>
              </Defs>
            )}
            <Path
              d={EAGLE_PATH}
              fill={solidFallback ? PDF_SILVER : `url(#${gradientId})`}
              stroke={PDF_SILVER_DIM}
              strokeWidth={0.5}
            />
          </Svg>
        )}
        <View style={hideEagle ? undefined : headerStyles.wordmark}>
          <Text style={headerStyles.brandName}>CRUZ</Text>
          <Text style={headerStyles.brandSubtitle}>
            Inteligencia aduanal · Patente 3596
          </Text>
        </View>
      </View>
      <View style={headerStyles.headerRight}>
        <Text style={headerStyles.sheetTitle}>{title}</Text>
        {subtitle ? (
          <Text style={headerStyles.sheetDate}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  )
}

interface FooterProps {
  label?: string
}

export function AguilaPdfFooter({
  label = 'CRUZ · Patente 3596 · Aduana 240 Nuevo Laredo',
}: FooterProps) {
  return (
    <View style={footerStyles.footer} fixed>
      <Text>{label}</Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `Pagina ${pageNumber} / ${totalPages}`
        }
      />
    </View>
  )
}
