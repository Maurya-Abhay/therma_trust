/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // ThermaTrust Brand
        primary: {
          50: '#F0FDFA', 100: '#CCFBF1', 200: '#99F6E4', 300: '#5EEAD4',
          400: '#2DD4BF', 500: '#14B8A6', 600: '#0D9488', 700: '#0F766E',
          800: '#115E59', 900: '#134E4A', 950: '#042F2E',
        },
        // Semantic colors (status, risk, roles)
        success: { 500: '#22c55e', 600: '#16a34a' },
        warning: { 500: '#f59e0b', 600: '#d97706' },
        danger: { 500: '#ef4444', 600: '#dc2626' },
        info: { 500: '#06b6d4', 600: '#0891b2' },
        // Risk levels
        risk: {
          low: '#22c55e',
          medium: '#f59e0b',
          high: '#f97316',
          critical: '#ef4444',
        },
        // Role accents
        role: {
          technician: '#0F766E',      // ThermaTrust teal
          facility_manager: '#0F766E', // ThermaTrust teal
          contractor_manager: '#0F766E', // ThermaTrust teal
          admin: '#0F766E',           // ThermaTrust teal
        },
        // Surface colors
        surface: {
          0: '#ffffff',
          50: '#F4F7F9',
          100: '#EDF2F4',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      spacing: {
        // 4px base unit
        0: '0',
        1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '20px',
        6: '24px', 7: '28px', 8: '32px', 10: '40px', 12: '48px', 16: '64px',
      },
      borderRadius: {
        none: '0',
        sm: '4px',
        DEFAULT: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      },
    },
  },
  plugins: [],
};