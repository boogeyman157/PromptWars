/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        grid: {
          950: '#050a14',
          900: '#0a1222',
          850: '#0d172b',
          800: '#111d35',
          700: '#1a2a4a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'glow-green': '0 0 24px -4px rgba(52, 211, 153, 0.45)',
        'glow-blue': '0 0 24px -4px rgba(56, 189, 248, 0.45)',
        'glow-amber': '0 0 24px -4px rgba(251, 191, 36, 0.45)',
        'glow-red': '0 0 24px -4px rgba(248, 113, 113, 0.5)',
      },
      keyframes: {
        flow: { to: { strokeDashoffset: '-24' } },
        'flow-reverse': { to: { strokeDashoffset: '24' } },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        flow: 'flow 0.9s linear infinite',
        'flow-reverse': 'flow-reverse 0.9s linear infinite',
        'fade-in-up': 'fade-in-up 0.25s ease-out both',
        shimmer: 'shimmer 2.2s infinite',
      },
    },
  },
  plugins: [],
};
