/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-tema="escuro"]'],
  theme: {
    extend: {
      colors: {
        fundo: 'var(--fundo)',
        cartao: 'var(--cartao)',
        borda: 'var(--borda)',
        texto: 'var(--texto)',
        suave: 'var(--suave)',
        apagado: 'var(--apagado)',
        marca: { DEFAULT: 'var(--marca)', forte: 'var(--marca-forte)', claro: 'var(--marca-claro)' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
