// CRUZ Design System — Global Status Badge
// Use this component everywhere. Never inline badge styles.

type Status = 'borrador' | 'revision' | 'en_proceso' | 'retrasado' | 'estancado' | 'transmitido' | 'pagado' | 'cruzado' | 'error'

const STATUS_CONFIG: Record<Status, { label: string; bg: string; text: string; border: string }> = {
  borrador:    { label: 'Borrador',     bg: 'bg-gray-50',   text: 'text-gray-600',   border: 'border-gray-200' },
  revision:    { label: 'En revisión',  bg: 'bg-slate-50',  text: 'text-slate-600',  border: 'border-slate-200' },
  en_proceso:  { label: 'En proceso',   bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  retrasado:   { label: 'Retrasado',    bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  estancado:   { label: 'Estancado',    bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  transmitido: { label: 'Transmitido',  bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200' },
  pagado:      { label: 'Pagado',       bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' },
  cruzado:     { label: 'Cruzado',      bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' },
  error:       { label: 'Error',        bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
}

export type { Status }

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.en_proceso
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bg} ${config.text} ${config.border}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label || config.label}
    </span>
  )
}
