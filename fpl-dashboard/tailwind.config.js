/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        plpurple: '#3d195b',
        plcyan:   '#00ff87',
        plpink:   '#e90052',
      },
    },
  },
  plugins: [],
}
