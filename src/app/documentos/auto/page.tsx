import { AutoClassifyDropzone } from '@/components/documentos/AutoClassifyDropzone'
import { PageShell, GlassCard } from '@/components/aguila'
import { TEXT_SECONDARY } from '@/lib/design-system'

export const metadata = {
  title: 'Documentos · Auto-clasificación · ZAPATA AI',
}

export default function DocumentosAutoPage() {
  return (
    <PageShell
      title="Sube o describe documentos"
      subtitle="Arrastra un lote de PDFs o pega una descripción. ZAPATA AI identifica cada tipo, revisa completitud y los enlaza al embarque."
      systemStatus="healthy"
      liveTimestamp
    >
      <div style={{ display: 'grid', gap: 'var(--aguila-gap-card, 16px)' }}>
        <AutoClassifyDropzone />

        <GlassCard size="compact">
          <div style={{ fontSize: 'var(--aguila-fs-label, 10px)', letterSpacing: 'var(--aguila-ls-label, 0.08em)', textTransform: 'uppercase', color: TEXT_SECONDARY, marginBottom: 8 }}>
            ¿Cómo funciona?
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: TEXT_SECONDARY, fontSize: 13, lineHeight: 1.6 }}>
            <li>Sube hasta varios PDFs/JPGs/PNGs (10 MB máx cada uno) o pega una descripción.</li>
            <li>Claude identifica el tipo (factura, packing list, certificado de origen, BL u otro).</li>
            <li>Se revisa que tenga proveedor, importe, moneda y fracción arancelaria.</li>
            <li>Si se menciona un pedimento, el documento se enlaza automáticamente al embarque.</li>
            <li>Al terminar el lote, verás un análisis ZAPATA AI con totales, enlaces y atenciones.</li>
          </ul>
        </GlassCard>
      </div>
    </PageShell>
  )
}
