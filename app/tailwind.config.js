/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#142B49', 700: '#1c3a63', 50: '#eef2f8' },
        accent: { DEFAULT: '#F58B2B', 600: '#dd7616' },
        success: '#247D70',
        danger: '#E05252',
        canvas: '#F5F7FA',
      },
      fontFamily: { sans: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'] },
      borderRadius: { xl: '14px', '2xl': '20px' },
      boxShadow: { card: '0 1px 2px rgba(20,43,73,.06), 0 4px 16px rgba(20,43,73,.05)' },
    },
  },
  plugins: [],
};
