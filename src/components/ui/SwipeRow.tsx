'use client'

import { useRef, useState } from 'react'

interface SwipeAction {
  icon: React.ReactNode
  label: string
  color: string
  bg: string
  onAction: () => void
}

interface SwipeRowProps {
  children: React.ReactNode
  leftAction?: SwipeAction
  rightAction?: SwipeAction
  className?: string
  style?: React.CSSProperties
}

const THRESHOLD = 70

/**
 * Swipeable row — left/right swipe reveals actions on mobile.
 * Desktop: hover reveals action buttons on the right.
 * 2-tap-max UX: swipe + release = action complete.
 */
export function SwipeRow({ children, leftAction, rightAction, className, style }: SwipeRowProps) {
  const [offsetX, setOffsetX] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const [hovering, setHovering] = useState(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const isHorizontal = useRef<boolean | null>(null)

  function handleTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    isHorizontal.current = null
    setSwiping(true)
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!swiping) return
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current

    // Determine direction on first significant move
    if (isHorizontal.current === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      isHorizontal.current = Math.abs(dx) > Math.abs(dy)
    }
    if (!isHorizontal.current) return

    // Clamp offset
    const max = rightAction ? THRESHOLD + 20 : 0
    const min = leftAction ? -(THRESHOLD + 20) : 0
    setOffsetX(Math.max(min, Math.min(max, dx)))
  }

  function handleTouchEnd() {
    setSwiping(false)
    if (offsetX > THRESHOLD && rightAction) {
      rightAction.onAction()
      // Haptic
      if ('vibrate' in navigator) navigator.vibrate(10)
    } else if (offsetX < -THRESHOLD && leftAction) {
      leftAction.onAction()
      if ('vibrate' in navigator) navigator.vibrate(10)
    }
    setOffsetX(0)
    isHorizontal.current = null
  }

  const revealRight = offsetX > 20 && rightAction
  const revealLeft = offsetX < -20 && leftAction
  const triggered = Math.abs(offsetX) > THRESHOLD

  return (
    <div
      style={{ position: 'relative', overflow: 'hidden', ...style }}
      className={className}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Left action background (swipe right reveals) */}
      {rightAction && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: THRESHOLD + 20,
          background: triggered && revealRight ? rightAction.color : rightAction.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          transition: swiping ? 'none' : 'background 200ms',
          opacity: revealRight ? 1 : 0,
        }}>
          <span style={{ color: triggered ? 'rgba(255,255,255,0.045)' : rightAction.color, fontSize: 12, fontWeight: 600 }}>
            {rightAction.icon} {rightAction.label}
          </span>
        </div>
      )}

      {/* Right action background (swipe left reveals) */}
      {leftAction && (
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: THRESHOLD + 20,
          background: triggered && revealLeft ? leftAction.color : leftAction.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          transition: swiping ? 'none' : 'background 200ms',
          opacity: revealLeft ? 1 : 0,
        }}>
          <span style={{ color: triggered ? 'rgba(255,255,255,0.045)' : leftAction.color, fontSize: 12, fontWeight: 600 }}>
            {leftAction.label} {leftAction.icon}
          </span>
        </div>
      )}

      {/* Main content — slides with touch */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: swiping ? 'none' : 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          position: 'relative',
          zIndex: 1,
          background: 'var(--bg-card, #fff)',
        }}
      >
        {children}
      </div>

      {/* Desktop hover actions */}
      {hovering && (leftAction || rightAction) && (
        <div style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          display: 'flex', gap: 6, zIndex: 2,
          animation: 'fadeIn 150ms ease',
        }}>
          {rightAction && (
            <button
              onClick={rightAction.onAction}
              title={rightAction.label}
              style={{
                width: 36, height: 36, borderRadius: 8,
                background: rightAction.bg, border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: rightAction.color,
                transition: 'background 150ms',
              }}
            >
              {rightAction.icon}
            </button>
          )}
          {leftAction && (
            <button
              onClick={leftAction.onAction}
              title={leftAction.label}
              style={{
                width: 36, height: 36, borderRadius: 8,
                background: leftAction.bg, border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: leftAction.color,
                transition: 'background 150ms',
              }}
            >
              {leftAction.icon}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
