/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'xccelera-blue': '#3b82f6',
        'xccelera-purple': '#7c3aed',
        'xccelera-dark': '#0a0f1e',
        'xccelera-card': '#0f172a',
        'xccelera-border': '#1e293b',
      },
      backgroundImage: {
        'gradient-xccelera': 'linear-gradient(135deg, #3b82f6, #7c3aed)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      boxShadow: {
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.25)',
        'glow-purple': '0 0 20px rgba(124, 58, 237, 0.25)',
        'glow-green': '0 0 20px rgba(34, 197, 94, 0.25)',
      },
    },
  },
  plugins: [],
};
