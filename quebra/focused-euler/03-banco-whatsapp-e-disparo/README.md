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
| `db/043_followup_objecoes.sql` | Empresa virtual CLT — follow-up 1/3/7 dias para quem recebeu proposta + cola de objeções (material HUB Academy) |
| `db/044_mensagem_por_numero.sql` | Empresa virtual CLT — 1ª mensagem da campanha: uma por número, com variações e placar |
| `db/045_consulta_sem_cadastro_v8.sql` | Empresa virtual CLT — consulta quando a V8 não tem o cadastro do CPF |
| `db/046_indicacoes.sql` | Empresa virtual CLT — Programa de indicação |
| `db/047_parcela_no_bolso.sql` | Empresa virtual CLT — "qual parcela cabe no seu bolso?" antes de simular |
| `db/048_status_entrega.sql` | 048 · Status de entrega das mensagens (já aplicado no banco) |
| `db/049_waha.sql` | 049 · WAHA (WhatsApp Web real, rodando no notebook via Docker + túnel ngrok) — já aplicado no banco |
| `db/050_campanha_botoes.sql` | 050: mensagem da campanha com imagem, rodapé e botões (resposta rápida / link) |
| `db/051_atendimento_disparo.sql` | 051: função de cada número (atendimento / disparo / reserva), botão "Chamar no atendimento" (wa.me) |
| `db/052_bloquear.sql` | 052: botão BLOQUEAR. Cliente que manda só "BLOQUEAR" (toque no botão) é encerrado como |
| `db/053_disparo.sql` | 053: aba Disparo — rodadas de disparo com lista própria, números de disparo, mensagem com botões e |
| `db/054_disparo_mensagens.sql` | 054: disparo com várias mensagens (teste A/B). disparos.mensagens = [{texto, variacoes[]}] (até 5); |
| `db/056_atendimento_avisos.sql` | 056: 6775 (gmcred-campanha, atendimento) passa a mandar os avisos do grupo e a receber as conversas |
| `db/057_v8_412.sql` | 057: 412 da V8 ("Erro ao autorizarConsultaDadosTrabalhador: 412", ex.: fora do horário 5h–00h) não marca o cliente |
| `db/058_aviso_sem_margem.sql` | 058 (só n8n): "GM Cred · Acompanhamento" — quando a reconsulta automática volta "sem_margem", |
| `db/059_finalizar_sem_retomada.sql` | 059: "Finalizar" pelo painel encerra de verdade: sem_followup = true (sai das mensagens de retomada) e não troca |
| `db/060_disparo_duplicar.sql` | 060: disparo_api ganha 'duplicar' (novo disparo com mensagens, variações, imagem, botões, números e ritmo — sem a lista) |
| `db/061_perfil_numero_novo.sql` | 061: número novo recebe a logo da GM Cred e o nome "Ana Gm Cred" no perfil assim que conecta. |
| `db/062_rotador.sql` | 062: rotacionador de números (redirect1.gmcredconsignado.com.br -> Vercel -> n8n GET /webhook/gmcred/r?s=<slug> -> 302 wa.me) |
| `db/063_recusou_com_margem_saudacao.sql` | 063: (1) quem tinha margem, recebeu proposta e recusou vai para "Com margem" (remarketing) por 30 dias |
| `db/064_disparo_ate_22h.sql` | 064: disparos novos terminam às 22h por padrão (antes 20h). Duplicar continua copiando o horário do original. |
| `db/065_rotador_ola.sql` | 065: o link da API oficial (gmcredconsignado.com.br / www / redirect1) manda "Olá!" — é a identificação de origem. |
| `db/066_api_oficial.sql` | 066: aba "API oficial" — disparo por mensagem modelo (template) da Meta, separado do disparo dos chips. |
| `db/075_grupo_ve_disparos.sql` | 075 (aplicado em 13/11): o grupo respondia "campanha PAUSADA" com o disparo rodando — só conhecia a Campanha antiga. |
| `db/076_botoes_por_mensagem.sql` | 076 (aplicado em 13/11): imagem, rodapé e botões passam a ser de CADA mensagem do disparo (antes eram do disparo inteiro). |
| `db/077_disparo_margem.sql` | 077 (aplicado em 13/11): variável {margem} no disparo. |
| `db/078_disparo_sem_nome_sem_margem.sql` | 078 (aplicado em 13/11): 6 mensagens do disparo 12 saíram ", consta no seu CPF uma margem de até uma boa parcela" |
