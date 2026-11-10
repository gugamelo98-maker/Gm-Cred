-- Empresa virtual CLT — recuperação em 3 tentativas: 5, 10 e 30 minutos depois da última mensagem do cliente
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-10. Idempotente.

update credito.configuracoes set valor = '{"tempos":[5,10,30]}', atualizado_em = now() where chave = 'recuperacao';

create or replace function credito.fila_acompanhamento() returns json language sql stable as $$
  with r as (select coalesce(credito.config('recuperacao')->'tempos', '[5,10,30]'::jsonb) t)
  select json_build_object(
    'consultas', coalesce((select json_agg(json_build_object('lead_id', id, 'cpf', cpf_informado)) from credito.leads
                   where status = 'cpf_ok' and status_v8 in ('PROCESSANDO', 'WAITING_CONSULT', 'WAITING_CREDIT_ANALYSIS', 'CONSENT_APPROVED', 'WAITING_CONSENT', 'PROCESSING', 'PENDING')
                     and coalesce(consult_id, '') <> 'demo' and cpf_informado is not null), '[]'::json),
    'operacoes', coalesce((select json_agg(json_build_object('lead_id', id, 'operation_id', operation_id)) from credito.leads
                   where operation_id is not null and operation_id not like 'demo-%' and not evento_simulado
                     and coalesce(status_operacao, '') not in ('paid', 'canceled', 'refunded')), '[]'::json),
    'recuperar', coalesce((select json_agg(json_build_object('lead_id', l.id)) from credito.leads l, r
                   where l.aguardando = 'cliente' and l.status not in ('parou', 'assinou')
                     and l.recuperacoes < jsonb_array_length(r.t)
                     and l.ultima_interacao < now() - make_interval(mins => (r.t->>l.recuperacoes)::int)), '[]'::json)) $$;

-- cliente respondeu: conta ponto para a Recuperação (se foi depois de uma retomada) e o ciclo recomeça
create or replace function credito.fn_marcar_recuperacao() returns trigger language plpgsql as $$
begin
  if new.direcao = 'entrada' then
    update credito.atribuicoes set resultado = 'recuperou', fim = now()
     where lead_id = new.lead_id and setor_id = 'gerente' and resultado is null
       and (select modo from credito.conversas c where c.lead_id = new.lead_id and c.direcao = 'saida' and c.id < new.id order by c.id desc limit 1) = 'recuperar';
    update credito.leads set recuperacoes = 0 where id = new.lead_id and recuperacoes > 0;
  end if;
  return new;
end $$;

-- condição melhor (sem seguro) só na última tentativa de recuperação (30 min)
do $$ declare f text; begin
  f := pg_get_functiondef('credito.contexto_agente(int,text,text)'::regprocedure);
  f := replace(f, $x$if p_modo = 'recuperar' then update credito.leads set sem_seguro_liberado = true where id = p_lead; end if;$x$,
    $x$if p_modo = 'recuperar' then update credito.leads set sem_seguro_liberado = true where id = p_lead
      and recuperacoes + 1 >= coalesce(jsonb_array_length(credito.config('recuperacao')->'tempos'), 3); end if;$x$);
  execute f;
end $$;
