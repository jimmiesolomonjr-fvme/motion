/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#D4AF37',
          light: '#E8C547',
          dark: '#B8960F',
        },
        dark: {
          DEFAULT: '#0A0A0A',
          50: '#1A1A1A',
          100: '#141414',
          200: '#111111',
          300: '#0D0D0D',
        },
        purple: {
          accent: '#6B21A8',
          light: '#7C3AED',
          glow: '#A855F7',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-luxury': 'linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 50%, #0D0D0D 100%)',
        'gradient-gold': 'linear-gradient(135deg, #D4AF37 0%, #E8C547 50%, #B8960F 100%)',
        'gradient-purple': 'linear-gradient(135deg, #6B21A8 0%, #7C3AED 100%)',
      },
      boxShadow: {
        gold: '0 0 20px rgba(212, 175, 55, 0.3)',
        purple: '0 0 20px rgba(107, 33, 168, 0.3)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
