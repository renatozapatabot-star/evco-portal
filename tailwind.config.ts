import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Brand — Gold (canonical: ZAPATA_GOLD_BASE #C9A74A — identity only)
        // Mirrors --portal-gold-* in src/app/portal-tokens.css + ZAPATA_GOLD_*
        // in src/lib/design-system.ts. Changing a value here must update both.
        gold: {
          DEFAULT: '#C9A74A',
          50: 'rgba(201,167,74,0.08)',
          100: '#FBF5E6',
          200: '#F0D88A',
          300: '#E8C468',
          400: '#F4D47A',
          500: '#C9A74A',
          600: '#B8933B',
          700: '#8F7628',
          800: '#7A5C1E',
        },
        // Brand — Navy (sidebar)
        navy: {
          700: '#18293F',
          800: '#1A2535',
          900: '#0D0D0C',
        },
        // Brand — Z Red (mark only)
        'z-red': '#CC1B2F',
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
