import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

export default {
  content: [
    './client/src/**/*.{ts,tsx}',
    './client/index.html',
  ],
  darkMode: ['class'],
  theme: {
    extend: {
      // Onsus Template Color Palette
      colors: {
        // Primary colors from template
        'template': {
          // Primary Red - CTAs, sale tags, prices
          'primary': '#ff3d3d',
          'primary-hover': '#e63535',
          // Secondary Blue - links, accents
          'secondary': '#004ec3',
          'secondary-hover': '#003d99',
          // Gold/Yellow - highlights, ratings
          'gold': '#FCB500',
          'gold-hover': '#e5a400',
          // Grays from template
          'gray': {
            50: '#fafafa',
            100: '#f5f5f5',
            200: '#ebebeb',
            300: '#e1e1e1',
            400: '#a8a8a8',
            500: '#757575',
            600: '#666666',
            700: '#4a4a4a',
            800: '#333e48',
            900: '#222222',
          },
          // Status colors
          'success': '#28a745',
          'warning': '#ffc107',
          'danger': '#dc3545',
          'info': '#17a2b8',
        },
      },
      // Font family
      fontFamily: {
        'template': ['Inter', 'Poppins', 'Helvetica Neue', 'sans-serif'],
      },
      // Custom container widths
      maxWidth: {
        'container': '1280px',
        'container-lg': '1440px',
        'search': '600px',
        'hero-text': '500px',
      },
      // Custom spacing for charts and specific layouts
      width: {
        'chart': '550px',
      },
      height: {
        'chart': '400px',
      },
      // Animation for loading states and hover effects
      animation: {
        'spin': 'spin 1s linear infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      // Box shadows matching template
      boxShadow: {
        'template': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'template-hover': '0 4px 16px rgba(0, 0, 0, 0.12)',
        'template-lg': '0 8px 24px rgba(0, 0, 0, 0.15)',
      },
      // Border radius matching template
      borderRadius: {
        'template': '8px',
        'template-lg': '12px',
        'template-xl': '16px',
      },
    },
  },
  plugins: [
    tailwindcssAnimate,
  ],
} satisfies Config
