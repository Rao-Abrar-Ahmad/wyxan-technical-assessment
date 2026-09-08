/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#16212C',
          soft: '#41505E',
          faint: '#7A8894',
        },
        paper: '#F1F4F3',
        card: '#FBFCFC',
        line: {
          DEFAULT: '#D3DBD8',
          soft: '#E3E8E6',
        },
        status: {
          start: '#E08A34',      // amber / reserved
          'start-tint': '#FBEFDF',
          active: '#2E7BD6',     // blue / issued
          'active-tint': '#E7F0FB',
          done: '#2F9160',       // green / in store
          'done-tint': '#E4F3EB',
          alert: '#C4453D',      // red / out of service / overdue
          'alert-tint': '#FAE8E7',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
