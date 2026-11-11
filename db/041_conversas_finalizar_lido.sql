-- Empresa virtual CLT — aba Conversas: finalizar atendimento pelo painel e "não lidas" que somem ao abrir
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-11 (replace em credito.atendimento_api).
--  * leads.lido_em: marcado quando a conversa é aberta no painel; o número verde conta só mensagens do cliente depois disso.
--  * atendimento_api acao 'finalizar' (texto = motivo): status parou + motivo (a etiqueta sai do motivo);
--    "número errado" / "não contatar" também bloqueiam o número.
alter table credito.leads add column if not exists lido_em timestamptz;
