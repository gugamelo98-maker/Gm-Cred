-- Empresa virtual CLT — resumo do painel (aba "Resumo"): os números que importam, por período
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-11. Idempotente.
-- credito.resumo_painel() devolve {hoje, d7, d30}, cada um com:
--   numeros: entraram, simularam, propostas (link para assinar), assinaram, pagos, liberado, comissao
--   setores: por departamento -> atendidos, avancaram, perderam, andamento
--   agentes: por agente -> setor, versao, atendidos, avancaram, perderam, andamento, esperando (cliente esperando a resposta dele agora)
--   campanha: enviados, responderam, cpf, proposta, link, pagos, sem_whatsapp
-- Respeita o filtro de testes do painel e ignora a prospecção que nunca respondeu.
create or replace function credito.resumo_periodo(ini timestamptz) returns jsonb language sql stable as $$
with l as (select * from credito.leads x where (credito.ver_teste() or not coalesce(x.teste, false)) and x.setor_id <> 'prospeccao'),
pg as (select c.* from credito.contratos c join l on l.id = c.lead_id where c.etapa = 'pago' and c.dt_pagamento >= ini),
t as (select a.setor_id, a.agente_id, a.lead_id,
             case when a.setor_id = 'formalizacao' then case when l.dt_assinou is not null then 'avancou' when a.resultado = 'perdeu' then 'perdeu' end
                  when a.setor_id = 'posvenda' then case when exists (select 1 from credito.contratos c where c.lead_id = l.id and c.etapa = 'pago') then 'avancou' when a.resultado = 'perdeu' then 'perdeu' end
                  when a.resultado in ('avancou', 'recuperou') then 'avancou'
                  when a.resultado = 'perdeu' or l.status = 'parou' then 'perdeu' end as r
        from credito.atribuicoes a join l on l.id = a.lead_id where a.inicio >= ini),
cp as (select c.*, ll.dt_respondeu, ll.consult_id, ll.ofertas, ll.operation_id, ll.id as lid
         from credito.campanha_contatos c left join credito.leads ll on ll.id = c.lead_id
        where c.status = 'enviado' and c.enviado_em >= ini)
select jsonb_build_object(
  'numeros', jsonb_build_object(
     'entraram', (select count(*) from l where coalesce(l.dt_respondeu, l.criado_em) >= ini),
     'simularam', (select count(*) from l where l.dt_simulou >= ini),
     'propostas', (select count(*) from l where l.dt_proposta >= ini),
     'assinaram', (select count(*) from l where l.dt_assinou >= ini),
     'pagos', (select count(*) from pg),
     'liberado', (select coalesce(sum(valor_liberado), 0) from pg),
     'comissao', (select coalesce(sum(comissao), 0) from pg)),
  'setores', coalesce((select jsonb_object_agg(setor_id, jsonb_build_object('atendidos', n, 'avancaram', av, 'perderam', pe, 'andamento', n - av - pe))
       from (select setor_id, count(distinct lead_id) n, count(distinct lead_id) filter (where r = 'avancou') av,
                    count(distinct lead_id) filter (where r = 'perdeu') pe from t group by 1) s), '{}'::jsonb),
  'agentes', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'setor', a.setor_id, 'versao', a.versao,
         'atendidos', coalesce(x.n, 0), 'avancaram', coalesce(x.av, 0), 'perderam', coalesce(x.pe, 0), 'andamento', coalesce(x.n - x.av - x.pe, 0),
         'esperando', (select count(*) from l where l.agente_id = a.id and l.aguardando = 'agente' and l.status <> 'parou'
                          and l.ultima_interacao < now() - interval '10 minutes')) order by a.setor_id, a.versao)
       from credito.agentes a
       left join (select agente_id, count(distinct lead_id) n, count(distinct lead_id) filter (where r = 'avancou') av,
                         count(distinct lead_id) filter (where r = 'perdeu') pe from t group by 1) x on x.agente_id = a.id
      where a.ativo and a.versao is not null and a.setor_id <> 'prospeccao'), '[]'::jsonb),
  'campanha', jsonb_build_object(
     'enviados', (select count(*) from cp),
     'responderam', (select count(*) from cp where dt_respondeu is not null),
     'cpf', (select count(*) from cp where consult_id is not null),
     'proposta', (select count(*) from cp where ofertas is not null),
     'link', (select count(*) from cp where operation_id is not null),
     'pagos', (select count(*) from cp where exists (select 1 from credito.contratos c where c.lead_id = cp.lid and c.etapa = 'pago')),
     'sem_whatsapp', (select count(*) from credito.campanha_contatos where status = 'erro' and erro like 'Número sem%' and wpp_verificado >= ini))) $$;

create or replace function credito.resumo_painel() returns jsonb language sql stable as $$
  select jsonb_build_object(
    'hoje', credito.resumo_periodo((date_trunc('day', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo'),
    'd7', credito.resumo_periodo(now() - interval '7 days'),
    'd30', credito.resumo_periodo(now() - interval '30 days')) $$;

-- o painel recebe o resumo junto com o estado
create or replace function credito.estado_painel_v3(k text, p_teste boolean, p_partes text) returns json language plpgsql as $function$
declare e json;
begin
  perform set_config('credito.ver_teste', case when coalesce(p_teste, false) then '1' else '0' end, true);
  e := credito.estado_painel(k);
  if e is null then return null; end if;
  return (e::jsonb || jsonb_build_object('simulacao', credito.simulacao_dados()::jsonb, 'vendas', credito.vendas_diarias()::jsonb,
                                         'ver_teste', coalesce(p_teste, false), 'resumo_v2', credito.resumo_painel())
          || case when coalesce(p_partes, '') like '%crm%' then jsonb_build_object('crm', credito.crm_clientes()::jsonb) else '{}'::jsonb end
          || case when coalesce(p_partes, '') like '%agentes%' then jsonb_build_object('agentes_dados', credito.dados_agentes()::jsonb) else '{}'::jsonb end)::json;
end $function$;
