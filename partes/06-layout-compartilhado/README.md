# Parte 06 — Layout compartilhado

| Arquivo | Função |
|---|---|
| `src/components/Header.jsx` | Barra superior: logo "CPF Validator Pro", nome/e-mail do usuário, botão sair |
| `src/components/Sidebar.jsx` | Menu lateral (desktop) / barra inferior (mobile): Simular · Lote · Dados · Histórico · Config. "Config" navega para `/settings`; os demais trocam a aba do Dashboard via `onTabChange` |
| `src/components/RateLimitIndicator.jsx` | Barra de uso do limite de requisições (`usage/limit/remaining`) |

**Depende de:** 01, 03, 05 (`useAuth`). **Usado por:** 07, 08, 11, 12.
