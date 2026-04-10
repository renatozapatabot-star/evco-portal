// CRUZ Design System — Design Tokens
// Single source of truth for colors, typography, spacing
// Usage: import { colors, typography } from '@/lib/design-tokens'

export const colors = {
  // Navy ramp — sidebar, badges, headings
  navy: {
    900: '#0B1623',
    800: '#111E30',
    700: '#18293F',
    600: '#1F3550',
    500: '#2A4365',
  },

  // Gold accent — logo, active states, premium touches
  gold: {
    400: '#eab308',
    300: '#E8C468',
    200: '#F0D88A',
    100: '#FBF5E6',
    800: '#7A5C1E',
  },

  // Slate — text hierarchy, backgrounds, borders
  slate: {
    50:  '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
  },

  white: '#FFFFFF',

  // Semantic status colors
  green: {
    50:  '#F0FDF4',
    100: '#DCFCE7',
    500: '#22C55E',
    600: '#16A34A',
    800: '#166534',
  },
  blue: {
    50:  '#EFF6FF',
    100: '#DBEAFE',
    500: '#3B82F6',
    600: '#2563EB',
    800: '#1E40AF',
  },
  amber: {
    50:  '#FFFBEB',
    100: '#FEF3C7',
    500: '#F59E0B',
    600: '#D97706',
    800: '#92400E',
  },
  red: {
    50:  '#FEF2F2',
    100: '#FEE2E2',
    500: '#EF4444',
    600: '#DC2626',
    800: '#991B1B',
  },
} as const;

export const typography = {
  fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontFamilyMono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",

  // Size scale
  xs:   '11px',
  sm:   '12px',
  base: '13px',
  md:   '14px',
  lg:   '16px',
  xl:   '20px',
  '2xl': '24px',
  '3xl': '28px',

  // Weight
  regular: 400,
  medium:  500,
  semibold: 600,
  bold:    700,

  // Letter spacing for labels
  labelSpacing: '0.8px',
  wideSpacing:  '1.2px',
} as const;

export const spacing = {
  xs:  '4px',
  sm:  '8px',
  md:  '12px',
  lg:  '16px',
  xl:  '20px',
  '2xl': '24px',
  '3xl': '28px',
  '4xl': '32px',
} as const;

export const radii = {
  sm: '6px',
  md: '8px',
  lg: '10px',
  xl: '12px',
  full: '9999px',
} as const;

// Badge status mapping for tráfico states
export const statusConfig = {
  en_proceso: {
    label: 'En proceso',
    bg: colors.blue[100],
    text: colors.blue[800],
    dot: colors.blue[500],
  },
  cruzado: {
    label: 'Cruzado',
    bg: colors.green[100],
    text: colors.green[800],
    dot: colors.green[500],
  },
  docs_faltantes: {
    label: 'Docs faltantes',
    bg: colors.amber[100],
    text: colors.amber[800],
    dot: colors.amber[500],
  },
  detenido: {
    label: 'Detenido',
    bg: colors.red[100],
    text: colors.red[800],
    dot: colors.red[500],
  },
  pendiente: {
    label: 'Pendiente',
    bg: colors.slate[100],
    text: colors.slate[600],
    dot: colors.slate[400],
  },
} as const;

export type TraficoStatus = keyof typeof statusConfig;
