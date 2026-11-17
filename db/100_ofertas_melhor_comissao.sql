-- 100 · Ofertas CLT por melhor comissão
-- credito.comissao_mapa_v8(): % de comissão da V8 por prazo (1..60), com e sem seguro,
-- lido de credito.tabelas_comissao (degraus: vale a maior linha com parcelas <= prazo).
-- n8n "GM Cred · V8 Ferramentas" (iHwSWUjkB6I5aXhI): novo nó "Comissões" entre
-- "Pré-cálculo" e "Montar simulações"; Montar simula os 3 prazos de maior comissão que o
-- banco libera para o CPF (empate: maior prazo); Resultado escolhe os 2 de maior comissão
-- e devolve percentual e comissao por oferta. Pedido de prazo pelo cliente continua valendo.
create or replace function credito.comissao_mapa_v8() returns jsonb language sql stable as $$
  select jsonb_build_object(
    'com', (select coalesce(jsonb_object_agg(p::text, x.percentual), '{}'::jsonb) from generate_series(1,60) p
            cross join lateral (select percentual from credito.tabelas_comissao where ativo and banco='v8digital' and com_seguro and parcelas <= p order by parcelas desc limit 1) x),
    'sem', (select coalesce(jsonb_object_agg(p::text, x.percentual), '{}'::jsonb) from generate_series(1,60) p
            cross join lateral (select percentual from credito.tabelas_comissao where ativo and banco='v8digital' and not com_seguro and parcelas <= p order by parcelas desc limit 1) x))
$$;
