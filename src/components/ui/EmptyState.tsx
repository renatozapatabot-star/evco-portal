import Link from 'next/link'

interface EmptyStateProps {
  icon: string
  title: string
  description: string
  cta?: { label: string; href: string }
}

export function EmptyState({ icon, title, description, cta }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#252219',
      borderRadius: 12,
      padding: '48px 32px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 16 }}>{icon}</div>
      <h3 style={{
        fontSize: 16,
        fontWeight: 700,
        color: '#F5F0E8',
        margin: '0 0 8px',
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: 14,
        color: '#A09882',
        margin: 0,
        maxWidth: 320,
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
            background: '#B8953F',
            color: '#FFFFFF',
            borderRadius: 6,
            padding: '10px 20px',
            fontSize: 14,
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
