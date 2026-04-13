import { AutoClassifyDropzone } from '@/components/documentos/AutoClassifyDropzone'
import { PageShell, GlassCard } from '@/components/aguila'
import { TEXT_SECONDARY } from '@/lib/design-system'

export const metadata = {
  title: 'Documentos · Auto-clasificación · AGUILA',
}

export default function DocumentosAutoPage() {
  return (
    <PageShell
      title="Sube un documento"
      subtitle="Arrastra un PDF o imagen. AGUILA identifica el tipo, verifica que esté completo y lo enlaza al tráfico."
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
            <li>Se aceptan PDF, JPG y PNG hasta 10 MB.</li>
            <li>Claude identifica el tipo (factura, packing list, certificado de origen, BL u otro).</li>
            <li>Se revisa que tenga proveedor, importe, moneda y fracción arancelaria.</li>
            <li>Si el documento menciona un pedimento, se enlaza automáticamente al tráfico.</li>
          </ul>
        </GlassCard>
      </div>
    </PageShell>
  )
}
