import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Props {
  params: Promise<{ id: string }>
  children: React.ReactNode
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const traficoId = decodeURIComponent(id)

  const { data: t } = await supabase
    .from('traficos')
    .select('trafico, estatus, importe_total, descripcion_mercancia')
    .eq('trafico', traficoId)
    .maybeSingle()

  if (!t) {
    return {
      title: `Tráfico ${traficoId} · CRUZ`,
      description: 'Tráfico no encontrado',
    }
  }

  const estatus = t.estatus ?? 'En Proceso'
  const valor = t.importe_total ? `$${Number(t.importe_total).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} USD` : ''
  const mercancia = t.descripcion_mercancia ? String(t.descripcion_mercancia).slice(0, 80) : ''

  const descParts = [`Estatus: ${estatus}`]
  if (valor) descParts.push(`Valor: ${valor}`)
  if (mercancia) descParts.push(mercancia)
  const description = descParts.join(' · ')

  return {
    title: `Tráfico ${traficoId} · CRUZ`,
    description,
    openGraph: {
      title: `Tráfico ${traficoId} · CRUZ`,
      description,
      siteName: 'CRUZ — Cross-Border Intelligence',
    },
  }
}

export default function TraficoDetailLayout({ children }: Props) {
  return children
}
