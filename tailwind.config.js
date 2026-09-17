/** @type {import('tailwindcss').Config} */
export default {
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
    },
  },
  plugins: [],
}
