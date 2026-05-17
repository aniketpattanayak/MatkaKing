import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          50:  '#fffbeb',
          100: '#fef3c7',
          400: '#fbbf24',
          500: '#f5a623',
          600: '#e8762b',
          700: '#c7821a',
        },
        surface: {
          DEFAULT: '#12141a',
          2: '#1a1d27',
          3: '#22263a',
        },
      },
      fontFamily: {
        mono: ['Consolas', 'JetBrains Mono', 'monospace'],
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-gold': 'pulse-gold 2s infinite',
        'fade-in-up': 'fadeInUp 0.4s ease forwards',
        'marquee': 'marquee 20s linear infinite',
      },
      keyframes: {
        'pulse-gold': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(245,166,35,0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(245,166,35,0)' },
        },
        'fadeInUp': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'marquee': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      backgroundImage: {
        'gradient-gold': 'linear-gradient(135deg, #f5a623 0%, #e8762b 50%, #c7821a 100%)',
        'gradient-dark': 'linear-gradient(180deg, #1a1d27 0%, #0a0b0f 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
