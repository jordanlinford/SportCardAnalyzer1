/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'white',
        'background-dark': '#1f2937',
        foreground: 'black',
        primary: {
          DEFAULT: 'black',
          foreground: 'white',
        },
        secondary: {
          DEFAULT: 'gray',
          foreground: 'white',
        },
        muted: {
          DEFAULT: 'gray',
          foreground: 'gray',
        },
        accent: {
          DEFAULT: 'gray',
          foreground: 'black',
        },
        popover: {
          DEFAULT: 'white',
          foreground: 'black',
        },
        card: {
          DEFAULT: 'white',
          foreground: 'black',
        },
        border: 'gray',
        input: 'gray',
        ring: 'gray',
      },
    },
  },
  plugins: [],
}