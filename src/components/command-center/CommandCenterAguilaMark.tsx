/**
 * AduanaMark — backward-compatible wrapper that renders the AGUILA eagle
 * from `@/components/brand/AguilaMark`. Preserves the `bare` contract:
 * `bare` → eagle only; otherwise eagle wrapped in a silver radial glow.
 *
 * Kept at this path so existing imports in signup / Sidebar / CruzAvatar /
 * onboarding continue to work without churn.
 */

import { AguilaMark } from '@/components/brand/AguilaMark'

interface AduanaMarkProps {
  size: number
  className?: string
  bare?: boolean
}

export function AduanaMark({ size, className, bare }: AduanaMarkProps) {
  if (bare) {
    return <AguilaMark size={Math.round(size * 0.7)} className={className} />
  }

  return (
    <div
      className={`aguila-brand ${className || ''}`}
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(192,197,206,0.18) 0%, transparent 70%)',
      }}
    >
      <AguilaMark size={Math.round(size * 0.7)} />
    </div>
  )
}

export { AduanaMark as CommandCenterAguilaMark }
