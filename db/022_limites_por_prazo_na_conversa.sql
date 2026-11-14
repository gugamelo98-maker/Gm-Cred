-- Empresa virtual CLT — a IA conhece a parcela máxima por prazo e confere a oferta escolhida
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-10. Idempotente.

-- 1. ofertas + limites por prazo (o UPDATE separado evita conflito com o update de salvar_ofertas)
create or replace function credito.salvar_ofertas(p_lead int, p_dados jsonb, p_limites text) returns json language plpgsql as $$
begin
  if coalesce(p_limites, '') <> '' then
    update credito.leads set dados_v8 = coalesce(dados_v8, '{}'::jsonb) || jsonb_build_object('limites', p_limites) where id = p_lead;
  end if;
  return credito.acao(p_lead, 'salvar_ofertas', p_dados);
end $$;

-- 2. contexto do agente mostra "Parcela máxima que o banco libera em cada prazo"
do $do$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='credito' and p.proname='contexto_agente';
  if position('Parcela máxima que o banco libera' in d) = 0 then
    d := replace(d, $r$coalesce(' · margem por mês ' || credito.brl(l.margem), '') end,$r$,
      $r$coalesce(' · margem por mês ' || credito.brl(l.margem), '') end,
    case when l.dados_v8->>'limites' is not null then '- Parcela máxima que o banco libera em cada prazo (limite da V8, mesmo com margem maior): ' || (l.dados_v8->>'limites') end,$r$);
    if position('Parcela máxima que o banco libera' in d) = 0 then raise exception 'trecho não encontrado'; end if;
    execute d;
  end if;
end $do$;

-- 3. regras de vendas
update credito.setores set prompt = prompt || $t$
- PRAZOS: a V8 aceita 6, 8, 10, 12, 18, 24, 36, 38 e 46x. Nunca diga que um prazo ou parcela "não dá" sem antes chamar simular. Se o cliente pedir outro prazo (ex.: 12x) ou outra parcela, chame simular com esse prazo/parcela e mostre o resultado.
- LIMITE POR PRAZO: o banco limita a parcela de cada prazo (veja "Parcela máxima" nos DADOS DO CLIENTE). Se o cliente quiser uma parcela maior que o limite de um prazo, explique em uma frase que nesse prazo o banco libera até X e que, com prazo menor, a parcela pode ser maior. Nunca diga que a margem é o valor da parcela possível.$t$
where id = 'vendas' and prompt not like '%- LIMITE POR PRAZO:%';
update credito.setores set prompt = replace(prompt,
  '- ASSIM QUE o cliente disser qual oferta quer (ex.: "quero a 2", "a primeira", "a de 36x"), chame escolher_oferta com o número da oferta, na mesma hora. Sem essa ferramenta a escolha NÃO fica registrada.',
  '- ASSIM QUE o cliente disser qual oferta quer (ex.: "quero a 2", "a primeira", "a de 36x"), chame escolher_oferta com o número da oferta, na mesma hora. Sem essa ferramenta a escolha NÃO fica registrada.
- CONFIRA A ESCOLHA: o número tem que ser de uma oferta das OFERTAS atuais com o MESMO prazo e parcela que o cliente falou. Se ele pedir um prazo que não está nas OFERTAS atuais (ex.: viu 36x antes de uma nova simulação), NUNCA registre outra oferta no lugar: chame simular com esse prazo, mostre o resultado e peça a confirmação.')
where id = 'vendas' and prompt not like '%- CONFIRA A ESCOLHA:%';
update credito.setores set prompt = prompt || $t$
- Se o cliente continuar achando a parcela alta, simule uma parcela MENOR do que todas as que ele já viu (ou um prazo maior). Nunca reapresente a mesma parcela como solução.
- Nunca diga que um valor é "o máximo" que o banco libera: prazos menores com parcela maior liberam mais, dentro do limite por prazo.$t$
where id = 'vendas' and prompt not like '%MENOR do que todas as que ele já viu%';
update credito.setores set prompt = prompt || $t$
- Se a margem do cliente for maior que as parcelas oferecidas, diga que o banco limita a parcela em cada prazo e que essas são as maiores possíveis.$t$
where id = 'simulacao' and prompt not like '%banco limita a parcela em cada prazo%';

-- (no n8n: V8 Ferramentas — com parcela pedida, simula o prazo mais longo que aceita essa parcela e os 2 acima dele,
--  com a parcela limitada ao máximo de cada prazo; devolve "limites". Ações — Salvar ofertas usa credito.salvar_ofertas.)
