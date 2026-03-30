'use client'
import { useState, useEffect } from 'react'

export function NightModeToggle() {
  const [isDark, setIsDark] = useState(false)
  const [showToggle, setShowToggle] = useState(false)

  useEffect(() => {
    // Check time in CST
    const hour = parseInt(new Date().toLocaleString('en-US', {
      timeZone: 'America/Chicago', hour: 'numeric', hour12: false
    }))
    setShowToggle(hour >= 20 || hour < 6)

    // Check saved preference
    const saved = localStorage.getItem('cruz_theme')
    if (saved === 'dark') {
      setIsDark(true)
      document.documentElement.setAttribute('data-theme', 'dark')
    }
  }, [])

  if (!showToggle) return null

  const toggle = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.setAttribute('data-theme', 'dark')
      localStorage.setItem('cruz_theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
      localStorage.setItem('cruz_theme', 'light')
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Modo claro' : 'Modo nocturno'}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: 18,
        padding: 8,
        borderRadius: 8,
        color: isDark ? '#B8953F' : 'var(--text-secondary)',
      }}
    >
      {isDark ? '\u2600\uFE0F' : '\uD83C\uDF19'}
    </button>
  )
}
