/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0A5C36',
          dark: '#07462B',
          light: '#0F7246',
          gradient: {
            from: '#08492C',
            to: '#0F7246',
          },
          50: '#EBF6F0',
          100: '#D7EDE2',
          200: '#AFD8C4',
          300: '#87C4A7',
          400: '#4F9D79',
          500: '#0A5C36',
          600: '#08492C',
          700: '#07462B',
          800: '#05331F',
          900: '#032113',
        },
        accent: {
          DEFAULT: '#F5A623',
          gold: '#F5A623',
          soft: '#F9D488',
          50: '#FFF8EC',
          100: '#FDEFD3',
          200: '#FBDDAB',
          300: '#F9D488',
          400: '#F7BE51',
          500: '#F5A623',
          600: '#D98A0C',
          700: '#AB6B09',
          800: '#7D4D06',
          900: '#513203',
        },
        background: {
          DEFAULT: '#F5F1EA',
          cream: '#FBF8F2',
          light: '#F8F5EF',
          white: '#FFFFFF',
        },
        text: {
          primary: '#233127',
          secondary: '#6F786F',
        },
        success: '#10B981',
        warning: '#FACC15',
        error: '#EF4444',
        info: '#3B82F6',
        gray: {
          DEFAULT: '#9CA3AF',
          light: '#E5E7EB',
        },
      },
    },
  },
  plugins: [],
}