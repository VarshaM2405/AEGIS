/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#FDF8F9',
        primary: '#D81B60',
        secondary: '#E5B2B9',
        heading: '#4A2E35',
        bodyColor: '#9E7A80',
        muted: '#DDA7A5',
      }
    },
  },
  plugins: [],
}
