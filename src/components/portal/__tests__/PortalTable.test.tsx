import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PortalTable } from '@/components/portal/PortalTable'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

type Row = { id: string; pedimento: string; importe: number }

describe('PortalTable', () => {
  const columns = [
    { key: 'pedimento', label: 'Pedimento' },
    { key: 'importe', label: 'Importe', num: true },
  ]
  const rows: Row[] = [
    { id: '1', pedimento: '26 24 3596 6500441', importe: 15420 },
    { id: '2', pedimento: '26 24 3596 6500442', importe: 8920 },
  ]

  it('renders empty state when rows is empty', () => {
    const html = renderToStaticMarkup(
      <PortalTable<Row>
        columns={columns}
        rows={[]}
        emptyState={<div>Sin resultados</div>}
      />,
    )
    expect(html).toMatch(/Sin resultados/)
    expect(html).not.toMatch(/<table/)
  })

  it('renders portal-table with mono num cells', () => {
    const html = renderToStaticMarkup(<PortalTable<Row> columns={columns} rows={rows} />)
    expect(html).toMatch(/class="portal-table"/)
    expect(html).toMatch(/<td class="num"/)
    expect(html).toMatch(/26 24 3596 6500441/)
  })

  it('right-aligns numeric headers', () => {
    const html = renderToStaticMarkup(<PortalTable<Row> columns={columns} rows={rows} />)
    expect(html).toMatch(/text-align:right/)
  })
})
