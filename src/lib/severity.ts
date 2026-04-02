export const THRESHOLDS = { RED: 50, AMBER: 80 }

export const severityColor = (pct: number) =>
  pct >= THRESHOLDS.AMBER ? '#16A34A' :
  pct >= THRESHOLDS.RED ? '#D4952A' : 'var(--danger-500)'

export const severityLabel = (pct: number) =>
  pct >= THRESHOLDS.AMBER ? 'Excelente' :
  pct >= THRESHOLDS.RED ? 'Revisar' : 'Urgente'

export const severityCSSVar = (pct: number) =>
  pct >= THRESHOLDS.AMBER ? 'var(--success)' :
  pct >= THRESHOLDS.RED ? 'var(--warning)' : 'var(--danger)'
