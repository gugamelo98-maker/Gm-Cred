-- 112 · BI: comissão pelo prazo/tabela reais (detalhe de cada contrato pago, buscado pelo coletor n8n).
-- FGTS HUB abaixo do valor mínimo da tabela usa a primeira faixa (ex.: CARTA NA MANGA R$ 37,49 → 6,35%).

create or replace function credito.comissao_fgts_pct(p_cod integer, p_valor numeric) returns numeric language sql stable as $$
  select coalesce(
    (select percentual from credito.comissao_fgts where tabela_cod = p_cod and p_valor between valor_min and valor_max order by valor_min desc limit 1),
    (select percentual from credito.comissao_fgts where tabela_cod = p_cod and p_valor < valor_min order by valor_min limit 1))
$$;

create or replace function credito.bi_det(item jsonb) returns jsonb language sql immutable as $$
  select case jsonb_typeof(item->'detalhe') when 'string' then (item->>'detalhe')::jsonb when 'object' then item->'detalhe' else '{}'::jsonb end
$$;

create or replace view credito.bi_contratos as
select 'V8'::text banco, 'CLT'::text produto, r.item->>'name' cliente, r.item->>'documentNumber' cpf,
  (r.item->>'disbursedIssueAmount')::numeric valor, (r.item->>'createdAt')::timestamptz data, r.item->>'contractNumber' contrato,
  coalesce(d->>'simulation_config_slug', '') || coalesce(' ' || (d->'operation_data'->>'number_of_installments') || 'x', '') tabela,
  round((r.item->>'disbursedIssueAmount')::numeric * coalesce(credito.motor_pct('v8_clt', jsonb_build_object(
    'seguro', coalesce((d->'operation_data'->>'is_insured')::boolean, true), 'prazo', coalesce((d->'operation_data'->>'number_of_installments')::int, 24))), 0) / 100, 2) comissao,
  r.item->>'status' = 'paid' pago, r.item->>'status' status
from credito.bi_bancos_raw r, lateral credito.bi_det(r.item) d where r.fonte = 'v8_clt'
union all
select 'V8', 'FGTS', r.item->>'clientName', null, (r.item->>'disbursedIssueAmount')::numeric,
  coalesce((d->>'disbursementDate')::timestamptz, (d->>'createdAt')::timestamptz, (r.item->>'createdAt')::timestamptz, r.coletado_em), r.item->>'contractNumber',
  upper(coalesce(d->>'simulationFeesLabel', '')) || ' (' || coalesce(r.item->>'provider', '') || ')',
  round((r.item->>'disbursedIssueAmount')::numeric * credito.motor_pct('v8_fgts', jsonb_build_object(
    'banco', case when r.item->>'provider' ilike 'giro%' then 'GIRO' else upper(r.item->>'provider') end, 'tabela', d->>'simulationFeesLabel',
    'valor', r.item->>'disbursedIssueAmount')) / 100, 2),
  r.item->>'status' = 'paid', r.item->>'status'
from credito.bi_bancos_raw r, lateral credito.bi_det(r.item) d where r.fonte = 'v8_fgts'
union all
select 'Unno', case when r.item->>'product_type' ilike '%fgts%' then 'FGTS' else 'CLT' end, r.item->>'customer_name', r.item->>'customer_cpf',
  (r.item->>'net_value')::numeric, (r.item->>'updated_at')::timestamptz, r.item->>'ccb_number',
  (r.item->>'table_name') || coalesce(' ' || (d->'loan'->>'installments_count') || 'x', ''),
  round((r.item->>'net_value')::numeric * coalesce(credito.motor_pct(case when r.item->>'product_type' ilike '%fgts%' then 'unno_fgts' else 'unno_clt' end,
    jsonb_build_object('banco', r.item->>'bank_provider_name', 'tabela', r.item->>'table_name', 'valor', r.item->>'net_value',
      'seguro', not (r.item->>'table_name' ilike '%sem seguro%'), 'prazo', coalesce((d->'loan'->>'installments_count')::int, 24))), 0) / 100, 2),
  r.item->>'status' = 'disbursed', r.item->>'status'
from credito.bi_bancos_raw r, lateral credito.bi_det(r.item) d where r.fonte = 'unno'
union all
select 'HUB', case when r.fonte = 'hub_fgts' then 'FGTS' else 'CLT' end, trim(r.item->>'nomeCliente'), r.item->>'documento',
  (r.item->>'valorVista')::numeric, coalesce((r.item->>'dataUltimoAndamento')::timestamptz, (r.item->>'dataProposta')::timestamptz), r.item->>'id',
  r.item->>'descricaoTabela',
  round((r.item->>'valorVista')::numeric * coalesce(case when r.fonte = 'hub_fgts'
    then credito.comissao_fgts_pct((r.item->>'tabelaComercial')::int, (r.item->>'valorVista')::numeric)
    else credito.motor_comissao_pct('hub', 'clt', null, r.item->>'descricaoTabela', (r.item->>'plano')::int, null) end, 0) / 100, 2),
  (r.item->>'situacao')::int = 7, r.item->>'situacao'
from credito.bi_bancos_raw r where r.fonte like 'hub%';
