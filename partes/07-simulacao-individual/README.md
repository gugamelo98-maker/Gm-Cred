# Parte 07 — Simulação individual (aba "Simular")

`src/components/CPFValidator.jsx` — duas sub-abas:
- **Simular:** CPF com máscara → `POST /simular`. Captura o `consultId` da resposta e já preenche o campo da sub-aba Consultar.
- **Consultar Simulações:** CPF + `consultId` opcional → `POST /consultar-simulacoes`.

Fluxo: checa rate limit → valida CPF → grava registro "Processando" no IndexedDB → chama API (timeout 10 s) → atualiza o registro campo a campo (`{status, value}`) → mostra o JSON bruto da resposta. HTTP 429 ativa uma contagem regressiva de 60 s.

**Props:** `rateLimitState`, `checkRateLimit`, `recordRequest` (vêm do Dashboard, parte 12).
**Depende de:** 03, 04, 06 (`RateLimitIndicator`).
