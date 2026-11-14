-- Empresa virtual CLT — dia a dia da campanha e de cada passo da IA (aba Resumo)
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-11. Idempotente.
-- credito.atividade_dias(n) devolve os últimos n dias (data de São Paulo), do mais novo para o mais velho:
--   campanha (pelo dia em que a 1ª mensagem saiu): enviadas, responderam, cpf, proposta, link, pagos, sem_whatsapp
--   ia (o que aconteceu no dia): recebidas, respostas, recuperacao, campanha, atendente, simulacoes, propostas, assinaram, pagos
create or replace function credito.atividade_dias(n int default 15) returns jsonb language sql stable as $$
with dias as (select ((now() at time zone 'America/Sao_Paulo')::date - g) as dia from generate_series(0, greatest(n, 1) - 1) g),
l as (select * from credito.leads x where credito.ver_teste() or not coalesce(x.teste, false)),
cv as (select (coalesce(c.enviado_wpp, c.criado_em) at time zone 'America/Sao_Paulo')::date as dia, c.direcao, c.modo
         from credito.conversas c join l on l.id = c.lead_id
        where c.criado_em > now() - make_interval(days => n + 1) and (c.direcao = 'entrada' or c.enviado_wpp is not null or l.canal <> 'whatsapp')),
cp as (select (c.enviado_em at time zone 'America/Sao_Paulo')::date as dia, ll.*
         from credito.campanha_contatos c join credito.leads ll on ll.id = c.lead_id
        where c.status = 'enviado' and c.enviado_em > now() - make_interval(days => n + 1)),
sw as (select (wpp_verificado at time zone 'America/Sao_Paulo')::date as dia, count(*) q from credito.campanha_contatos
        where status = 'erro' and erro like 'Número sem%' group by 1),
si as (select (s.criado_em at time zone 'America/Sao_Paulo')::date as dia, count(distinct s.lead_id) q
         from credito.simulacoes s join l on l.id = s.lead_id group by 1),
pg as (select (c.dt_pagamento at time zone 'America/Sao_Paulo')::date as dia, count(*) q
         from credito.contratos c join l on l.id = c.lead_id where c.etapa = 'pago' group by 1)
select coalesce(jsonb_agg(jsonb_build_object(
  'dia', d.dia,
  'campanha', jsonb_build_object(
     'enviadas', (select count(*) from cp where cp.dia = d.dia),
     'responderam', (select count(*) from cp where cp.dia = d.dia and cp.dt_respondeu is not null),
     'cpf', (select count(*) from cp where cp.dia = d.dia and (cp.consult_id is not null or cp.cpf_informado is not null)),
     'proposta', (select count(*) from cp where cp.dia = d.dia and cp.ofertas is not null),
     'link', (select count(*) from cp where cp.dia = d.dia and cp.operation_id is not null),
     'pagos', (select count(*) from cp where cp.dia = d.dia and exists (select 1 from credito.contratos c where c.lead_id = cp.id and c.etapa = 'pago')),
     'sem_whatsapp', coalesce((select q from sw where sw.dia = d.dia), 0)),
  'ia', jsonb_build_object(
     'recebidas', (select count(*) from cv where cv.dia = d.dia and cv.direcao = 'entrada'),
     'respostas', (select count(*) from cv where cv.dia = d.dia and cv.direcao = 'saida' and coalesce(cv.modo, 'resposta') in ('resposta', 'apresentar')),
     'recuperacao', (select count(*) from cv where cv.dia = d.dia and cv.direcao = 'saida' and cv.modo = 'recuperar'),
     'campanha', (select count(*) from cv where cv.dia = d.dia and cv.direcao = 'saida' and cv.modo = 'campanha'),
     'atendente', (select count(*) from cv where cv.dia = d.dia and cv.direcao = 'saida' and cv.modo = 'humano'),
     'simulacoes', coalesce((select q from si where si.dia = d.dia), 0),
     'propostas', (select count(*) from l where (l.dt_proposta at time zone 'America/Sao_Paulo')::date = d.dia),
     'assinaram', (select count(*) from l where (l.dt_assinou at time zone 'America/Sao_Paulo')::date = d.dia),
     'pagos', coalesce((select q from pg where pg.dia = d.dia), 0))) order by d.dia desc), '[]'::jsonb)
from dias d $$;

-- entra no estado do painel junto com o resumo
create or replace function credito.resumo_painel() returns jsonb language sql stable as $$
  select jsonb_build_object(
    'hoje', credito.resumo_periodo((date_trunc('day', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo'),
    'd7', credito.resumo_periodo(now() - interval '7 days'),
    'd30', credito.resumo_periodo(now() - interval '30 days'),
    'dias', credito.atividade_dias(15),
    'na_fila', (select count(*) from credito.campanha_contatos where status = 'na_fila'),
    'campanha_ativa', coalesce((credito.config('campanha')->>'ativa')::boolean, false)) $$;
-- Painel (aba Resumo): período (Hoje / 7 / 30 dias) vale para os números, departamentos e gargalos;
-- "Campanha de hoje" e "Passo a passo da IA hoje" são sempre do dia, com os dias anteriores numa tabela logo abaixo.
