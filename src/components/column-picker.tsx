'use client'
import { useState, useRef, useEffect } from 'react'
import { SlidersHorizontal, Check } from 'lucide-react'

export interface ColumnDef { key: string; label: string; defaultVisible: boolean; fillThreshold?: number }

export function ColumnPicker({ columns, visible, onChange }: { columns: ColumnDef[]; visible: Set<string>; onChange: (v: Set<string>) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const toggle = (key: string) => {
    const next = new Set(visible)
    if (next.has(key)) next.delete(key); else next.add(key)
    onChange(next)
  }

  const hiddenCount = columns.length - visible.size

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="act-btn" onClick={() => setOpen(!open)}>
        <SlidersHorizontal size={13} />
        Columnas
        {hiddenCount > 0 && (
          <span style={{ fontSize:10, fontFamily:'var(--font-mono)', background:'var(--gold-50)', color:'var(--gold-700)', padding:'1px 5px', borderRadius:'var(--r-pill)', border:'1px solid var(--gold-200)' }}>+{hiddenCount}</span>
        )}
      </button>
      {open && (
        <div className="col-picker-dropdown" role="listbox">
          {columns.map(col => {
            const on = visible.has(col.key)
            return (
              <button key={col.key} className={`col-picker-item ${on ? 'on' : ''}`} onClick={() => toggle(col.key)} role="option" aria-selected={on}>
                <div className={`col-picker-check ${on ? 'checked' : ''}`}>{on && <Check size={11} strokeWidth={2.5} />}</div>
                {col.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function useColumnVisibility(columns: ColumnDef[], data: Record<string, unknown>[], storageKey?: string) {
  const [visible, setVisible] = useState<Set<string>>(() => {
    if (storageKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(`col-vis-${storageKey}`)
      if (saved) { try { return new Set(JSON.parse(saved)) } catch { /* ignore */ } }
    }
    const vis = new Set<string>()
    for (const col of columns) {
      if (col.fillThreshold != null && data.length > 0) {
        const filled = data.filter(r => r[col.key] != null && r[col.key] !== '').length
        if ((filled / data.length) >= col.fillThreshold) vis.add(col.key)
      } else if (col.defaultVisible) vis.add(col.key)
    }
    return vis
  })

  const update = (next: Set<string>) => {
    setVisible(next)
    if (storageKey && typeof window !== 'undefined') localStorage.setItem(`col-vis-${storageKey}`, JSON.stringify([...next]))
  }

  return [visible, update] as const
}
