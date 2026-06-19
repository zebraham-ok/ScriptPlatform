/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  important: true, // Ensure Tailwind utilities override Ant Design when both present
  theme: {
    extend: {
      colors: {
        // Game mode dark theme colors (from BUMENGweb-main)
        game: {
          bg: '#0f172a',        // slate-900
          panel: '#1e293b',     // slate-800
          border: '#334155',    // slate-700
          text: '#e2e8f0',      // slate-200
          muted: '#94a3b8',     // slate-400
          accent: '#f59e0b',    // amber-500
          accentHover: '#d97706', // amber-600
          link: '#60a5fa',      // blue-400
        },
      },
      animation: {
        'gradient-shift': 'gradientShift 3s ease infinite',
        'fade-slide-up': 'fadeSlideUp 0.5s ease-out',
        'dice-roll': 'diceRoll 0.6s ease-out',
        'pulse-ring': 'pulseRing 2s ease-out infinite',
        'round-banner-in': 'roundBannerIn 0.5s ease-out',
        'breathe': 'breathe 3s ease-in-out infinite',
      },
      keyframes: {
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        fadeSlideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        diceRoll: {
          '0%': { transform: 'rotate(0deg) scale(0)', opacity: '0' },
          '50%': { transform: 'rotate(180deg) scale(1.2)', opacity: '1' },
          '100%': { transform: 'rotate(360deg) scale(1)', opacity: '1' },
        },
        pulseRing: {
          '0%': { boxShadow: '0 0 0 0 rgba(245, 158, 11, 0.4)' },
          '70%': { boxShadow: '0 0 0 15px rgba(245, 158, 11, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(245, 158, 11, 0)' },
        },
        roundBannerIn: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '60%': { transform: 'translateY(5%)', opacity: '1' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
