/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    screens: { sm: '640px', md: '1000px', lg: '1280px', xl: '1536px' },
    extend: {
      colors: {
        page: '#0B0C10',
        nav: '#121419',
        frame: '#1B1C20',
        rail: '#1F2024',
        panel: '#2A2B2F',
        stage: '#202124',
        line: '#34363B',
        field: '#1B1C20',
        fg: '#F3F4F6',
        muted: '#9CA3AF',
        blue: '#5B9BEA',
        pink: '#E0359A',
        coral: '#E5484D',
        violet: '#7A5AF8',
        danger: '#EF4444',
      },
      fontFamily: {
        sans: ['Archivo', 'system-ui', 'sans-serif'],
        display: ['"Archivo Black"', 'Archivo', 'sans-serif'],
      },
      borderRadius: { DEFAULT: '6px', btn: '6px' },
    },
  },
  plugins: [],
};
