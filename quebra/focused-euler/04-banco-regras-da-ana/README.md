# 04-banco-regras-da-ana — Banco · regras de conversa da Ana: silêncio, emoji, valores, prazos, CPF (073–091)

Ajustes finos da atendente IA "Ana": silêncio, prazo e PIX, menos emoji, parcela de R$300, trava de valor (nunca inventar valor), maior prazo, Consulta V8 no painel, envio pelo WAHA, frase para pedir o CPF, abertura e recusa.

| Arquivo | O que é |
|---|---|
| `db/073_silencio_prazo_pix.sql` | 073 (aplicado em 13/11): |
| `db/074_menos_emoji_mais_natural.sql` | 074 (aplicado em 13/11): a Ana estava pondo emoji em 168 de 171 mensagens (regra "no máximo 1 emoji por mensagem"). |
| `db/079_parcela_300_e_reenvio.sql` | 079 (aplicado em 13/11): |
| `db/080_prazo_e_condicao_melhor.sql` | 080 (aplicado em 13/11) — caso Luis (lead 345): Ana ofereceu "46x = R$ 1.238,68" (não existe) e "condição melhor" que liberava menos. |
| `db/081_trava_de_valor.sql` | 081 (aplicado em 13/11): "valor inventado nunca": a Ana inventou "46x = R$ 1.238,68" para o Luis (lead 345). |
| `db/082_simular_maior_prazo.sql` | 082 · Ana nunca inventa valor; cliente quer mais → mesma parcela, maior prazo |
| `db/083_trava_sem_looping.sql` | 083 · Trava de valor sem looping; prazo 99 = maior prazo liberado para o CPF |
| `db/084_consulta_v8_painel.sql` | 084 · Aba "Consulta V8" no painel (margem + simulação direto no banco) |
| `db/085_conversas_envio_waha.sql` | 085 · Conversas: mensagem do painel não saía pelos números do GM Cred Zap (waha) |
| `db/086_frase_pedir_cpf.sql` | 086 · Recepção: frase fixa para pedir o CPF (a que o dono usa) |
| `db/087_cpf_cadastrado_so_na_retomada.sql` | 087 · CPF cadastrado: primeiro pede o CPF; o CPF do cadastro só na retomada |
| `db/088_abertura_pelo_dinheiro_e_recusa.sql` | 088/089/090 · Abertura pelo dinheiro, recusa mais firme, encerrar travado |
