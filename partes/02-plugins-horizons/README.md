# Parte 02 — Plugins do editor Hostinger Horizons

**O que é:** plugins Vite que só existem para o editor visual da Hostinger Horizons (edição inline, modo seleção, restauração de rota em iframe). **Não fazem parte da lógica do produto** e só são ativados em modo dev (`isDev` no `vite.config.js`).

| Arquivo | Função |
|---|---|
| `plugins/visual-editor/*` | Edição inline de textos JSX no editor Horizons |
| `plugins/selection-mode/*` | Selecionar elementos da página no editor |
| `plugins/vite-plugin-iframe-route-restoration.js` | Mantém a rota ao recarregar dentro do iframe do editor |
| `plugins/utils/ast-utils.js` | Helpers de AST (Babel) usados pelos plugins |

**Depende de:** devDependencies `@babel/*` (parte 01).
**Na remontagem:** obrigatória enquanto o `vite.config.js` original for usado. Se quiser se livrar dela, remova os 4 `import` e a linha `...(isDev ? [...] : [])` do `vite.config.js`.
