/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  important: true, // Ensure Tailwind utilities override Ant Design when both present
  theme: {
    extend: {
      colors: {
        // Game mode dark theme colors (matched to HomePage purple theme)
        game: {
          bg: '#0a0015',           // deep purple-black
          panel: 'rgba(255,255,255,0.05)',  // translucent card
          border: 'rgba(255,255,255,0.08)',
          text: '#e8d5ff',        // light lavender
          muted: 'rgba(255,255,255,0.5)',
          accent: '#b38fff',      // purple-400
          accentHover: '#7c5cfc', // purple-500
          link: '#60a5fa',        // blue-400
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
          '0%': { boxShadow: '0 0 0 0 rgba(138, 43, 226, 0.4)' },
          '70%': { boxShadow: '0 0 0 15px rgba(138, 43, 226, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(138, 43, 226, 0)' },
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
