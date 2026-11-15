/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: '#302E2B',
        panel: '#262421',
        card: '#312E2B',
        hairline: '#403D39',
        board: {
          dark: '#739552',
          light: '#EBECD0',
        },
        chessGreen: {
          DEFAULT: '#81B64C',
          dark: '#457524',
          hover: '#95C85A',
        },
        badge: {
          brilliant: '#1BACA6',
          great: '#5C8BB0',
          best: '#96BC4B',
          excellent: '#96BC4B',
          good: '#95AF8A',
          book: '#A88865',
          inaccuracy: '#F7C631',
          mistake: '#E6912C',
          blunder: '#CA3431',
          miss: '#FF6B6B',
        }
      },
    },
  },
  plugins: [],
}
