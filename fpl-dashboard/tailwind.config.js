/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        su: {
          purple:   '#601C98',
          teal:     '#60DEC8',
          mint:     '#D0FFF7',
          muted:    '#8B89B4',
          forest:   '#495A55',
          dark:     '#2E3E39',
          navy:     '#464468',
          sage:     '#B7CDC5',
          text:     '#252525',
          border:   '#DEDEDE',
          bg:       '#FAFAFA',
          card:     '#FFFFFF',
          light:    '#F0F0F0',
          neutral:  '#F3F3F3',
          accent:   '#566164',
          green:    '#27C966',
          yellow:   '#FCDF4A',
          red:      '#FF460C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
