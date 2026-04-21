import { redirect } from 'next/navigation'

/**
 * V1.5 consolidation — /admin/inicio is now an alias for /admin/eagle.
 * The Eagle View is the canonical admin/broker cockpit (9.5/10 audit rating).
 * Preserves any existing bookmarks or links.
 */
export default function AdminInicioPage() {
  redirect('/admin/eagle')
}
