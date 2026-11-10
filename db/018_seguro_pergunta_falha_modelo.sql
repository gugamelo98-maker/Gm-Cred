-- Empresa virtual CLT — pergunta sobre seguro não libera a tabela sem seguro; falha do modelo sem mensagem estranha
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-10. Idempotente.

-- 1. Seguro: se o cliente perguntar, confirma e explica o benefício (sem mandar outra tabela).
--    Só libera se o cliente recusar o seguro e insistir, ou como último recurso após esgotar as tentativas.
update credito.configuracoes set valor = to_jsonb(regexp_replace(valor #>> '{}',
  '- Seguro: não fale de seguro por conta própria\..*?chame liberar_sem_seguro com motivo "cliente perguntou do seguro"\.',
  '- Seguro: não fale de seguro por conta própria. Se o cliente perguntar se tem seguro, confirme que sim e explique em uma frase o benefício (em caso de imprevisto, o seguro quita a dívida e protege a família). NÃO mande outra tabela por causa da pergunta. Se ele disser claramente que não quer o seguro, reforce o benefício uma vez; se ele insistir, aí sim chame liberar_sem_seguro com motivo "cliente recusou o seguro" e nunca diga que o seguro é obrigatório. Fora isso, liberar_sem_seguro é o ÚLTIMO DOS ÚLTIMOS recursos: só depois de entender o motivo da recusa e já ter tentado ajustar com simular e o cliente continuar recusando; nesse caso diga só que conseguiu uma condição melhor, sem falar em seguro.', 's')),
  atualizado_em = now()
where chave = 'regras_gerais';
-- credito.acao: atalho de liberação só com motivo "recusou o seguro" e depois de pelo menos 2 mensagens do cliente após as ofertas.

-- 2. Falha do modelo (ex.: limite de uso): o agente tem um modelo reserva (openai/gpt-4.1-mini via OpenRouter).
--    Se ainda assim falhar, nada é enviado ao cliente; o lead fica com reprocessar = true e o Acompanhamento
--    responde de novo no minuto seguinte.
alter table credito.leads add column if not exists reprocessar boolean not null default false;

create or replace function credito.marcar_reprocessar(p_lead int, p_modo text, p_falhou boolean) returns boolean language plpgsql as $$
begin
  if p_falhou and p_modo in ('resposta', 'apresentar') then
    update credito.leads set reprocessar = true, aguardando = case when aguardando = 'humano' then 'humano' else 'agente' end where id = p_lead;
  elsif not p_falhou then
    update credito.leads set reprocessar = false where id = p_lead and reprocessar;
  end if;
  return p_falhou;
end $$;
-- fila_acompanhamento ganhou a lista "reprocessar" (lead_id + modo) e a recuperação ignora leads aguardando nova tentativa.
