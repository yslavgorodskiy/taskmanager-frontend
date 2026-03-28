/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Open Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        cmw: {
          red:          '#e53935',
          'red-hover':  '#c62828',
          blue:         '#1a73e8',
          'blue-hover': '#1557b0',
          border:       '#e0e0e0',
          'border-light': '#eeeeee',
          hover:        '#f0f7ff',
          selected:     '#e8f0fe',
          sidebar:      '#f5f5f5',
          'group-header': '#f7f7f7',
          text:         '#333333',
          muted:        '#666666',
          'muted-light': '#999999',
        },
      },
    },
  },
  plugins: [],
}

