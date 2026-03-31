import { FileText, Truck, Package, FolderOpen, BarChart3, CreditCard, Bell, Table2 } from 'lucide-react'

const ICONS: Record<string, any> = {
  traficos: Truck, entradas: Package, pedimentos: FileText,
  expedientes: FolderOpen, reportes: BarChart3, cuentas: CreditCard,
  alertas: Bell, anexo24: Table2,
}

const DEFAULTS: Record<string, { title: string; desc: string }> = {
  traficos: { title: 'Sin tráficos todavía', desc: 'Cuando se registre tu primer embarque en GlobalPC, aparecerá aquí automáticamente.' },
  entradas: { title: 'Sin entradas registradas', desc: 'Las remesas de bodega se sincronizarán desde GlobalPC en la próxima actualización.' },
  pedimentos: { title: 'Sin pedimentos', desc: 'Los pedimentos aparecerán cuando se procesen tus primeras operaciones.' },
  expedientes: { title: 'Sin expedientes activos', desc: 'Los expedientes se crean automáticamente cuando se registran tráficos con documentos.' },
  reportes: { title: 'Datos insuficientes para reportes', desc: 'Se necesitan al menos 2 semanas de operaciones para generar reportes analíticos.' },
  cuentas: { title: 'Sin movimientos financieros', desc: 'Los datos de eConta se sincronizarán en la próxima actualización nocturna.' },
  alertas: { title: 'Sin alertas activas', desc: 'Todo está en orden. No hay acciones urgentes por el momento.' },
  anexo24: { title: 'Anexo 24 pendiente de sincronización', desc: 'Los datos IMMEX aparecerán cuando se sincronicen desde el sistema.' },
}

interface Props { page: string; title?: string; description?: string }

export function EmptyState({ page, title, description }: Props) {
  const Icon = ICONS[page] || FileText
  const d = DEFAULTS[page] || { title: 'Información no disponible', desc: 'Los datos aparecerán cuando estén disponibles.' }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '80px 20px', textAlign: 'center',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: 'var(--n-50)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', marginBottom: 20,
      }}>
        <Icon size={28} strokeWidth={1.5} style={{ color: 'var(--n-300)' }} />
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--n-900)', margin: '0 0 8px' }}>
        {title || d.title}
      </h3>
      <p style={{ fontSize: 14, color: 'var(--n-400)', maxWidth: 360, lineHeight: 1.5 }}>
        {description || d.desc}
      </p>
    </div>
  )
}
