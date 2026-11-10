-- Empresa virtual CLT — regras únicas do painel: testes separados, "no escritório", funil alinhado aos setores, placar igual à aba Agentes
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-10. Idempotente.

-- 1. TESTES: o painel escolhe se quer ver os clientes do Chat teste (padrão do painel: não). Fora do painel, tudo continua visível.
create or replace function credito.ver_teste() returns boolean language sql stable as $$
  select coalesce(nullif(current_setting('credito.ver_teste', true), ''), '1') = '1' $$;

-- 2. SITUAÇÃO do cliente (textos mais curtos). g = grupo, e = etapa mais longe que chegou
create or replace function credito.situacao_lead(l credito.leads) returns jsonb language sql stable as $$
  select case
    when l.operation_id is not null and credito.etapa_contrato(l.status_operacao) = 'pago' then '{"t":"Pago","g":"pago","e":6}'
    when l.operation_id is not null and credito.etapa_contrato(l.status_operacao) = 'cancelado' then '{"t":"Cancelou o contrato","g":"perdido","e":5}'
    when l.operation_id is not null and credito.etapa_contrato(l.status_operacao) = 'formalizado' then '{"t":"Aguardando pagamento","g":"andamento","e":5}'
    when l.operation_id is not null and coalesce(l.ultima_interacao, l.atualizado_em) < now() - interval '24 hours' then '{"t":"Não assinou o link","g":"perdido","e":4}'
    when l.operation_id is not null then '{"t":"Link enviado","g":"andamento","e":4}'
    when l.status = 'parou' and l.motivo_parada ilike 'sem margem%' then '{"t":"Sem margem","g":"sem_margem","e":2}'
    when l.status = 'parou' and l.ofertas is not null then '{"t":"Desistiu · recebeu proposta","g":"perdido","e":3}'
    when l.status = 'parou' then '{"t":"Desistiu","g":"perdido","e":1}'
    when l.aguardando = 'humano' then '{"t":"Com atendente","g":"andamento","e":3}'
    when l.aguardando = 'cliente' and l.ultima_interacao < now() - interval '24 hours' then
      jsonb_build_object('t', 'Sumiu · ' || case when l.oferta is not null then 'escolheu oferta' when l.ofertas is not null then 'recebeu proposta'
                                             when l.cpf_informado is not null then 'mandou CPF' else 'sem CPF' end, 'g', 'perdido',
                         'e', case when l.oferta is not null then 4 when l.ofertas is not null then 3 when l.cpf_informado is not null then 2 else 1 end)
    when l.oferta is not null then '{"t":"Escolheu oferta · falta PIX","g":"andamento","e":4}'
    when l.ofertas is not null then '{"t":"Recebeu a proposta","g":"andamento","e":3}'
    when l.cpf_informado is not null then '{"t":"Consultando CPF","g":"andamento","e":2}'
    else '{"t":"Conversando","g":"andamento","e":1}' end::jsonb $$;

-- 3. NO ESCRITÓRIO: uma regra só para "Atendendo", salas e parados = cliente em andamento (quem sumiu há 24h, desistiu ou já foi pago sai)
create or replace function credito.no_escritorio(l credito.leads) returns boolean language sql stable as $$
  select l.status <> 'parou' and (credito.situacao_lead(l)->>'g') = 'andamento' and (credito.ver_teste() or not coalesce(l.teste, false)) $$;

create or replace view credito.v_leads_parados as
 select l.id, l.nome, l.telefone, l.setor_id, s.nome as setor, l.status, l.aguardando, l.entrou_setor_em, l.ultima_interacao, s.sla_minutos,
        (round(extract(epoch from (now() - l.entrou_setor_em)) / 60::numeric))::integer as minutos_no_setor
   from credito.leads l join credito.setores s on s.id = l.setor_id
  where l.status <> 'parou' and s.sla_minutos is not null and (now() - l.entrou_setor_em) > make_interval(mins => s.sla_minutos)
    and credito.no_escritorio(l);

create or replace view credito.v_resumo_hoje as
 with d as (select (date_trunc('day', (now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo') as ini),
      l as (select * from credito.leads x where credito.ver_teste() or not coalesce(x.teste, false))
 select (select count(*) from l, d where l.criado_em >= d.ini) as entraram_hoje,
        (select count(*) from credito.leads x where credito.no_escritorio(x)) as em_andamento,
        (select count(*) from l, d where l.dt_assinou >= d.ini) as fecharam_hoje,
        (select coalesce(sum(l.comissao), 0::numeric) from l, d where l.dt_assinou >= d.ini) as comissao_hoje,
        (select coalesce(sum(l.valor), 0::numeric) from l, d where l.dt_assinou >= d.ini) as volume_hoje,
        (select count(*) from credito.v_leads_parados) as parados,
        (select count(*) from l, d where l.status = 'parou' and l.atualizado_em >= d.ini) as perdidos_hoje;

create or replace view credito.v_setores_painel as
 select id, nome, descricao, cor, ordem, sla_minutos,
        (select count(*) from credito.leads l where l.setor_id = s.id and credito.no_escritorio(l)) as leads_ativos,
        (select count(*) from credito.v_leads_parados p where p.setor_id = s.id) as leads_parados,
        (select count(*) from credito.agentes a where a.setor_id = s.id and a.ativo) as agentes,
        (select count(*) from credito.agentes a where a.setor_id = s.id and a.ativo and a.status = 'trabalhando') as agentes_trabalhando
   from credito.setores s where ativo order by ordem;

-- 4. FUNIL alinhado aos setores: entraram → mandaram CPF → receberam a proposta (ofertas) → escolheram → link enviado → assinaram → pagos
--    (colunas antigas mantidas: com_margem = recebeu a proposta; receberam_proposta = link enviado)
create or replace view credito.v_funil_30d as
 with l as (select * from credito.leads x where x.criado_em >= now() - interval '30 days' and (credito.ver_teste() or not coalesce(x.teste, false)))
 select (select count(*) from l) as entraram,
        (select count(*) from l where l.cpf_informado is not null or l.consult_id is not null) as enviaram_cpf,
        (select count(*) from l where l.dt_simulou is not null or l.ofertas is not null) as com_margem,
        (select count(*) from l where l.operation_id is not null or l.dt_proposta is not null) as receberam_proposta,
        (select count(*) from l where l.dt_assinou is not null and credito.etapa_contrato(l.status_operacao) <> 'cancelado') as assinaram,
        (select count(*) from l where l.operation_id is not null and credito.etapa_contrato(l.status_operacao) = 'pago') as pagos,
        coalesce((select json_agg(m.* order by m.total desc) from (
            select coalesce(nullif(trim(l.motivo_parada), ''), 'Sem motivo informado') as motivo, count(*) as total
              from l where l.status = 'parou' group by 1 order by count(*) desc limit 5) m), '[]'::json) as motivos_perda,
        (select count(*) from l where l.status = 'parou') as perdidos,
        (select count(*) from l where l.oferta is not null or l.operation_id is not null) as escolheram;

create or replace function credito.vendas_diarias() returns json language sql stable as $function$
 with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
 dias as (select generate_series((select d from hoje) - 61, (select d from hoje), interval '1 day')::date as dia),
 l as (select (criado_em at time zone 'America/Sao_Paulo')::date as dia, count(*) as n from credito.leads where credito.ver_teste() or not coalesce(teste, false) group by 1),
 dg as (select (criado_em at time zone 'America/Sao_Paulo')::date as dia, count(*) as n from credito.contratos where coalesce(etapa,'')<>'cancelado' group by 1),
 pg as (select (dt_pagamento at time zone 'America/Sao_Paulo')::date as dia, count(*) as n, sum(valor_liberado) as v, sum(comissao) as c
          from credito.contratos where etapa='pago' and dt_pagamento is not null group by 1)
 select coalesce(json_agg(json_build_object(
          'dia', dias.dia, 'clientes', coalesce(l.n,0), 'digitados', coalesce(dg.n,0),
          'pagos', coalesce(pg.n,0), 'liberado', coalesce(pg.v,0), 'comissao', coalesce(pg.c,0)) order by dias.dia), '[]'::json)
 from dias left join l on l.dia=dias.dia left join dg on dg.dia=dias.dia left join pg on pg.dia=dias.dia
$function$;

-- 5. cadastro e dados dos agentes respeitam o filtro de testes
create or replace function credito.crm_clientes() returns json language sql stable as $$
  select coalesce(json_agg(x order by x.ultima desc nulls last), '[]'::json) from (
    select l.id, l.nome, l.telefone, l.cpf_informado as cpf, s->>'t' as situacao, s->>'g' as grupo, (s->>'e')::int as etapa,
           l.setor_id, l.motivo_parada as motivo, l.margem,
           case when l.oferta is not null then json_build_object('valor', (l.oferta->>'valor')::numeric, 'prazo', (l.oferta->>'prazo')::int, 'parcela', (l.oferta->>'parcela')::numeric) end as oferta,
           l.criado_em as entrou, coalesce(l.ultima_interacao, l.atualizado_em, l.criado_em) as ultima, l.teste
      from credito.leads l, lateral credito.situacao_lead(l) s
     where credito.ver_teste() or not coalesce(l.teste, false)
     order by coalesce(l.ultima_interacao, l.criado_em) desc limit 2000) x $$;

create or replace function credito.dados_agentes() returns json language sql stable as $$
  select json_build_object(
    'agentes', coalesce((select json_agg(json_build_object('id', a.id, 'nome', a.nome, 'setor', a.setor_id, 'versao', a.versao, 'abordagem', a.abordagem, 'peso', a.peso)
                          order by s.ordem, a.versao) from credito.agentes a join credito.setores s on s.id = a.setor_id where a.ativo and a.versao is not null), '[]'::json),
    'jornadas', coalesce((select json_agg(j order by j.e desc) from (
        select l.id as l, l.teste as t, l.criado_em as e, s->>'g' as g, (s->>'e')::int as et, s->>'t' as s,
               (select json_object_agg(x.setor_id, json_build_array(x.agente_id, x.resultado, x.minutos))
                  from (select distinct on (t.setor_id) t.setor_id, t.agente_id, t.resultado,
                               round(extract(epoch from (coalesce(t.fim, now()) - t.inicio)) / 60)::int as minutos
                          from credito.atribuicoes t where t.lead_id = l.id order by t.setor_id, t.inicio) x) as a
          from credito.leads l, lateral credito.situacao_lead(l) s
         where l.criado_em > now() - interval '90 days' and (credito.ver_teste() or not coalesce(l.teste, false))
         order by l.criado_em desc limit 3000) j), '[]'::json)) $$;

-- 6. PLACAR do Chat teste com a mesma conta da aba Agentes:
--    sucesso = fez o passo do setor; não contam contra o agente: sem margem e clientes ainda em atendimento
create or replace function credito.placar_agentes(p_incluir_teste boolean default true) returns json language sql stable as $function$
  with base as (
    select distinct on (t.lead_id, t.setor_id) t.setor_id, t.agente_id, t.resultado, s->>'g' as g, (s->>'e')::int as e
      from credito.atribuicoes t join credito.leads l on l.id = t.lead_id, lateral credito.situacao_lead(l) s
     where p_incluir_teste or not coalesce(l.teste, false)
     order by t.lead_id, t.setor_id, t.inicio),
  r as (
    select setor_id, agente_id, g,
           case setor_id when 'formalizacao' then (g = 'pago' or (e >= 5 and g <> 'perdido'))
                         when 'posvenda' then g = 'pago'
                         else coalesce(resultado in ('avancou', 'recuperou'), false) end as seguiu
      from base)
  select coalesce(json_agg(x order by x.ordem, x.versao), '[]'::json) from (
    select s.ordem, s.id as setor, s.nome as setor_nome, a.nome, a.versao, a.abordagem,
           count(r.agente_id) filter (where r.seguiu or r.g = 'perdido') as atendidos,
           count(r.agente_id) filter (where r.seguiu) as sucesso,
           count(r.agente_id) filter (where not r.seguiu and r.g = 'perdido') as perdidos,
           case when count(r.agente_id) filter (where r.seguiu or r.g = 'perdido') > 0
                then round(100.0 * count(r.agente_id) filter (where r.seguiu) / count(r.agente_id) filter (where r.seguiu or r.g = 'perdido')) end as taxa
      from credito.agentes a join credito.setores s on s.id = a.setor_id
      left join r on r.agente_id = a.id and r.setor_id = a.setor_id
     where a.ativo and a.versao is not null
     group by s.ordem, s.id, s.nome, a.nome, a.versao, a.abordagem) x $function$;

-- 7. estado do painel: salas só com quem está no escritório, versão dos agentes, sem eventos/alertas de teste
--    e saúde do n8n contando só os fluxos "GM Cred" (antes um erro em outro projeto deixava o painel vermelho)
do $do$
declare d text; r record;
begin
  select pg_get_functiondef('credito.estado_painel(text)'::regprocedure) into d;
  if position('credito.no_escritorio(leads)' in d) = 0 then
    for r in select * from (values
      ($a$from credito.leads where status <> 'parou' order by ultima_interacao desc limit 300$a$,
       $b$from credito.leads where credito.no_escritorio(leads) order by ultima_interacao desc limit 300$b$),
      ($a$'papel',a.papel,$a$, $b$'papel',a.papel,'versao',a.versao,$b$),
      ($a$from credito.eventos order by criado_em desc limit 40$a$,
       $b$from credito.eventos ev where credito.ver_teste() or ev.lead_id is null or not exists (select 1 from credito.leads tl where tl.id = ev.lead_id and tl.teste) order by criado_em desc limit 40$b$),
      ($a$(select * from credito.v_atencao limit 100) a$a$,
       $b$(select * from credito.v_atencao va where credito.ver_teste() or va.lead_id is null or not exists (select 1 from credito.leads tl where tl.id = va.lead_id and tl.teste) limit 100) a$b$),
      ($a$from rarelookingorca.execution_entity where status='error' and "startedAt" > now() - interval '1 hour'$a$,
       $b$from rarelookingorca.execution_entity where status='error' and "startedAt" > now() - interval '1 hour' and "workflowId" in (select w.id from rarelookingorca.workflow_entity w where w.name like 'GM Cred%')$b$)
    ) v(de, para) loop
      if position(r.de in d) = 0 then raise exception 'trecho não encontrado: %', left(r.de, 60); end if;
      d := replace(d, r.de, r.para);
    end loop;
    execute d;
  end if;
  select pg_get_functiondef('credito.simulacao_dados()'::regprocedure) into d;
  if position('credito.ver_teste()' in d) = 0 then
    if position($a$from credito.leads where criado_em >= now() - interval '30 days'$a$ in d) = 0 then raise exception 'simulacao_dados: trecho não encontrado'; end if;
    d := replace(d, $a$from credito.leads where criado_em >= now() - interval '30 days'$a$,
                    $b$from credito.leads where criado_em >= now() - interval '30 days' and (credito.ver_teste() or not coalesce(teste, false))$b$);
    execute d;
  end if;
end $do$;

-- 8. estado do painel v3: p_teste liga/desliga os clientes de teste; p_partes diz o que carregar ("crm", "agentes")
--    (Clientes e Agentes só são carregados quando a aba precisa)
create or replace function credito.estado_painel_v3(k text, p_teste boolean, p_partes text) returns json language plpgsql as $function$
declare e json;
begin
  perform set_config('credito.ver_teste', case when coalesce(p_teste, false) then '1' else '0' end, true);
  e := credito.estado_painel(k);
  if e is null then return null; end if;
  return (e::jsonb || jsonb_build_object('simulacao', credito.simulacao_dados()::jsonb, 'vendas', credito.vendas_diarias()::jsonb, 'ver_teste', coalesce(p_teste, false))
          || case when coalesce(p_partes, '') like '%crm%' then jsonb_build_object('crm', credito.crm_clientes()::jsonb) else '{}'::jsonb end
          || case when coalesce(p_partes, '') like '%agentes%' then jsonb_build_object('agentes_dados', credito.dados_agentes()::jsonb) else '{}'::jsonb end)::json;
end $function$;
