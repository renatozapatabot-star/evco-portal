import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { AguilaPdfHeader, AguilaPdfFooter, PDF_BORDER, PDF_TEXT_MUTED, PDF_TEXT_PRIMARY, PDF_SILVER_DIM } from '@/lib/pdf/brand'
import type { OcaRow } from '@/lib/oca/types'

const s = StyleSheet.create({
  page: { backgroundColor: '#FFFFFF', padding: 36, fontFamily: 'Helvetica', color: PDF_TEXT_PRIMARY, fontSize: 10 },
  h2: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: PDF_SILVER_DIM, letterSpacing: 1, marginTop: 14, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 6 },
  label: { width: 120, fontSize: 9, color: PDF_TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { flex: 1, fontSize: 10, color: PDF_TEXT_PRIMARY },
  mono: { fontFamily: 'Courier', fontSize: 11, color: PDF_TEXT_PRIMARY },
  para: { fontSize: 10, lineHeight: 1.5, marginTop: 6, textAlign: 'justify' },
  ruling: { marginTop: 10, padding: 12, borderWidth: 0.5, borderColor: PDF_BORDER, backgroundColor: '#FAFAF8' },
  rulingLabel: { fontSize: 8, color: PDF_TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  rulingValue: { fontSize: 16, fontFamily: 'Courier-Bold', color: PDF_TEXT_PRIMARY, letterSpacing: 1 },
  sig: { marginTop: 28, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: PDF_BORDER },
  sigName: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: PDF_TEXT_PRIMARY, marginTop: 6 },
  sigTitle: { fontSize: 9, color: PDF_TEXT_MUTED, marginTop: 2 },
  draftBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#FEF3C7', color: '#92400E', fontSize: 9, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8, marginTop: 6 },
})

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Chicago' })
}

export interface OcaPDFProps {
  opinion: OcaRow
  razonamiento?: string
}

export function OcaPDF({ opinion, razonamiento }: OcaPDFProps) {
  const isDraft = opinion.status !== 'approved'
  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <AguilaPdfHeader
          title="Opinión de Clasificación Arancelaria"
          subtitle={`${opinion.opinion_number} · emitida ${fmtDate(opinion.created_at)}`}
        />

        {isDraft && <Text style={s.draftBadge}>BORRADOR — NO APROBADA</Text>}

        <View style={s.ruling}>
          <Text style={s.rulingLabel}>Fracción arancelaria recomendada</Text>
          <Text style={s.rulingValue}>{opinion.fraccion_recomendada}</Text>
        </View>

        <Text style={s.h2}>Datos de la consulta</Text>
        <View style={s.row}><Text style={s.label}>Producto</Text><Text style={s.value}>{opinion.product_description}</Text></View>
        <View style={s.row}><Text style={s.label}>País de origen</Text><Text style={s.value}>{opinion.pais_origen}</Text></View>
        {opinion.uso_final && <View style={s.row}><Text style={s.label}>Uso final</Text><Text style={s.value}>{opinion.uso_final}</Text></View>}
        {opinion.trafico_id && <View style={s.row}><Text style={s.label}>Embarque</Text><Text style={[s.value, s.mono]}>{opinion.trafico_id}</Text></View>}

        <Text style={s.h2}>Fundamento legal</Text>
        <Text style={s.para}>{opinion.fundamento_legal || '—'}</Text>

        {razonamiento && (<>
          <Text style={s.h2}>Razonamiento técnico</Text>
          <Text style={s.para}>{razonamiento}</Text>
        </>)}

        <Text style={s.h2}>Regulaciones aplicables</Text>
        <View style={s.row}>
          <Text style={s.label}>NOM aplicable</Text>
          <Text style={s.value}>{opinion.nom_aplicable || 'Ninguna identificada'}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Elegibilidad T-MEC</Text>
          <Text style={s.value}>{opinion.tmec_elegibilidad ? 'Elegible — IGI 0% bajo criterios de origen' : 'No elegible — pagar IGI ordinario'}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Vigencia</Text>
          <Text style={s.value}>{fmtDate(opinion.vigencia_hasta)}</Text>
        </View>

        <View style={s.sig}>
          <Text style={[s.para, { fontSize: 9, color: PDF_TEXT_MUTED }]}>
            La presente opinión se emite con base en la información proporcionada por el
            consultante y las disposiciones vigentes de la Ley Aduanera, LIGIE, TIGIE y RGCE.
            Cualquier cambio en la descripción, composición o uso del producto puede alterar
            la clasificación aquí recomendada.
          </Text>
          <Text style={s.sigName}>Renato Zapata III</Text>
          <Text style={s.sigTitle}>Director General · Patente 3596 · Aduana 240 Nuevo Laredo</Text>
          {opinion.approved_at && (
            <Text style={[s.sigTitle, { marginTop: 4 }]}>Firmada: {fmtDate(opinion.approved_at)}</Text>
          )}
        </View>

        <AguilaPdfFooter label={`ZAPATA AI · ${opinion.opinion_number} · Patente 3596`} />
      </Page>
    </Document>
  )
}
