/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // === Editorial Kitchen palette =========================================
      // Uma única história: FOGO sobre COURO. Sem cinza neutro.
      colors: {
        bg: {
          DEFAULT: 'rgb(var(--bg) / <alpha-value>)',
          panel:   'rgb(var(--bg-panel) / <alpha-value>)',
          soft:    'rgb(var(--bg-soft) / <alpha-value>)',
          crust:   'rgb(var(--bg-crust) / <alpha-value>)',
          inset:   'rgb(var(--bg-inset) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          dim:     'rgb(var(--ink-dim) / <alpha-value>)',
          mute:    'rgb(var(--ink-mute) / <alpha-value>)',
          fade:    'rgb(var(--ink-fade) / <alpha-value>)',
        },
        ember:   'rgb(var(--ember) / <alpha-value>)',
        saffron: 'rgb(var(--saffron) / <alpha-value>)',
        herb:    'rgb(var(--herb) / <alpha-value>)',
        wine:    'rgb(var(--wine) / <alpha-value>)',
        copper:  'rgb(var(--copper) / <alpha-value>)',
      },

      // === Tipografia =======================================================
      // Sem Inter. Tudo em Fraunces (serif variável editorial) + JetBrains Mono.
      fontFamily: {
        sans:    ['"Fraunces"', 'Georgia', 'serif'],
        display: ['"Fraunces"', 'Georgia', 'serif'],
        mono:    ['"JetBrains Mono"', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Escala editorial em razão ~1.25
        '2xs':   ['10px', { lineHeight: '14px', letterSpacing: '0.16em' }],
        xs:      ['11px', { lineHeight: '15px' }],
        sm:      ['13px', { lineHeight: '18px' }],
        base:    ['15px', { lineHeight: '22px' }],
        lg:      ['18px', { lineHeight: '24px' }],
        xl:      ['22px', { lineHeight: '28px' }],
        '2xl':   ['28px', { lineHeight: '32px' }],
        '3xl':   ['38px', { lineHeight: '40px' }],
        '4xl':   ['56px', { lineHeight: '54px' }],
        '5xl':   ['84px', { lineHeight: '78px' }],
      },

      keyframes: {
        stir: {
          '0%, 100%': { transform: 'rotate(-14deg) translateY(-1px)' },
          '50%':      { transform: 'rotate(14deg)  translateY(1px)'  },
        },
        pop: {
          '0%':   { transform: 'scale(0.7)', opacity: '0' },
          '60%':  { transform: 'scale(1.06)', opacity: '1' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
        emberPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(238,123,48,0.45)' },
          '50%':      { boxShadow: '0 0 0 8px rgba(238,123,48,0)' },
        },
      },
      animation: {
        stir: 'stir 1.4s ease-in-out infinite',
        pop:  'pop 260ms cubic-bezier(.2,1.3,.4,1)',
        ember: 'emberPulse 2.4s ease-out infinite',
      },

      boxShadow: {
        // Sombras "narrativas" — quentes, não defaults cinzas
        plate:  '0 24px 48px -24px rgba(0,0,0,0.7), inset 0 1px 0 rgba(244,234,213,0.06)',
        ember:  '0 0 0 1px rgba(238,123,48,0.45), 0 12px 32px -12px rgba(238,123,48,0.45)',
        tile:   'inset 0 1px 0 rgba(244,234,213,0.08), 0 1px 0 rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
};
