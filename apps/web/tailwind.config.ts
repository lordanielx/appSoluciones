import type { Config } from 'tailwindcss';

/**
 * Los colores y radios salen de variables CSS (src/styles/tokens.css).
 * No se definen radios grandes: máximo 6px (RFP §38, §64).
 */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: { sm: '480px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1440px' },
    borderRadius: { none: '0', sm: 'var(--radius-sm)', DEFAULT: 'var(--radius-md)', md: 'var(--radius-md)', lg: 'var(--radius-lg)' },
    fontFamily: {
      sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
    },
    fontSize: {
      '2xs': ['11px', '16px'],
      xs: ['12px', '16px'],
      sm: ['13px', '20px'],
      base: ['14px', '22px'],
      md: ['15px', '22px'],
      lg: ['16px', '24px'],
      xl: ['18px', '26px'],
      '2xl': ['22px', '28px'],
      '3xl': ['28px', '34px'],
    },
    extend: {
      colors: {
        primary: { DEFAULT: token('color-primary'), hover: token('color-primary-hover') },
        accent: { DEFAULT: token('color-accent'), hover: token('color-accent-hover') },
        electric: token('color-electric'),
        bg: token('color-background'),
        surface: token('color-surface'),
        subtle: token('color-subtle'),
        border: { DEFAULT: token('color-border'), strong: token('color-border-strong') },
        text: { DEFAULT: token('color-text'), muted: token('color-text-muted'), inverse: token('color-text-inverse') },
        steel: token('color-steel'),
        graphite: token('color-graphite'),
        success: { DEFAULT: token('color-success'), soft: token('color-success-soft') },
        warning: { DEFAULT: token('color-warning'), soft: token('color-warning-soft') },
        danger: { DEFAULT: token('color-danger'), soft: token('color-danger-soft') },
        info: { DEFAULT: token('color-electric'), soft: token('color-info-soft') },
      },
      spacing: { 4.5: '18px', 13: '52px', 15: '60px', 18: '72px' },
      boxShadow: { panel: '0 1px 2px rgb(11 31 51 / 0.06)', overlay: '0 8px 24px rgb(11 31 51 / 0.18)' },
      maxWidth: { content: '1320px' },
    },
  },
  plugins: [],
} satisfies Config;
