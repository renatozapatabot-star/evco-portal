'use client'
import { FolderOpen, Search, CheckCircle, Bell, MessageCircle, AlertTriangle, RefreshCw } from 'lucide-react'

type Variant = 'traficos' | 'traficos_filtered' | 'expedientes_complete' | 'notifications_empty' | 'search_no_results' | 'chat_empty' | 'error' | 'generic'

const VARIANTS: Record<Variant, { icon: React.ReactNode; title: string; message: string }> = {
  traficos: {
    icon: <span style={{ fontSize: 24 }}>🚚</span>,
    title: 'Sin tráficos activos',
    message: 'No hay operaciones en proceso para el período seleccionado.',
  },
  traficos_filtered: {
    icon: <Search size={20} style={{ color: 'var(--gold-600)' }} />,
    title: 'Sin resultados',
    message: 'No se encontraron tráficos con los filtros aplicados.',
  },
  expedientes_complete: {
    icon: <CheckCircle size={20} style={{ color: 'var(--success)' }} />,
    title: 'Todos los expedientes completos',
    message: 'No hay documentos pendientes.',
  },
  notifications_empty: {
    icon: <Bell size={20} style={{ color: 'var(--gold-600)' }} />,
    title: 'Sin alertas activas',
    message: 'Tu operación está bajo control.',
  },
  search_no_results: {
    icon: <Search size={20} style={{ color: 'var(--n-400)' }} />,
    title: 'Sin resultados',
    message: 'Verifica el número o intenta con el pedimento.',
  },
  chat_empty: {
    icon: <MessageCircle size={20} style={{ color: 'var(--gold-600)' }} />,
    title: 'Pregúntame cualquier cosa',
    message: 'sobre tus operaciones aduanales',
  },
  error: {
    icon: <AlertTriangle size={20} style={{ color: 'var(--danger)' }} />,
    title: 'Error al cargar datos',
    message: 'Ocurrió un error inesperado.',
  },
  generic: {
    icon: <FolderOpen size={20} style={{ color: 'var(--gold-600)' }} />,
    title: 'Sin datos',
    message: 'No hay información disponible.',
  },
}

interface Props {
  variant?: Variant
  icon?: React.ReactNode
  title?: string
  subtitle?: string
  searchQuery?: string
  action?: { label: string; onClick: () => void }
  onRetry?: () => void
}

export default function EmptyState({
  variant = 'generic',
  icon,
  title,
  subtitle,
  searchQuery,
  action,
  onRetry,
}: Props) {
  const v = VARIANTS[variant]
  const displayTitle = title || (searchQuery ? v.title.replace('{query}', searchQuery) : v.title)
  const displayMessage = subtitle || v.message

  return (
    <div className="empty-state" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '64px 32px', textAlign: 'center',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 8,
        background: variant === 'error' ? 'var(--danger-bg, rgba(220,38,38,0.06))' : 'rgba(212,168,67,0.1)',
        border: variant === 'error' ? '1px solid rgba(220,38,38,0.15)' : '1px solid var(--border-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
      }}>
        {icon || v.icon}
      </div>
      <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{displayTitle}</p>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 320 }}>{displayMessage}</p>
      {action && (
        <button onClick={action.onClick} style={{
          marginTop: 16, padding: '8px 24px', borderRadius: 8,
          background: 'rgba(212,168,67,0.1)', border: '1px solid var(--border-primary)',
          color: 'var(--gold-600)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
        }}>{action.label}</button>
      )}
      {onRetry && (
        <button onClick={onRetry} style={{
          marginTop: 16, padding: '8px 24px', borderRadius: 8,
          background: 'none', border: '1px solid var(--border-default)',
          color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <RefreshCw size={13} /> Reintentar
        </button>
      )}
    </div>
  )
}
