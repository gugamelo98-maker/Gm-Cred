# Parte 04 — Serviços e camada de dados (núcleo de negócio)

**O que é:** toda a comunicação com a API externa, o controle de limite de requisições e a persistência local. Não tem tela.

### `src/services/apiService.js`
- `getApiUser()` → lê `localStorage.apiUser` (padrão `usuario_1`). Esse valor vai no campo `usuario` de toda requisição.
- `validateCPF(cpf)` → valida 11 dígitos, dígitos repetidos e os 2 dígitos verificadores.
- `validateAPIResponse(data)` → checa se é objeto.
- `callAPIWithTimeout(url, options, ms=10000)` → `fetch` com timeout + cancelamento externo; retorna `{success, response}` ou `{success:false, error, type: 'timeout'|'abort'|'network'}`.
- `simulateAPI(cpf, user, signal)` → `POST {BASE}/simular` com `{cpf, usuario}`.
- `queryDataAPI(cpf, consultId, signal)` → `POST {BASE}/consultar-simulacoes` com `{cpf, consultId, usuario}`; normaliza para `{margem, valor_solicitado, valor_aprovado, taxa, prazo, status}`.
- `BASE = https://servicos-api-clt-v8-multi-login.nttja3.easypanel.host`

### `src/services/rateLimiter.js`
Janela deslizante de **20 requisições / 60 s**, guardada em `localStorage.api_request_timestamps` (compartilhada entre abas, dispara o evento `rate_limit_updated`).
`checkRateLimit()` → `{allowed, remaining, usage, limit, resetTime, waitSeconds}` · `recordRequest()` · `clearOldRequests()`.

### `src/services/indexedDBService.js`
Banco `SimuladorDB` v1, store `simulacoes` (keyPath `id`, índices `cpf` e `data_simulacao`), com auto-recuperação (apaga e recria se detectar corrupção).
CRUD: `initDB`, `saveSimulation`, `updateSimulation`, `getAllSimulations`, `getSimulationByCPF`, `deleteSimulation`, `deleteDatabase`, `validateDatabase`.
Exportação: `exportToCSV`, `exportToJSON`, `exportQueryResultsToExcel`, `exportHistoryToExcel` (via `xlsx`).

### `src/hooks/useSimulationStorage.js`
Hook React em volta do IndexedDB: `{simulations, loading, error, save, updateProgress, remove, clearAll, getLatestByCPF, exportCSV, exportJSON, refresh}`. Usado pelas partes 07, 08 e 10.

**Depende de:** parte 01 (pacote `xlsx`), parte 03 (`use-toast` no hook).
