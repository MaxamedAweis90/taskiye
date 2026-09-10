/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Slate Color Palette Extensions (#0F172A, #1E293B, #334155)
        slate: {
          950: '#0B0F19',
          900: '#0F172A',
          850: '#162032',
          800: '#1E293B',
          750: '#243248',
          700: '#334155',
          600: '#475569',
          500: '#64748B',
          400: '#94A3B8',
          300: '#CBD5E1',
          200: '#E2E8F0',
          100: '#F1F5F9',
        },

        // Amber & Yellow Accent Extensions (#FACC15, #EAB308)
        amber: {
          300: '#FFE083',
          400: '#FACC15', // Electric Amber CTA
          500: '#EAB308', // Deep Amber Hover
          600: '#CA8A04',
          700: '#A16207',
        },

        // Emerald Accent Extensions (#10B981)
        emerald: {
          400: '#4EDEA3',
          500: '#10B981',
          600: '#00A572',
        },

        // Kinetic Midnight - Core Tokens from plan/colors/DESIGN.md
        surface: {
          DEFAULT: '#0b1326',
          dim: '#0b1326',
          bright: '#31394d',
          variant: '#2d3449',
          card: '#162032',
          elevated: '#1E293B',
          highlight: '#243248',
          lowest: '#060e20',
          low: '#131b2e',
          container: '#171f33',
          high: '#222a3d',
          highest: '#2d3449',
        },
        'on-surface': {
          DEFAULT: '#dae2fd',
          variant: '#d1c6ab',
        },
        'inverse-surface': {
          DEFAULT: '#dae2fd',
          on: '#283044',
        },
        outline: {
          DEFAULT: '#9a9078',
          variant: '#4d4632',
          subdued: '#334155',
        },
        'surface-tint': '#eec200',

        // Primary & Amber Accents
        primary: {
          DEFAULT: '#ffecb9',
          on: '#3c2f00',
          container: '#facc15', // Electric Amber CTA
          'on-container': '#6c5700',
          inverse: '#735c00',
          fixed: '#ffe083',
          'fixed-dim': '#eec200',
          'on-fixed': '#231b00',
          'on-fixed-variant': '#574500',
          dim: '#eab308', // Deep Amber Hover
        },

        // Secondary & Emerald Accents
        secondary: {
          DEFAULT: '#4edea3',
          on: '#003824',
          container: '#00a572',
          'on-container': '#00311f',
          fixed: '#6ffbbe',
          'fixed-dim': '#4edea3',
          'on-fixed': '#002113',
          'on-fixed-variant': '#005236',
          emerald: '#10b981', // Kinetic Emerald Checkmarks
        },

        // Tertiary Palette
        tertiary: {
          DEFAULT: '#ffebc4',
          on: '#3f2e00',
          container: '#ffc93e',
          'on-container': '#715500',
          fixed: '#ffdf9a',
          'fixed-dim': '#f7be1d',
          'on-fixed': '#251a00',
          'on-fixed-variant': '#5a4300',
        },

        // Error Feedback
        error: {
          DEFAULT: '#ffb4ab',
          on: '#690005',
          container: '#93000a',
          'on-container': '#ffdad6',
        },

        // Canvas & Structural Tiers
        canvas: {
          base: '#0B0F19',
          frame: '#0F172A',
        },
        background: '#0b1326',
        'on-background': '#dae2fd',

        // Heatmap Matrix Tokens
        heatmap: {
          0: '#232734', // 0% - 10%
          1: '#715814', // 11% - 50%
          2: '#ca8a04', // 51% - 99%
          3: '#facc15', // 100%
        },

        // Text Contrast Hierarchy
        text: {
          emphasized: '#FFFFFF',
          primary: '#E2E8F0',
          secondary: '#CBD5E1',
          muted: '#94A3B8',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'display-lg': ['40px', { lineHeight: '48px', letterSpacing: '-0.03em', fontWeight: '800' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.025em', fontWeight: '700' }],
        'headline-lg-mobile': ['26px', { lineHeight: '34px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-md': ['24px', { lineHeight: '32px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'headline-sm': ['20px', { lineHeight: '28px', letterSpacing: '-0.015em', fontWeight: '600' }],
        'title-md': ['16px', { lineHeight: '24px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'title-sm': ['14px', { lineHeight: '20px', letterSpacing: '-0.005em', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '26px', letterSpacing: '0em', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '22px', letterSpacing: '0em', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '18px', letterSpacing: '0.005em', fontWeight: '400' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.04em', fontWeight: '600' }],
        'label-sm': ['11px', { lineHeight: '14px', letterSpacing: '0.06em', fontWeight: '700' }],
        'metric-val': ['28px', { lineHeight: '32px', letterSpacing: '-0.03em', fontWeight: '800' }],
      },
      boxShadow: {
        'glow-amber': '0 0 20px -3px rgba(250, 204, 21, 0.35)',
        'glow-amber-btn': '0 0 20px -2px rgba(250, 204, 21, 0.4)',
        'glow-emerald': '0 0 16px -2px rgba(16, 185, 129, 0.4)',
        'glow-emerald-check': '0 0 14px rgba(16, 185, 129, 0.5)',
        'app-window': '0 24px 48px -12px rgba(0, 0, 0, 0.65)',
        'modal-elevated': '0 20px 40px -8px rgba(0, 0, 0, 0.75), 0 0 1px 1px rgba(255, 255, 255, 0.05)',
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        full: '9999px',
      },
    },
  },
  plugins: [],
};
