# 05-banco-fgts-hub-unno — Banco · FGTS (Lotus/HUB), higienização e Unno (092+)

Produtos novos: FGTS pela Lotus e pela HUB (BMP/J17), higienização em fila, link do FGTS com passagem para humano, e a Unno como segundo banco do CLT (`banco_escolhido`).

| Arquivo | O que é |
|---|---|
| `db/092_lotus_fgts_teste.sql` | 092 · Teste FGTS Lotus (não é a V8; não mexe no fluxo da Ana) |
| `db/094_link_fgts_handoff.sql` | 094 · Link FGTS + encaminhar FGTS direto para o humano |
| `db/095_higienizacao_fila.sql` | 095 · Higienização V8 em segundo plano (página testeextrair) |
| `db/096_lotus_fgts_fila.sql` | 096 · Robô FGTS Lotus (fila no servidor, com telefone) |
| `db/098_hub_fgts_na_fila_lotus.sql` | 098–101 (aplicadas direto no banco via MCP): HUB no robô FGTS da Lotus |
| `db/099_ana_fgts_hub.sql` | 099 (aplicada direto no banco via MCP): Ana atende FGTS pela HUB |
| `db/101_unno_ana.sql` | 101 · Ana vende CLT pela Unno (fluxo real da doc docs.unnotech.com.br) |
| `db/102_banco_escolhido_unno.sql` | 102 · leads.banco_escolhido aceita 'unno' |
