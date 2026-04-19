// PORTAL Design System — Global Status Badge
// Use this component everywhere. Never inline badge styles.

type Status = 'borrador' | 'revision' | 'en_proceso' | 'retrasado' | 'estancado' | 'transmitido' | 'pagado' | 'cruzado' | 'error'

type StatusTone = 'gray' | 'slate' | 'amber' | 'orange' | 'teal' | 'green' | 'red'

const STATUS_CONFIG: Record<
  Status,
  { label: string; light: { bg: string; text: string; border: string }; tone: StatusTone }
> = {
  borrador:    { label: 'Borrador',     light: { bg: 'bg-gray-50',   text: 'text-gray-600',   border: 'border-gray-200'   }, tone: 'gray'   },
  revision:    { label: 'En revisión',  light: { bg: 'bg-slate-50',  text: 'text-slate-600',  border: 'border-slate-200'  }, tone: 'slate'  },
  en_proceso:  { label: 'En proceso',   light: { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200'  }, tone: 'amber'  },
  retrasado:   { label: 'Retrasado',    light: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' }, tone: 'orange' },
  estancado:   { label: 'Estancado',    light: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' }, tone: 'orange' },
  transmitido: { label: 'Transmitido',  light: { bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200'   }, tone: 'teal'   },
  pagado:      { label: 'Pagado',       light: { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200'  }, tone: 'green'  },
  cruzado:     { label: 'Cruzado',      light: { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200'  }, tone: 'green'  },
  error:       { label: 'Error',        light: { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200'    }, tone: 'red'    },
}

export type { Status }

export interface StatusBadgeProps {
  status: Status
  /** Optional label override. */
  label?: string
  /**
   * Rendering variant. 'light' uses Tailwind light-theme classes (warm-white
   * backgrounds, legacy surfaces). 'dark' uses --portal-status-* tokens that
   * read correctly on the v6 cinematic canvas. Defaults to 'dark'.
   */
  variant?: 'light' | 'dark'
}

export function StatusBadge({ status, label, variant = 'dark' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.en_proceso

  if (variant === 'light') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.light.bg} ${config.light.text} ${config.light.border}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {label || config.label}
      </span>
    )
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 999,
        background: `var(--portal-status-${config.tone}-bg)`,
        color: `var(--portal-status-${config.tone}-fg)`,
        border: `1px solid var(--portal-status-${config.tone}-ring)`,
        fontSize: 'var(--portal-fs-tiny, 11px)',
        fontWeight: 600,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: 'currentColor',
        }}
      />
      {label || config.label}
    </span>
  )
}
