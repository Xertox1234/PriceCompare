import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

export default {
  content: ['./client/src/**/*.{ts,tsx}', './client/index.html'],
  darkMode: ['class'],
  theme: {
    extend: {
      // Color System: Uses @theme tokens from index.css for primary/secondary/etc
      // Chart colors remain for data visualization (semantic, non-conflicting)
      colors: {
        chart: {
          // Primary chart colors
          blue: '#3b82f6',
          green: '#10b981',
          amber: '#f59e0b',
          red: '#ef4444',
          // Secondary chart colors
          purple: '#8b5cf6',
          pink: '#ec4899',
          teal: '#14b8a6',
          orange: '#f97316',
          // Aggregates chart colors
          average: '#8884d8',
          minimum: '#82ca9d',
          maximum: '#ff7c7c',
          median: '#ffc658',
          // Neutral
          gray: '#64748b',
        },
      },
      // Font family
      fontFamily: {
        template: ['Inter', 'Helvetica Neue', 'sans-serif'],
      },
      // Custom container widths
      maxWidth: {
        container: '1280px',
        'container-lg': '1440px',
        search: '600px',
        'hero-text': '500px',
      },
      // Custom spacing for charts and specific layouts
      width: {
        chart: '550px',
      },
      height: {
        chart: '400px',
      },
      // Animation for loading states and hover effects
      animation: {
        spin: 'spin 1s linear infinite',
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
        template: '0 2px 8px rgba(0, 0, 0, 0.08)',
        'template-hover': '0 4px 16px rgba(0, 0, 0, 0.12)',
        'template-lg': '0 8px 24px rgba(0, 0, 0, 0.15)',
      },
      // Border radius matching template
      borderRadius: {
        template: '8px',
        'template-lg': '12px',
        'template-xl': '16px',
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
