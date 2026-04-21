import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { CalmEmptyState } from '../CalmEmptyState'

describe('CalmEmptyState', () => {
  it('renders Spanish defaults when no props supplied', () => {
    const { getByText, getByRole } = render(<CalmEmptyState />)
    expect(getByText('Tu operación está en calma')).toBeTruthy()
    expect(getByText(/No hay actividad en este período/)).toBeTruthy()
    // role=status → accessible live region so screen readers announce calmly
    expect(getByRole('status')).toBeTruthy()
  })

  it('renders override title + message', () => {
    const { getByText } = render(
      <CalmEmptyState
        title="Sin pedimentos este mes"
        message="Tu último pedimento fue hace 5 días"
      />,
    )
    expect(getByText('Sin pedimentos este mes')).toBeTruthy()
    expect(getByText('Tu último pedimento fue hace 5 días')).toBeTruthy()
  })

  it('renders action as Link when href is provided (60px target)', () => {
    const { getByRole } = render(
      <CalmEmptyState action={{ label: 'Ver meses anteriores', href: '/embarques?month=2026-03' }} />,
    )
    const link = getByRole('link', { name: /Ver meses anteriores/ })
    expect(link.getAttribute('href')).toBe('/embarques?month=2026-03')
    expect(link).toBeTruthy()
  })

  it('renders action as button when only onClick is provided', () => {
    const onClick = vi.fn()
    const { getByRole } = render(
      <CalmEmptyState action={{ label: 'Actualizar', onClick }} />,
    )
    const button = getByRole('button', { name: /Actualizar/ })
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders children below the message', () => {
    const { getByText } = render(
      <CalmEmptyState>
        <p>Contacta a tu agente aduanal para más información</p>
      </CalmEmptyState>,
    )
    expect(getByText(/Contacta a tu agente aduanal/)).toBeTruthy()
  })

  it('swaps icon glyph via prop (document / package / report / eagle)', () => {
    // Each icon renders an <svg>, so count one per render
    const { container: c1 } = render(<CalmEmptyState icon="document" />)
    const { container: c2 } = render(<CalmEmptyState icon="package" />)
    const { container: c3 } = render(<CalmEmptyState icon="report" />)
    const { container: c4 } = render(<CalmEmptyState icon="eagle" />)
    expect(c1.querySelectorAll('svg').length).toBeGreaterThan(0)
    expect(c2.querySelectorAll('svg').length).toBeGreaterThan(0)
    expect(c3.querySelectorAll('svg').length).toBeGreaterThan(0)
    expect(c4.querySelectorAll('svg').length).toBeGreaterThan(0)
  })
})
