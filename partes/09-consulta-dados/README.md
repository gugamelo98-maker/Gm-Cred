# Parte 09 — Consulta de dados (aba "Dados")

| Arquivo | Função |
|---|---|
| `src/hooks/useQueryDataStorage.js` | `queryData(cpf, consultId)` e `batchQueryData([{cpf, consultId}])` (sequencial, 2 s entre chamadas, espera o rate limit), `cancelBatch()`. Cada resultado também é salvo no histórico |
| `src/components/QueryData.jsx` | Modo individual (CPF + ConsultId) ou lote (linhas `CPF ConsultId` separados por espaço) |
| `src/components/QueryResults.jsx` | Tabela com margem, valor solicitado/aprovado, taxa, prazo + exportar Excel |

**Depende de:** 03, 04 (usa `queryDataAPI`, `rateLimiter` e `saveSimulation` direto, não pelo Dashboard).
