import Link from 'next/link'

interface EmptyStateProps {
  icon: string
  title: string
  description: string
  cta?: { label: string; href: string }
}

/**
 * v2 EmptyState — light theme, centered, with optional CTA.
 * Icon at 48px in slate-300, title in text-title slate-600,
 * description in text-body slate-400.
 */
export function EmptyState({ icon, title, description, cta }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 32px',
      textAlign: 'center',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: 'var(--slate-100)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: 'var(--aguila-fs-title)', marginBottom: 16, color: 'var(--slate-400)',
      }}>
        {icon}
      </div>
      <h3 style={{
        fontSize: 'var(--text-title)',
        fontWeight: 600,
        color: 'var(--slate-600)',
        margin: '0 0 8px',
        lineHeight: 1.3,
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: 'var(--text-body)',
        color: 'var(--slate-400)',
        margin: 0,
        maxWidth: 360,
        lineHeight: 1.5,
      }}>
        {description}
      </p>
      {cta && (
        <Link
          href={cta.href}
          style={{
            marginTop: 20,
            display: 'inline-block',
            background: 'var(--gold-400)',
            color: 'var(--navy-900)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 20px',
            fontSize: 'var(--aguila-fs-section)',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          {cta.label}
        </Link>
      )}
    </div>
  )
}
