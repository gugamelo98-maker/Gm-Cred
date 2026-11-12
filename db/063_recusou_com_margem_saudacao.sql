-- 063: (1) quem tinha margem, recebeu proposta e recusou vai para "Com margem" (remarketing) por 30 dias
--          — exceto não contatar / clicou em bloquear / número errado;
--      (3) a Ana não promete "te aviso" (nada fica agendado);
--      (5) a Ana recebe a hora de Brasília para saudar/despedir certo (bom dia / boa tarde / boa noite).
create or replace function credito.mig063() returns void language plpgsql as $f$
declare v text;
begin
  v := pg_get_functiondef('credito.situacao_lead'::regproc);
  if position('Recusou · tem margem' in v) = 0 then
    v := replace(v, $a$    when l.status = 'parou' and l.ofertas is not null then '{"t":"Desistiu · recebeu proposta","g":"perdido","e":3}'$a$,
      $b$    when l.status = 'parou' and l.ofertas is not null and not coalesce(l.nao_contatar, false)
         and coalesce(l.motivo_parada, '') !~* '^(não contatar|nao contatar|número errado|numero errado)'
         and coalesce(l.ultima_interacao, l.atualizado_em) > now() - interval '30 days' then '{"t":"Recusou · tem margem","g":"com_margem","e":3}'
    when l.status = 'parou' and l.ofertas is not null then '{"t":"Desistiu · recebeu proposta","g":"perdido","e":3}'$b$);
    if position('Recusou · tem margem' in v) = 0 then raise exception 'situacao_lead: trecho não encontrado'; end if;
    execute v;
  end if;

  v := pg_get_functiondef('credito.etiqueta_lead'::regproc);
  if position('Recusou · tem margem' in v) = 0 then
    v := replace(v, $a$when 'com_margem' then case when s->>'t' = 'Não assinou o link' then 'Tem margem · não assinou o link' else$a$,
      $b$when 'com_margem' then case when s->>'t' = 'Não assinou o link' then 'Tem margem · não assinou o link'
                                  when s->>'t' = 'Recusou · tem margem' then 'Tem margem · recusou' || coalesce(' (' || l.motivo_parada || ')', '') else$b$);
    if position('Recusou · tem margem' in v) = 0 then raise exception 'etiqueta_lead: trecho não encontrado'; end if;
    execute v;
  end if;

  v := pg_get_functiondef('credito.contexto_agente'::regproc);
  if position('horário de Brasília' in v) = 0 then
    v := replace(v, $a$'- Nome: ' || coalesce(l.nome, 'ainda não sabemos'),$a$,
      $b$'- Nome: ' || coalesce(l.nome, 'ainda não sabemos'),
    '- Agora são ' || to_char(now() at time zone 'America/Sao_Paulo', 'HH24:MI') || ' (horário de Brasília). Cumprimente e se despeça de acordo: "bom dia" até 11:59, "boa tarde" de 12:00 a 17:59, "boa noite" a partir de 18:00. Nunca deseje "ótimo dia" à tarde ou à noite.',$b$);
    if position('horário de Brasília' in v) = 0 then raise exception 'contexto_agente: trecho não encontrado'; end if;
    execute v;
  end if;

  update credito.configuracoes set valor = to_jsonb(replace(valor #>> '{}',
      $a$chame encerrar com o motivo (ex.: "sem interesse", "já tem empréstimo: está pagando outro"). Nunca deixe a conversa aberta depois da despedida.$a$,
      $b$chame encerrar com o motivo (ex.: "sem interesse", "já tem empréstimo: está pagando outro", "achou pouco o valor", "vai esperar: mês que vem"). Use o motivo real que o cliente deu. Nunca deixe a conversa aberta depois da despedida.
- NUNCA prometa avisar ou chamar o cliente depois (ex.: "te aviso", "te chamo quando mudar", "assim que tiver novidade te falo"): nada fica agendado. Na despedida, diga só que, se precisar, é só chamar.$b$))
   where chave = 'regras_gerais' and position('NUNCA prometa avisar' in valor #>> '{}') = 0;
  if position('NUNCA prometa avisar' in (credito.config('regras_gerais') #>> '{}')) = 0 then raise exception 'regras_gerais: trecho não encontrado'; end if;
end $f$;
select credito.mig063();
