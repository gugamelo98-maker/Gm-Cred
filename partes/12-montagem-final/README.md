# Parte 12 — Montagem final (rotas + Dashboard)

| Arquivo | Função |
|---|---|
| `src/App.jsx` | `AuthProvider` → `BrowserRouter` → rotas: `/login`, `/register`, `/dashboard` (protegida), `/settings` (protegida), `/` e `*` → `/dashboard`. Inclui o `<Toaster />` |
| `src/pages/Dashboard.jsx` | Header + Sidebar + troca de abas animada (framer-motion) entre as partes 07, 08, 09 e 10. Guarda o estado do rate limit (atualiza a cada 1 s e ouve eventos entre abas) e repassa para 07 e 08. Na abertura valida o IndexedDB e o recria se precisar |

**Depende de:** todas as partes 01–11. É a peça que "liga" tudo; só compila depois que as anteriores estiverem no lugar.
