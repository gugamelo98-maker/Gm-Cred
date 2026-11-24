# 02-banco-crm-recuperacao-financeiro — Banco · CRM, recuperação, financeiro, campanha e resumo (023–036)

CRM de clientes, dados dos agentes para o painel, áudios, recuperação pelos gerentes, Financeiro (gastos, lucro e retorno), Campanha (a IA chama a base importada), prospecção, etiquetas, grupo "Com margem" e o Resumo do painel.

| Arquivo | O que é |
|---|---|
| `db/023_crm_clientes.sql` | Empresa virtual CLT — cadastro de clientes (CRM): todo lead que entra fica guardado com nome, número, CPF e onde parou |
| `db/024_dados_agentes.sql` | Empresa virtual CLT — dados dos agentes A/B/C para a aba "Agentes" do painel |
| `db/025_audios.sql` | Empresa virtual CLT — áudios do cliente |
| `db/026_regras_unicas_painel.sql` | Empresa virtual CLT — regras únicas do painel: testes separados, "no escritório", funil alinhado aos setores, placar igual à aba Agentes |
| `db/027_recuperacao.sql` | Empresa virtual CLT — recuperação (gerentes): tempos, horário, "não quero", "não contatar" e medição |
| `db/028_financeiro.sql` | Empresa virtual CLT — aba Financeiro: gastos (disparos de WhatsApp, tráfego pago, BMs, outros), lucro e retorno |
| `db/029_campanha.sql` | Empresa virtual CLT — Campanha: a IA chama os clientes importados (1 mensagem a cada 5 min, 8h-20h) |
| `db/030_prospeccao_cpf_base_bloqueio.sql` | Empresa virtual CLT — Prospecção, CPF da base, número errado, atendente humano no WhatsApp e ajustes da recuperação |
| `db/031_finalizado_etiquetas.sql` | Empresa virtual CLT — atendimento finalizado + etiqueta |
| `db/032_com_margem.sql` | Empresa virtual CLT — grupo "Com margem" (repescagem) |
| `db/033_revisao_abas.sql` | Empresa virtual CLT — revisão das abas (11/11/2026). Aplicado no Postgres da Cloudfy via replace nas funções: |
| `db/034_sem_whatsapp.sql` | Empresa virtual CLT — números sem WhatsApp na campanha |
| `db/035_resumo_painel.sql` | Empresa virtual CLT — resumo do painel (aba "Resumo"): os números que importam, por período |
| `db/036_atividade_dia.sql` | Empresa virtual CLT — dia a dia da campanha e de cada passo da IA (aba Resumo) |
