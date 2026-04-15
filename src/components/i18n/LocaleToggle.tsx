'use client'

/**
 * Silver pill toggle for es-MX / en-US. Uses initials "ES | EN" in JetBrains
 * Mono — matches ZAPATA AI monochrome chrome and avoids emoji-filter brittleness.
 */

import { useI18n } from '@/lib/i18n/provider'

export default function LocaleToggle() {
  const { locale, setLocale, t } = useI18n()
  const active = locale === 'en-US' ? 'en' : 'es'

  const baseBtn: React.CSSProperties = {
    padding: '4px 10px',
    fontFamily: 'var(--font-jetbrains-mono, monospace)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'rgba(255,255,255,0.45)',
    transition: 'color 150ms, background 150ms',
    borderRadius: 6,
  }
  const activeBtn: React.CSSProperties = {
    ...baseBtn,
    color: '#E8EAED',
    background: 'rgba(192,197,206,0.12)',
  }

  return (
    <div
      role="group"
      aria-label={t('language.changeTooltip', 'Cambiar idioma / Change language')}
      title={t('language.changeTooltip', 'Cambiar idioma / Change language')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: 2,
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.02)',
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        aria-pressed={active === 'es'}
        aria-label="Español (México)"
        onClick={() => setLocale('es-MX')}
        style={active === 'es' ? activeBtn : baseBtn}
      >
        ES
      </button>
      <span aria-hidden="true" style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>|</span>
      <button
        type="button"
        aria-pressed={active === 'en'}
        aria-label="English (US)"
        onClick={() => setLocale('en-US')}
        style={active === 'en' ? activeBtn : baseBtn}
      >
        EN
      </button>
    </div>
  )
}
