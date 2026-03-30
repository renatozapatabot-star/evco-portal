'use client'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { GOLD_GRADIENT } from '@/lib/design-system'

export function CruzFAB() {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [pressing, setPressing] = useState(false)

  const handleDown = () => {
    setPressing(true)
    timer.current = setTimeout(() => {
      setPressing(false)
      router.push('/voz')
    }, 500)
  }

  const handleUp = () => {
    if (timer.current) clearTimeout(timer.current)
    if (pressing) {
      setPressing(false)
      router.push('/cruz')
    }
  }

  return (
    <button
      className="cruz-fab"
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={() => { clearTimeout(timer.current); setPressing(false) }}
      aria-label="CRUZ — tap for chat, hold for voice"
      style={{ transform: pressing ? 'scale(0.92)' : undefined, transition: 'transform 0.15s' }}
    >
      <span style={{
        fontFamily: 'Georgia, serif',
        fontSize: 22, fontWeight: 700,
        color: '#1A1710',
      }}>Z</span>
      {pressing && (
        <span style={{
          position: 'absolute', bottom: -24, left: '50%', transform: 'translateX(-50%)',
          fontSize: 10, color: 'var(--gold-500)', whiteSpace: 'nowrap', fontWeight: 600,
        }}>Mantén para voz</span>
      )}
    </button>
  )
}
