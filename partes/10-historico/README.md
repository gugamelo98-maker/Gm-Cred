# Parte 10 — Histórico (aba "Histórico")

`src/components/SimulationHistory.jsx` — lista tudo o que está no IndexedDB (atualiza sozinha periodicamente), filtro por CPF/ConsultId, modal de detalhes com o JSON completo, excluir um registro, limpar tudo (com confirmação) e exportar Excel (só CPF + ConsultId) / CSV / JSON.

Lida com os **dois formatos** de registro gravados no banco: o formato objeto `{status, value}` (partes 07 e 09) e o formato plano (parte 08).

**Depende de:** 03, 04 (`useSimulationStorage`, `exportHistoryToExcel`).
