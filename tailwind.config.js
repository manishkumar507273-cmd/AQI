/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        aqi: {
          bg: '#FAF9F6',
          card: '#FFFFFF',
          border: '#E8ECF4',
          brand: '#00BFA5',
          brandHover: '#00A892',
          blue: '#3B82F6',
          textDark: '#1E293B',
          textMuted: '#64748B',
        },
      },
    },
  },
  plugins: [],
}
