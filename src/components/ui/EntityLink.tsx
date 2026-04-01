import Link from 'next/link'

type EntityType = 'trafico' | 'expediente' | 'entrada' | 'pedimento'

const ROUTES: Record<EntityType, (id: string) => string> = {
  trafico:    id => `/traficos/${id}`,
  expediente: id => `/expedientes/${id}`,
  entrada:    id => `/entradas/${id}`,
  pedimento:  id => `/pedimentos/${id}`,
}

export function EntityLink({ type, id, label }: {
  type: EntityType; id: string; label: string
}) {
  return (
    <Link
      href={ROUTES[type](id)}
      style={{
        color: 'var(--accent-primary)',
        fontFamily: 'var(--font-data)',
        fontSize: 13,
        textDecoration: 'none',
        borderBottom: '1px dotted var(--accent-primary)',
        transition: 'border-style 120ms',
      }}
    >
      {label}
    </Link>
  )
}
