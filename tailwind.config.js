/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Wide and monumental for the wordmark, closest free match to the
        // film's title treatment. Barlow carries the body text.
        'display': ['Michroma', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'body': ['Barlow', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Night on Arrakis: warm-tinted blacks rather than neutral ones, so
        // the whole surface reads as sand in shadow instead of empty space.
        'deep': {
          900: '#0b0907',
          800: '#131009',
          700: '#1d1710',
          600: '#2a2016',
        },
        // Melange. The primary accent.
        'spice': {
          DEFAULT: '#e08b3c',
          bright: '#f0a355',
          deep: '#a8551c',
        },
        // Eyes of Ibad — the blue-within-blue of spice saturation. Used
        // sparingly, and only for the user's own voice, so it stays striking.
        'ibad': {
          DEFAULT: '#4bb8e8',
          deep: '#1d6f96',
        },
        'sand': {
          DEFAULT: '#d9c8a9',
          dim: '#8d8069',
        },
      },
      boxShadow: {
        'spice': '0 0 24px rgba(224, 139, 60, 0.28)',
        'spice-lg': '0 0 44px rgba(224, 139, 60, 0.38)',
        'ibad': '0 0 22px rgba(75, 184, 232, 0.26)',
      },
      backgroundImage: {
        // Low sun over dunes, sitting behind the landing content.
        'dunes': 'radial-gradient(120% 80% at 50% 118%, rgba(224,139,60,0.20) 0%, rgba(168,85,28,0.07) 42%, transparent 72%)',
      },
      keyframes: {
        haze: {
          '0%, 100%': { opacity: '0.5', transform: 'translateY(0)' },
          '50%': { opacity: '0.85', transform: 'translateY(-6px)' },
        },
        rise: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        haze: 'haze 7s ease-in-out infinite',
        rise: 'rise 0.5s ease-out both',
      },
    },
  },
  plugins: [],
}
