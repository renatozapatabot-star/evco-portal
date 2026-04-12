/**
 * Block 3 — New /reportes root. Builder replaces legacy chart view.
 * Legacy remains at /reportes/legacy. ?legacy=1 redirects there.
 */
import { ReportBuilderPage } from './ReportBuilderPage'

export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ legacy?: string }>
}) {
  const sp = await searchParams
  return <ReportBuilderPage legacy={sp.legacy} />
}
