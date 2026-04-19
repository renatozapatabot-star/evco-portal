import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import {
  AguilaPdfHeader, AguilaPdfFooter,
  PDF_BORDER, PDF_TEXT_MUTED, PDF_TEXT_PRIMARY, PDF_SILVER_DIM,
} from '@/lib/pdf/brand'
import { ORIGIN_CRITERION_LABELS, type UsmcaCertRow } from '@/lib/usmca/types'

const s = StyleSheet.create({
  page: { backgroundColor: 'var(--portal-fg-1)', padding: 36, fontFamily: 'Helvetica', color: PDF_TEXT_PRIMARY, fontSize: 'var(--aguila-fs-label)' },
  h2: { fontSize: 'var(--aguila-fs-meta)', fontFamily: 'Helvetica-Bold', color: PDF_SILVER_DIM, letterSpacing: 1, marginTop: 14, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 5 },
  label: { width: 120, fontSize: 9, color: PDF_TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { flex: 1, fontSize: 'var(--aguila-fs-label)', color: PDF_TEXT_PRIMARY },
  mono: { fontFamily: 'Courier', fontSize: 'var(--aguila-fs-meta)', color: PDF_TEXT_PRIMARY },
  para: { fontSize: 'var(--aguila-fs-label)', lineHeight: 1.5, marginTop: 4, textAlign: 'justify' },
  ruling: { marginTop: 10, padding: 12, borderWidth: 0.5, borderColor: PDF_BORDER, backgroundColor: '#FAFAF8' },
  rulingLabel: { fontSize: 8, color: PDF_TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  rulingValue: { fontSize: 'var(--aguila-fs-body-lg)', fontFamily: 'Courier-Bold', color: PDF_TEXT_PRIMARY, letterSpacing: 1 },
  sig: { marginTop: 28, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: PDF_BORDER },
  sigName: { fontSize: 'var(--aguila-fs-meta)', fontFamily: 'Helvetica-Bold', color: PDF_TEXT_PRIMARY, marginTop: 6 },
  sigTitle: { fontSize: 9, color: PDF_TEXT_MUTED, marginTop: 2 },
  draftBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'var(--portal-status-amber-bg)', color: 'var(--portal-status-amber-fg)', fontSize: 9, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8, marginTop: 6 },
  grid: { flexDirection: 'row', gap: 16, marginTop: 6 },
  col: { flex: 1 },
})

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Chicago' })
}

const ROLE_LABEL: Record<string, string> = { exporter: 'Exportador', importer: 'Importador', producer: 'Productor' }

export interface UsmcaPDFProps {
  cert: UsmcaCertRow
}

function Party({ title, name, address }: { title: string; name: string | null; address: string | null }) {
  if (!name && !address) return null
  return (
    <View style={s.col}>
      <Text style={[s.label, { width: 'auto', marginBottom: 3 }]}>{title}</Text>
      <Text style={s.value}>{name || '—'}</Text>
      {address && <Text style={[s.value, { fontSize: 9, color: PDF_TEXT_MUTED }]}>{address}</Text>}
    </View>
  )
}

export function UsmcaPDF({ cert }: UsmcaPDFProps) {
  const isDraft = cert.status !== 'approved'
  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <AguilaPdfHeader
          title="Certificado de Origen USMCA / T-MEC"
          subtitle={`${cert.certificate_number} · emitido ${fmtDate(cert.created_at)}`}
        />

        {isDraft && <Text style={s.draftBadge}>BORRADOR — NO FIRMADO</Text>}

        <View style={s.ruling}>
          <Text style={s.rulingLabel}>Clasificación armonizada (HS)</Text>
          <Text style={s.rulingValue}>{cert.hs_code}</Text>
          <Text style={[s.rulingLabel, { marginTop: 8 }]}>Criterio de origen</Text>
          <Text style={[s.value, { fontSize: 'var(--aguila-fs-meta)', fontFamily: 'Helvetica-Bold', marginTop: 2 }]}>
            {ORIGIN_CRITERION_LABELS[cert.origin_criterion]}
          </Text>
          {cert.rvc_method && (
            <Text style={[s.value, { fontSize: 9, color: PDF_TEXT_MUTED, marginTop: 2 }]}>
              Método RVC · {cert.rvc_method}
            </Text>
          )}
        </View>

        <Text style={s.h2}>Bienes amparados</Text>
        <Text style={s.para}>{cert.goods_description}</Text>
        <View style={s.row}>
          <Text style={s.label}>País de origen</Text>
          <Text style={s.value}>{cert.country_of_origin}</Text>
        </View>

        <Text style={s.h2}>Certificador</Text>
        <View style={s.row}><Text style={s.label}>Rol</Text><Text style={s.value}>{ROLE_LABEL[cert.certifier_role] ?? cert.certifier_role}</Text></View>
        <View style={s.row}><Text style={s.label}>Nombre</Text><Text style={s.value}>{cert.certifier_name}</Text></View>
        {cert.certifier_title && <View style={s.row}><Text style={s.label}>Cargo</Text><Text style={s.value}>{cert.certifier_title}</Text></View>}
        {cert.certifier_address && <View style={s.row}><Text style={s.label}>Domicilio</Text><Text style={s.value}>{cert.certifier_address}</Text></View>}
        {cert.certifier_email && <View style={s.row}><Text style={s.label}>Correo</Text><Text style={s.value}>{cert.certifier_email}</Text></View>}
        {cert.certifier_phone && <View style={s.row}><Text style={s.label}>Teléfono</Text><Text style={s.value}>{cert.certifier_phone}</Text></View>}

        <Text style={s.h2}>Partes</Text>
        <View style={s.grid}>
          <Party title="Exportador" name={cert.exporter_name} address={cert.exporter_address} />
          <Party title="Productor" name={cert.producer_name} address={cert.producer_address} />
          <Party title="Importador" name={cert.importer_name} address={cert.importer_address} />
        </View>

        {(cert.blanket_from || cert.blanket_to) && (
          <>
            <Text style={s.h2}>Periodo blanket</Text>
            <View style={s.row}>
              <Text style={s.label}>Desde</Text>
              <Text style={[s.value, s.mono]}>{cert.blanket_from ?? '—'}</Text>
              <Text style={s.label}>Hasta</Text>
              <Text style={[s.value, s.mono]}>{cert.blanket_to ?? '—'}</Text>
            </View>
          </>
        )}

        {cert.notes && (
          <>
            <Text style={s.h2}>Notas</Text>
            <Text style={s.para}>{cert.notes}</Text>
          </>
        )}

        <View style={s.sig}>
          <Text style={[s.para, { fontSize: 9, color: PDF_TEXT_MUTED }]}>
            Certifico que los bienes arriba descritos califican como originarios bajo el
            Tratado entre México, Estados Unidos y Canadá (USMCA / T-MEC), Artículo 5.2,
            y que la información aquí contenida es verdadera y exacta. Conservo la
            documentación soporte por un mínimo de cinco años.
          </Text>
          <Text style={s.sigName}>Renato Zapata III</Text>
          <Text style={s.sigTitle}>Director General · Patente 3596 · Aduana 240 · Laredo, TX</Text>
          {cert.approved_at && (
            <Text style={[s.sigTitle, { marginTop: 4 }]}>
              Firmado digitalmente · {fmtDate(cert.approved_at)}
            </Text>
          )}
        </View>

        <AguilaPdfFooter />
      </Page>
    </Document>
  )
}
