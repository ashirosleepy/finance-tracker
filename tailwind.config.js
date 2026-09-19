/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf9',
          100: '#ccfbef',
          500: '#0f9d78',
          600: '#0b7f61',
          700: '#0a6650',
        },
      },
      // Bumped one notch up from Tailwind's defaults so the whole app reads
      // larger — every existing text-xs / text-sm / text-base / ... class
      // in components picks this up automatically, on mobile and desktop.
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.25rem' }],   // 13px (was 12px)
        sm: ['0.9375rem', { lineHeight: '1.5rem' }],     // 15px (was 14px)
        base: ['1.0625rem', { lineHeight: '1.6rem' }],   // 17px (was 16px)
        lg: ['1.1875rem', { lineHeight: '1.75rem' }],    // 19px (was 18px)
        xl: ['1.375rem', { lineHeight: '1.85rem' }],     // 22px (was 20px)
        '2xl': ['1.625rem', { lineHeight: '2.05rem' }],  // 26px (was 24px)
        '3xl': ['2rem', { lineHeight: '2.3rem' }],       // 32px (was 30px)
      },
    },
  },
  plugins: [],
}
