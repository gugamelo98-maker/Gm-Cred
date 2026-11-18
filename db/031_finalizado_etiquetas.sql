-- Empresa virtual CLT — atendimento finalizado + etiqueta
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-10. Idempotente.
--  * Todo cliente encerrado (status parou) ganha finalizado_em e uma ETIQUETA que diz por quê:
--    Sem interesse | Já tem empréstimo | Número errado | Não contatar | Sem margem
--    (e, calculadas: Não respondeu | Não assinou o link | Cancelou o contrato | Pago).
--  * Regra nova da Ana: depois de UMA tentativa de entender o motivo, se o cliente confirmar que não quer, se despedir
--    ou disser que já tem empréstimo, ela encerra (não fica "Conversando" para sempre). Resposta automática de outra
--    empresa ou "não sou fulano" = número errado.
alter table credito.leads add column if not exists etiqueta text;
alter table credito.leads add column if not exists finalizado_em timestamptz;

create or replace function credito.etiqueta_de(m text) returns text language sql immutable as $$
  select case
    when coalesce(m, '') ~* '^sem margem' then 'Sem margem'
    when coalesce(m, '') ~* 'n[uú]mero errado|n[aã]o [eé] (o|a) (cliente|pessoa)' then 'Número errado'
    when coalesce(m, '') ~* 'n[aã]o contatar' then 'Não contatar'
    when coalesce(m, '') ~* '(j[aá] (tenho|tem|fiz|fez|possui|peguei|pegou|consegui|conseguiu|contratei|contratou|estou pagando))|empr[eé]stimo ativo|estou pagando' then 'Já tem empréstimo'
    else 'Sem interesse' end $$;

create or replace function credito.fn_finalizar() returns trigger language plpgsql as $function$
begin
  if new.status = 'parou' and (old.status is distinct from 'parou' or new.motivo_parada is distinct from old.motivo_parada) then
    new.finalizado_em := coalesce(new.finalizado_em, now());
    new.etiqueta := credito.etiqueta_de(new.motivo_parada);
  elsif new.status <> 'parou' and old.status = 'parou' then
    new.finalizado_em := null; new.etiqueta := null;
  end if;
  return new;
end $function$;
create or replace trigger trg_finalizar before update of status, motivo_parada on credito.leads for each row execute function credito.fn_finalizar();

-- etiqueta mostrada no painel (inclui as calculadas pela situação)
create or replace function credito.etiqueta_lead(l credito.leads) returns text language sql stable as $$
  select case s->>'g'
    when 'pago' then 'Pago'
    when 'sem_margem' then 'Sem margem'
    when 'perdido' then case
      when s->>'t' like 'Sumiu%' then 'Não respondeu'
      when s->>'t' in ('Não assinou o link', 'Cancelou o contrato') then s->>'t'
      else coalesce(l.etiqueta, credito.etiqueta_de(l.motivo_parada)) end
  end from (select credito.situacao_lead(l) s) x $$;

update credito.leads set etiqueta = credito.etiqueta_de(motivo_parada), finalizado_em = coalesce(finalizado_em, atualizado_em)
 where status = 'parou' and etiqueta is null;

update credito.configuracoes set valor = to_jsonb((valor #>> '{}') || E'\n- FINALIZAR ATENDIMENTO: se o cliente disser que não quer, você pergunta o motivo UMA vez. Se ele confirmar que não quer, disser que já tem empréstimo, ou só se despedir ("blz", "deixa quieto", "obrigado", "ok"), responda com uma despedida curta e chame encerrar com o motivo (ex.: "sem interesse", "já tem empréstimo: está pagando outro"). Nunca deixe a conversa aberta depois da despedida.\n- RESPOSTA AUTOMÁTICA DE EMPRESA: se a resposta for de outra empresa ou robô de atendimento (ex.: "Escritório X, como podemos ajudar?"), não converse: chame encerrar com o motivo "número errado: é de uma empresa".'), atualizado_em = now()
where chave = 'regras_gerais' and (valor #>> '{}') not like '%- FINALIZAR ATENDIMENTO:%';

-- Aplicado também: crm_clientes() devolve etiqueta e finalizado; 6 conversas de 10/11 encerradas com etiqueta
-- (Aleandro, Fernando, Jaqueline = Sem interesse; Antonia = Já tem empréstimo; Sebastião e Raimundo = Número errado, bloqueados).
