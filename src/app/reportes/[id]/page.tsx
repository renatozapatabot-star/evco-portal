/**
 * Block 3 — saved template view: loads template id as initial config.
 */
import { ReportBuilderPage } from '../ReportBuilderPage'

export const dynamic = 'force-dynamic'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ReportBuilderPage initialTemplateId={id} />
}
