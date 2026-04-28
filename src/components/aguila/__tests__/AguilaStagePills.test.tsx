import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { AguilaStagePills, type AguilaStageOption } from '../AguilaStagePills'

type Stage = 'new' | 'active' | 'done'

const stages: AguilaStageOption<Stage>[] = [
  { value: 'new', label: 'Nuevo' },
  { value: 'active', label: 'Activo' },
  { value: 'done', label: 'Hecho', sub: '12' },
]

describe('AguilaStagePills', () => {
  it('renders a radio for each stage with the primary variant on current', () => {
    const onChange = vi.fn()
    const { getByRole } = render(
      <AguilaStagePills stages={stages} current="active" onChange={onChange} />,
    )
    const activePill = getByRole('radio', { name: /Activo/ })
    expect(activePill.className).toMatch(/portal-btn--primary/)
    const newPill = getByRole('radio', { name: /Nuevo/ })
    expect(newPill.className).toMatch(/portal-btn--ghost/)
  })

  it('fires onChange with the clicked stage value', () => {
    const onChange = vi.fn()
    const { getByRole } = render(
      <AguilaStagePills stages={stages} current="new" onChange={onChange} />,
    )
    fireEvent.click(getByRole('radio', { name: /Hecho/ }))
    expect(onChange).toHaveBeenCalledWith('done')
  })

  it('renders sub labels in monospace', () => {
    const { getByText } = render(
      <AguilaStagePills stages={stages} current="new" onChange={vi.fn()} />,
    )
    const sub = getByText('12')
    expect(sub.tagName).toBe('SPAN')
    expect((sub as HTMLSpanElement).style.fontFamily).toContain('mono')
  })

  it('shows a saving indicator + reduces opacity when saving matches', () => {
    const { getByRole } = render(
      <AguilaStagePills
        stages={stages}
        current="new"
        saving="active"
        onChange={vi.fn()}
      />,
    )
    const savingPill = getByRole('radio', { name: /Activo/ })
    // Reduced opacity signal
    expect((savingPill as HTMLButtonElement).style.opacity).toBe('0.6')
    expect((savingPill as HTMLButtonElement).disabled).toBe(true)
  })

  it('disables every pill when disabled=true', () => {
    const { getAllByRole } = render(
      <AguilaStagePills
        stages={stages}
        current="new"
        disabled
        onChange={vi.fn()}
      />,
    )
    const pills = getAllByRole('radio')
    for (const p of pills) {
      expect((p as HTMLButtonElement).disabled).toBe(true)
    }
  })

  it('marks the current pill with aria-checked=true', () => {
    const { getByRole } = render(
      <AguilaStagePills stages={stages} current="done" onChange={vi.fn()} />,
    )
    const done = getByRole('radio', { name: /Hecho/ })
    expect(done.getAttribute('aria-checked')).toBe('true')
    const others = ['Nuevo', 'Activo']
    for (const name of others) {
      const pill = getByRole('radio', { name: new RegExp(name) })
      expect(pill.getAttribute('aria-checked')).toBe('false')
    }
  })
})
