import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0a0a0f',
          soft: '#12121a',
          card: '#171722',
          hover: '#1e1e2a',
        },
        border: {
          DEFAULT: '#26263a',
          soft: '#1c1c2a',
        },
        text: {
          DEFAULT: '#e6e6f0',
          muted: '#8a8aa3',
          faint: '#555571',
        },
        mode: {
          degen: '#f97316',
          medium: '#eab308',
          safe: '#22c55e',
        },
        good: '#22c55e',
        bad: '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(34,197,94,0.15)',
        card: '0 1px 0 rgba(255,255,255,0.03), 0 6px 20px rgba(0,0,0,0.5)',
      },
      keyframes: {
        pulseGlow: {
          '0%,100%': { boxShadow: '0 0 0 rgba(34,197,94,0)' },
          '50%': { boxShadow: '0 0 24px rgba(34,197,94,0.35)' },
        },
      },
      animation: {
        'pulse-glow': 'pulseGlow 1.6s ease-in-out 1',
      },
    },
  },
  plugins: [],
};
export default config;
