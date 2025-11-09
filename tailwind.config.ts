import type { Config } from 'tailwindcss'

export default {
  content: [
    './client/src/**/*.{ts,tsx}',
    './client/index.html',
  ],
  darkMode: ['class'],
  theme: {
    extend: {
      // Custom container widths referenced in components
      maxWidth: {
        'container': '1280px',
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
      // Animation for loading states
      animation: {
        'spin': 'spin 1s linear infinite',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    require('tw-animate-css'),
  ],
} satisfies Config
