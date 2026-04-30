import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Brand — Gold (canonical source: --portal-gold-* in portal-tokens.css,
        // mirrored to ZAPATA_GOLD_* in design-system.ts). Tailwind reads from
        // CSS vars so a token change in one place cascades here automatically.
        gold: {
          DEFAULT: 'rgb(from var(--portal-gold-500) r g b / <alpha-value>)',
          50:  'rgb(from var(--portal-gold-50) r g b / <alpha-value>)',
          100: 'rgb(from var(--portal-gold-100) r g b / <alpha-value>)',
          200: 'rgb(from var(--portal-gold-200) r g b / <alpha-value>)',
          300: 'rgb(from var(--portal-gold-300) r g b / <alpha-value>)',
          400: 'rgb(from var(--portal-gold-400) r g b / <alpha-value>)',
          500: 'rgb(from var(--portal-gold-500) r g b / <alpha-value>)',
          600: 'rgb(from var(--portal-gold-600) r g b / <alpha-value>)',
          700: 'rgb(from var(--portal-gold-700) r g b / <alpha-value>)',
          800: 'rgb(from var(--portal-gold-800) r g b / <alpha-value>)',
        },
        // Brand — Navy (sidebar). Source: --navy-* in globals.css.
        navy: {
          700: 'rgb(from var(--navy-700) r g b / <alpha-value>)',
          800: 'rgb(from var(--navy-800) r g b / <alpha-value>)',
          900: 'rgb(from var(--navy-900) r g b / <alpha-value>)',
        },
        // Brand — Z Red (mark only). Source: --portal-z-red in portal-tokens.css.
        'z-red': 'rgb(from var(--portal-z-red) r g b / <alpha-value>)',
        // Canvas (v6 dark — was #FAFAF8 warm-white in pre-v6)
        canvas: 'rgb(from var(--portal-ink-0) r g b / <alpha-value>)',
        // Status
        status: {
          green: 'rgb(from var(--portal-status-green-fg) r g b / <alpha-value>)',
          red:   'rgb(from var(--portal-status-red-fg) r g b / <alpha-value>)',
          amber: 'rgb(from var(--portal-status-amber-fg) r g b / <alpha-value>)',
        },
        // Emotional (max 3 visible simultaneously)
        teal: 'rgb(from var(--portal-ice-3) r g b / <alpha-value>)',
        plum: 'rgb(from var(--portal-ice-4) r g b / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'var(--font-geist-mono)', 'monospace'],
      },
      borderColor: {
        // Retired warm-white #E8E5E0 → dark hairline
        card: 'rgb(from var(--portal-line-1) r g b / <alpha-value>)',
      },
      backgroundColor: {
        // Pre-v6 warm-white tokens retired in favor of --portal-ink-* dark canvas.
        // bg-primary / bg-card / bg-elevated / bg-hover now render correctly on
        // the dark system. Any residual consumer that expected cream reads as
        // ink-1/2/3 graceful progression, not a jarring light surface.
        primary:  'rgb(from var(--portal-ink-1) r g b / <alpha-value>)',
        card:     'rgb(from var(--portal-ink-2) r g b / <alpha-value>)',
        elevated: 'rgb(from var(--portal-ink-3) r g b / <alpha-value>)',
        hover:    'rgb(from var(--portal-ink-4) r g b / <alpha-value>)',
      },
      textColor: {
        // Retired warm-white #1A1A1A/#6B6B6B/#737373 → dark-canvas fg
        primary:   'rgb(from var(--portal-fg-1) r g b / <alpha-value>)',
        secondary: 'rgb(from var(--portal-fg-3) r g b / <alpha-value>)',
        muted:     'rgb(from var(--portal-fg-4) r g b / <alpha-value>)',
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        elevated: '0 4px 12px rgba(0,0,0,0.08)',
        modal: '0 8px 24px rgba(0,0,0,0.12)',
      },
      spacing: {
        touch: '60px', // 3 AM Driver minimum touch target
      },
      fontSize: {
        display: '32px',
        title: '20px',
        body: '15px',
        caption: '13px',
        micro: '11px',
      },
      width: {
        sidebar: '240px',
        'sidebar-collapsed': '64px',
      },
    },
  },
  plugins: [],
}

export default config
