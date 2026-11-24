# Parte 03 — Kit de UI (componentes base, padrão shadcn/ui)

**O que é:** componentes visuais genéricos, sem regra de negócio, construídos sobre Radix UI + Tailwind + `class-variance-authority`.

`alert-dialog`, `badge` (variantes `success`, `warning`, `destructive`…), `button`, `card`, `dialog`, `input`, `label`, `progress`, `scroll-area`, `table`, `textarea`, `toast` + `toaster` + `use-toast` (sistema de notificações).

**Depende de:** parte 01 (`cn()` em `src/lib/utils.js`).
**Fornece:** todos os `@/components/ui/*` usados pelas partes 05–12.
**Teste isolado:** após montar 01+02+03 dá para renderizar qualquer um deles em um `App.jsx` provisório.
