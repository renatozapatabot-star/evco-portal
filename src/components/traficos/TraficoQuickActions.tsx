'use client'

import Link from 'next/link'

const links = [
  { href: '/pedimento', label: 'Pedimento' },
  { href: '/clasificacion', label: 'Clasificación' },
  { href: '/doda', label: 'DODA' },
  { href: '/carta-porte', label: 'Carta Porte' },
  { href: '/trace', label: 'Cronología' },
]

/**
 * TraficoQuickActions — sticky top sub-nav for tráfico detail surfaces.
 *
 * Pinned to the top of the tráfico detail layout so operators can jump
 * between pedimento, clasificación, DODA, carta porte, and the trace
 * timeline without scrolling back to the header. Backdrop-blurred so it
 * sits above existing glass cards.
 */
export function TraficoQuickActions({ traficoId }: { traficoId: string }) {
  const id = encodeURIComponent(traficoId)
  return (
    <nav
      aria-label="Acciones del tráfico"
      className="sticky top-0 z-30 flex gap-2 overflow-x-auto border-b border-white/5 bg-[rgba(10,10,12,0.85)] px-4 py-3 backdrop-blur"
    >
      {links.map((l) => (
        <Link
          key={l.href}
          href={`/traficos/${id}${l.href}`}
          className="whitespace-nowrap rounded-full border border-[rgba(192,197,206,0.18)] px-4 py-2 text-xs uppercase tracking-wider text-[#C0C5CE] hover:bg-[rgba(192,197,206,0.08)]"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  )
}
