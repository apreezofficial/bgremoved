/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B0B0C',
        surface: '#131315',
        card: '#18181B',
        overlay: '#222226',
        border: '#27272A',
        fg: '#F4F4F5',
        muted: '#A1A1AA',
        accent: {
          DEFAULT: '#C6FF3D',
          hover: '#B5F02B',
          fg: '#0B0B0C',
        },
        danger: '#EF4444',
      },
      borderRadius: {
        DEFAULT: '12px',
        md: '12px',
        lg: '12px',
        xl: '12px',
        '2xl': '12px',
        btn: '12px',
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.04em',
        tighter: '-0.03em',
        tight: '-0.02em',
      },
      transitionDuration: {
        DEFAULT: '180ms',
        fast: '150ms',
        normal: '180ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
