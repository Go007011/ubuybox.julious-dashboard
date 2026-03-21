/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        dark: { 900: '#020617', 800: '#0f172a', 700: '#1e293b', 600: '#334155' },
        accent: { orange: '#f97316', blue: '#3b82f6', purple: '#9333ea', green: '#22c55e', red: '#ef4444', yellow: '#eab308' }
      }
    }
  },
  plugins: []
}
