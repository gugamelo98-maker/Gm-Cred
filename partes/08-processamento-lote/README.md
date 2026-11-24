# Parte 08 — Processamento em lote (aba "Lote")

| Arquivo | Função |
|---|---|
| `BatchProcessor.jsx` | Textarea para colar CPFs (um por linha); extrai os que têm 11 dígitos e remove duplicados |
| `BatchProcessing.jsx` | Orquestrador: fila com **5 workers em paralelo**; para cada CPF espera 3 s → respeita o rate limit → `POST /simular` → se tiver `consultId`, `POST /consultar-simulacoes` e junta os dados → salva no IndexedDB. Mostra progresso, ETA, sucesso/falha, cancelamento (AbortController), reprocessar erros e exportação CSV/JSON |
| `BatchResults.jsx` | Tabela de resultados por CPF com status (pendente, aguardando, processando, sucesso, erro) |

**Props do `BatchProcessing`:** iguais às da parte 07.
**Depende de:** 03, 04, 06.
