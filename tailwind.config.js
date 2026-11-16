/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './lib/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f3efe7',
        ink: '#2a1c16',
        primary: '#1e3d5c',
        sogan: '#8c4030',
      },
    },
  },
  plugins: [],
}
