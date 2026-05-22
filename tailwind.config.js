/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        syne: ['Syne', 'sans-serif'],
        dm: ['DM Sans', 'sans-serif'],
      },
      colors: {
        arke: {
          bg: '#0d0d14',
          surface: '#10101c',
          sidebar: '#080810',
          border: 'rgba(255,255,255,0.07)',
          purple: '#c044ff',
          cyan: '#00d4ff',
          pink: '#ff6b9d',
          green: '#3dff9a',
          muted: 'rgba(255,255,255,0.35)',
        }
      },
      backgroundImage: {
        'arke-gradient': 'linear-gradient(135deg, #00d4ff, #c044ff, #ff6b9d)',
        'msg-gradient': 'linear-gradient(135deg, rgba(192,68,255,0.7), rgba(0,212,255,0.5))',
      }
    },
  },
  plugins: [],
}
