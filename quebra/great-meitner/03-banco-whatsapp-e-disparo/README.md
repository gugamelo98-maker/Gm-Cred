# 03-banco-whatsapp-e-disparo — Banco · números de WhatsApp, atendimento, disparo, rotador e API oficial (037–078)

Vários números de WhatsApp (status, QR, maturador, reserva), aba Conversas (atender pelo painel), avisos no grupo, follow-up, indicações, status de entrega, WAHA, botões, Disparo (rodadas, teste A/B, duplicar, {margem}), rotador de links (redirect1 → n8n → wa.me) e API oficial da Meta.

| Arquivo | O que é |
|---|---|
| `db/037_atendimento_numeros.sql` | Empresa virtual CLT — vários números de WhatsApp, status de cada número e aba "Conversas" (atender pelo painel) |
| `db/038_avisos_status.sql` | Empresa virtual CLT — avisos no celular do dono + status real dos números |
| `db/039_numeros_maturador.sql` | Empresa virtual CLT — aba Números (onde cada chip está, status, QR para reconectar, aviso quando cai) e Maturador |
| `db/040_campanha_multi_reserva.sql` | Empresa virtual CLT — campanha em vários números ao mesmo tempo + número reserva das conversas |
| `db/041_conversas_finalizar_lido.sql` | Empresa virtual CLT — aba Conversas: finalizar atendimento pelo painel e "não lidas" que somem ao abrir |
| `db/042_grupo_comandos.sql` | Empresa virtual CLT — perguntas no grupo "Avisos GM Cred" |
