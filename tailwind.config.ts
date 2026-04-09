import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Brand — Gold
        gold: {
          DEFAULT: '#C9A84C',
          50: 'rgba(196,150,60,0.08)',
          100: '#FBF5E6',
          200: '#F0D88A',
          300: '#E8C468',
          400: '#C9A84C',
          500: '#C9A84C',
          600: '#B8933B',
          700: '#8B6914',
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
        // Warm canvas
        canvas: '#FAFAF8',
        // Status
        status: {
          green: '#16A34A',
          red: '#DC2626',
          amber: '#D4952A',
        },
        // Emotional (max 3 visible simultaneously)
        teal: '#0D9488',
        plum: '#7E22CE',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'var(--font-geist-mono)', 'monospace'],
      },
      borderColor: {
        card: '#E8E5E0',
      },
      backgroundColor: {
        primary: '#FAFAF8',
        card: '#FFFFFF',
        elevated: '#F8F7F4',
        hover: '#F5F4F0',
      },
      textColor: {
        primary: '#1A1A1A',
        secondary: '#6B6B6B',
        muted: '#737373',
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
