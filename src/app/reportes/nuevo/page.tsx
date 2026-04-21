/**
 * Block 3 — /reportes/nuevo shorthand: redirects to root with ?new=1.
 */
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function Page() {
  redirect('/reportes?new=1')
}
