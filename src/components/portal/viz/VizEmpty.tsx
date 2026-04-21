export interface VizEmptyProps {
  label?: string
}

/**
 * Dashed-border placeholder for cards whose data isn't live yet.
 * Mono micro uppercase with wide tracking — reads as "coming soon."
 *
 * Ported from screen-dashboard.jsx:196-202.
 */
export function VizEmpty({ label = 'PRÓXIMAMENTE' }: VizEmptyProps) {
  return (
    <div
      style={{
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px dashed var(--portal-line-2)',
        borderRadius: 'var(--portal-r-2)',
        color: 'var(--portal-fg-5)',
        fontSize: 10,
        letterSpacing: '0.18em',
        fontFamily: 'var(--portal-font-mono)',
      }}
    >
      {label}
    </div>
  )
}
