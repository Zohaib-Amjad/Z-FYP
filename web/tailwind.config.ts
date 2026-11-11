import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f4f4f5',
          100: '#e6e6e8',
          200: '#cfcfd3',
          300: '#a9a9b0',
          400: '#7c7c85',
          500: '#5b5b64',
          600: '#43434b',
          700: '#2d2d34',
          800: '#1d1d22',
          900: '#141417',
          950: '#0b0b0d',
        },
        ivory: {
          50: '#fdfcfa',
          100: '#faf7f2',
          200: '#f2ede4',
          300: '#e6dfd1',
          400: '#d3c9b5',
        },
        gold: {
          200: '#efe0b0',
          300: '#e2c978',
          400: '#d4af37',
          500: '#b8932a',
          600: '#9a7a1f',
          700: '#7a5f14',
        },
        status: {
          pending: '#8a5a00',
          approved: '#1c6b43',
          rejected: '#a12c3a',
          cancelled: '#55555e',
          completed: '#2b4f8c',
          rescheduled: '#6b3f9c',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '0.75rem',
        control: '0.5rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(11, 11, 13, 0.06), 0 8px 24px -12px rgba(11, 11, 13, 0.18)',
        lift: '0 2px 4px rgba(11, 11, 13, 0.08), 0 18px 40px -16px rgba(11, 11, 13, 0.35)',
        gold: '0 0 0 1px rgba(212, 175, 55, 0.5), 0 12px 32px -14px rgba(212, 175, 55, 0.45)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        'toast-in': 'toast-in 0.25s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
