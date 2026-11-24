-- Empresa virtual CLT — dados dos agentes A/B/C para a aba "Agentes" do painel
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-10. Idempotente.
-- Para cada cliente (últimos 90 dias): situação final (credito.situacao_lead) e qual agente o atendeu em cada setor
-- [agente_id, resultado da atribuição, minutos no setor]. As taxas são calculadas no painel (filtro de período e de testes).

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
         where l.criado_em > now() - interval '90 days'
         order by l.criado_em desc limit 3000) j), '[]'::json)) $$;

create or replace function credito.estado_painel_v2(k text) returns json language plpgsql as $function$
declare e json;
begin
  e := credito.estado_painel(k);
  if e is null then return null; end if;
  return (e::jsonb || jsonb_build_object('simulacao', credito.simulacao_dados()::jsonb,
                                         'vendas', credito.vendas_diarias()::jsonb,
                                         'crm', credito.crm_clientes()::jsonb,
                                         'agentes_dados', credito.dados_agentes()::jsonb))::json;
end $function$;
