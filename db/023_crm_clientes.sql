-- Empresa virtual CLT — cadastro de clientes (CRM): todo lead que entra fica guardado com nome, número, CPF e onde parou
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-10. Idempotente.

-- situação do cliente (uma regra só; o painel apenas mostra). g = grupo do filtro, e = etapa mais longe que chegou (1..6)
create or replace function credito.situacao_lead(l credito.leads) returns jsonb language sql stable as $$
  select case
    when l.operation_id is not null and credito.etapa_contrato(l.status_operacao) = 'pago' then '{"t":"Pago","g":"pago","e":6}'
    when l.operation_id is not null and credito.etapa_contrato(l.status_operacao) = 'cancelado' then '{"t":"Cancelou o contrato","g":"perdido","e":5}'
    when l.operation_id is not null and credito.etapa_contrato(l.status_operacao) = 'formalizado' then '{"t":"Assinou · aguardando pagamento","g":"andamento","e":5}'
    when l.operation_id is not null and coalesce(l.ultima_interacao, l.atualizado_em) < now() - interval '24 hours' then '{"t":"Recebeu o link e não assinou","g":"perdido","e":4}'
    when l.operation_id is not null then '{"t":"Link enviado · falta assinar","g":"andamento","e":4}'
    when l.status = 'parou' and l.motivo_parada ilike 'sem margem%' then '{"t":"Sem margem","g":"sem_margem","e":2}'
    when l.status = 'parou' and l.ofertas is not null then '{"t":"Desistiu depois das ofertas","g":"perdido","e":3}'
    when l.status = 'parou' then '{"t":"Desistiu","g":"perdido","e":1}'
    when l.aguardando = 'humano' then '{"t":"Com atendente humano","g":"andamento","e":3}'
    when l.aguardando = 'cliente' and l.ultima_interacao < now() - interval '24 hours' then
      jsonb_build_object('t', 'Parou de responder · ' || case when l.oferta is not null then 'escolheu a oferta' when l.ofertas is not null then 'viu as ofertas'
                                                            when l.cpf_informado is not null then 'mandou o CPF' else 'sem CPF' end, 'g', 'perdido',
                         'e', case when l.oferta is not null then 4 when l.ofertas is not null then 3 when l.cpf_informado is not null then 2 else 1 end)
    when l.oferta is not null then '{"t":"Escolheu a oferta · falta PIX","g":"andamento","e":4}'
    when l.ofertas is not null then '{"t":"Recebeu as ofertas","g":"andamento","e":3}'
    when l.cpf_informado is not null then '{"t":"Mandou o CPF · consultando","g":"andamento","e":2}'
    else '{"t":"Conversando · sem CPF","g":"andamento","e":1}' end::jsonb $$;

create or replace function credito.crm_clientes() returns json language sql stable as $$
  select coalesce(json_agg(x order by x.ultima desc nulls last), '[]'::json) from (
    select l.id, l.nome, l.telefone, l.cpf_informado as cpf, s->>'t' as situacao, s->>'g' as grupo, (s->>'e')::int as etapa,
           l.setor_id, l.motivo_parada as motivo, l.margem,
           case when l.oferta is not null then json_build_object('valor', (l.oferta->>'valor')::numeric, 'prazo', (l.oferta->>'prazo')::int, 'parcela', (l.oferta->>'parcela')::numeric) end as oferta,
           l.criado_em as entrou, coalesce(l.ultima_interacao, l.atualizado_em, l.criado_em) as ultima, l.teste
      from credito.leads l, lateral credito.situacao_lead(l) s
     order by coalesce(l.ultima_interacao, l.criado_em) desc limit 2000) x $$;

-- o painel (webhook /escritorio/estado, protegido pela chave) passa a receber "crm"
create or replace function credito.estado_painel_v2(k text) returns json language plpgsql as $function$
declare e json;
begin
  e := credito.estado_painel(k);
  if e is null then return null; end if;
  return (e::jsonb || jsonb_build_object('simulacao', credito.simulacao_dados()::jsonb,
                                         'vendas', credito.vendas_diarias()::jsonb,
                                         'crm', credito.crm_clientes()::jsonb))::json;
end $function$;

-- Sem margem tem aba própria (grupo sem_margem) e não conta como perda.
-- Perdidos = parou de responder (24h) + recebeu o link e não assinou (24h) + cancelou o contrato + desistiu.
