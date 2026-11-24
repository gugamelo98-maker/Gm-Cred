# Parte 01 — Fundação (config + entrada da aplicação)

**O que é:** o "esqueleto" do projeto: dependências, build (Vite), Tailwind, ESLint, HTML de entrada, CSS global e o ponto de montagem do React.

| Arquivo | Função |
|---|---|
| `package.json` / `package-lock.json` | Dependências (React 18, React Router 6, Radix UI, framer-motion, lucide-react, xlsx, Tailwind 3, Vite 4) e scripts `dev`, `build`, `preview`, `lint` |
| `.nvmrc` / `.version` | Node 20 |
| `index.html` | HTML raiz com `<div id="root">` |
| `vite.config.js` | Config do Vite, alias `@` → `src/`, e carrega os plugins da parte 02 (só em dev) |
| `tailwind.config.js` / `postcss.config.js` | Tema Tailwind (variáveis CSS estilo shadcn) |
| `eslint.config.mjs` | Regras de lint |
| `tools/generate-llms.js` | Roda no `build`: lê os `<Helmet><title>` das páginas e gera `public/llms.txt` |
| `public/.htaccess` | Rewrite SPA (tudo → `index.html`) e cache para hospedagem Apache/Hostinger |
| `src/main.jsx` | `ReactDOM.createRoot(...).render(<App />)`. Importa `@/App` (parte 12) |
| `src/index.css` | Tailwind base + variáveis de cor + scrollbar customizada |
| `src/lib/utils.js` | `cn()` = `clsx` + `tailwind-merge` (usado por todos os componentes) |

**Depende de:** nada. **Precisa da parte 02** para o `vite.config.js` carregar (ele importa os plugins).
**Fornece:** `cn()`, alias `@`, estilos globais.
