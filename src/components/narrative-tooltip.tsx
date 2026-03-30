'use client'
import { useState, useRef, type ReactNode } from 'react'

export function NarrativeTooltip({ children, narrative, position = 'bottom' }: {
  children: ReactNode; narrative: string; position?: 'top' | 'bottom'
}) {
  const [show, setShow] = useState(false)
  const timeoutRef = useRef<number>(0)

  return (
    <div className="nt-wrap"
      onMouseEnter={() => { timeoutRef.current = window.setTimeout(() => setShow(true), 400) }}
      onMouseLeave={() => { window.clearTimeout(timeoutRef.current); setShow(false) }}>
      {children}
      {show && <div className={`nt-tip nt-${position}`} role="tooltip">{narrative}</div>}
    </div>
  )
}
