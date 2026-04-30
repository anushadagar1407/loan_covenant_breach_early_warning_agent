import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'db-blue': '#003882',
        'db-accent': '#0066CC',
        'surface': '#111827',
        'border-subtle': '#1F2937',
        'text-muted': '#9CA3AF',
        'pass': '#10B981',
        'warn': '#F59E0B',
        'danger': '#EF4444',
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'monospace'],
        sans: ['IBM Plex Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
