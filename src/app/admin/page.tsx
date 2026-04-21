import { redirect } from 'next/navigation'

/**
 * /admin — redirects to /admin/eagle per invariant 30.
 * The legacy AdminCockpit at this path predated the Eagle View consolidation.
 * V1 marathon batch 1 · route alignment.
 */
export default function AdminPage() {
  redirect('/admin/eagle')
}
