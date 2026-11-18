import type { Config } from 'tailwindcss';

/** Shared by rescheduled bookings and booked slots. */
const SLATE_BLUE = { DEFAULT: '#3f6194', soft: '#e6ecf5', line: '#b4c5df' };
/** Cancelled and rejected bookings, errors and invalid fields. */
const MUTED_RED = { DEFAULT: '#a23b3b', soft: '#faedec', line: '#e8bdba' };

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f5f5f4',
          100: '#eceae6',
          200: '#d9d5ce',
          300: '#bdb7ae',
          400: '#7a746b',
          500: '#6b6660',
          600: '#55524d',
          700: '#3d3a36',
          800: '#2a2826',
          900: '#1c1c1c',
          950: '#111111',
        },
        ivory: {
          50: '#fbfaf7',
          100: '#f7f4ee',
          200: '#efeae0',
          300: '#e5dfd3',
          400: '#d3cab9',
        },
        gold: {
          200: '#ede2ca',
          300: '#cdb27e',
          400: '#b8975a',
          500: '#9c7c45',
          600: '#85693a',
          700: '#6e5630',
        },
        status: {
          pending: { DEFAULT: '#8a5f1c', soft: '#f7edd8', line: '#e6ce9a' },
          approved: { DEFAULT: '#286c4f', soft: '#e2f0e8', line: '#a9d3bd' },
          rescheduled: SLATE_BLUE,
          booked: SLATE_BLUE,
          completed: { DEFAULT: '#55524d', soft: '#eceae6', line: '#cfcac2' },
          cancelled: MUTED_RED,
          rejected: MUTED_RED,
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
        soft: '0 1px 2px rgba(17, 17, 17, 0.06), 0 8px 24px -12px rgba(17, 17, 17, 0.18)',
        lift: '0 2px 4px rgba(17, 17, 17, 0.08), 0 18px 40px -16px rgba(17, 17, 17, 0.35)',
        gold: '0 0 0 1px rgba(184, 151, 90, 0.5), 0 12px 32px -14px rgba(184, 151, 90, 0.45)',
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
