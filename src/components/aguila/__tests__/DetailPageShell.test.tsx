import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DetailPageShell } from '../DetailPageShell'

const baseBreadcrumb = [
  { label: 'Catálogo', href: '/catalogo' },
  { label: '3901.20.01' },
]

describe('DetailPageShell', () => {
  it('renders a breadcrumb trail with the last item as plain text', () => {
    const html = renderToStaticMarkup(
      <DetailPageShell breadcrumb={baseBreadcrumb} title="Parte A">
        <div>body</div>
      </DetailPageShell>
    )
    expect(html).toContain('Catálogo')
    expect(html).toContain('3901.20.01')
    expect(html).toMatch(/<a [^>]*href="\/catalogo"/)
  })

  it('formats title when titleKind=fraccion (dots preserved)', () => {
    const html = renderToStaticMarkup(
      <DetailPageShell
        breadcrumb={baseBreadcrumb}
        title="3901.20.01"
        titleKind="fraccion"
      >
        <div>body</div>
      </DetailPageShell>
    )
    // Fracción format must preserve dots per customs-domain invariant.
    expect(html).toContain('3901.20.01')
    expect(html).not.toMatch(/3901\s+20\s+01/)
  })

  it('formats title when titleKind=pedimento (spaces preserved)', () => {
    const html = renderToStaticMarkup(
      <DetailPageShell
        breadcrumb={baseBreadcrumb}
        title="26 24 3596 6500441"
        titleKind="pedimento"
      >
        <div>body</div>
      </DetailPageShell>
    )
    // Pedimento format: DD AD PPPP SSSSSSS with spaces preserved.
    expect(html).toMatch(/26 24 3596 6500441/)
  })

  it('renders subtitle when provided', () => {
    const html = renderToStaticMarkup(
      <DetailPageShell
        breadcrumb={baseBreadcrumb}
        title="X"
        subtitle="Línea secundaria de contexto"
      >
        <div>body</div>
      </DetailPageShell>
    )
    expect(html).toContain('Línea secundaria de contexto')
  })

  it('renders status + badges + actions slots side-by-side', () => {
    const html = renderToStaticMarkup(
      <DetailPageShell
        breadcrumb={baseBreadcrumb}
        title="X"
        status={<span data-testid="status">En proceso</span>}
        badges={<span data-testid="badges">3 vars</span>}
        actions={<button>Exportar</button>}
      >
        <div>body</div>
      </DetailPageShell>
    )
    expect(html).toContain('En proceso')
    expect(html).toContain('3 vars')
    expect(html).toContain('Exportar')
  })

  it('renders tabs as navigation with active indicator', () => {
    const html = renderToStaticMarkup(
      <DetailPageShell
        breadcrumb={baseBreadcrumb}
        title="X"
        tabs={[
          { key: 'resumen', label: 'Resumen', href: '/x?tab=resumen', active: true },
          { key: 'historia', label: 'Historia', href: '/x?tab=historia' },
        ]}
      >
        <div>body</div>
      </DetailPageShell>
    )
    expect(html).toContain('Resumen')
    expect(html).toContain('Historia')
    expect(html).toMatch(/aria-current="page"/)
  })

  it('renders sidebar in 2-column layout when provided', () => {
    const html = renderToStaticMarkup(
      <DetailPageShell
        breadcrumb={baseBreadcrumb}
        title="X"
        sidebar={<aside data-testid="sb">metadata</aside>}
      >
        <main data-testid="main">content</main>
      </DetailPageShell>
    )
    expect(html).toContain('metadata')
    expect(html).toContain('content')
    expect(html).toMatch(/grid-template-columns/)
  })

  it('renders children when no sidebar (single column)', () => {
    const html = renderToStaticMarkup(
      <DetailPageShell breadcrumb={baseBreadcrumb} title="X">
        <p>just body</p>
      </DetailPageShell>
    )
    expect(html).toContain('just body')
    // No grid template columns when sidebar is absent
    expect(html).not.toMatch(/grid-template-columns:\s*minmax/)
  })
})
