-- Empresa virtual CLT — ofertas COM seguro por padrão; sem seguro só como último recurso
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-09. Idempotente.
-- Regras:
--  * a simulação calcula com e sem seguro, mas o agente só "vê" as ofertas com seguro (numeradas primeiro);
--  * as sem seguro são liberadas (sem_seguro_liberado) pela ferramenta liberar_sem_seguro quando o cliente está
--    desistindo ou pergunta se dá sem seguro, ou automaticamente na recuperação (cliente parado ~2h);
--  * se o cliente perguntar, o agente nunca diz que o seguro é obrigatório (evita venda casada);
--  * se a V8 só aprovar sem seguro, essas ofertas aparecem normalmente.

alter table credito.leads add column if not exists sem_seguro_liberado boolean not null default false;

create or replace function credito.ofertas_demo(p_margem numeric, p_prazo int) returns jsonb language sql immutable as $$
  select jsonb_agg(jsonb_build_object('n', n, 'seguro', seg, 'prazo', prazo, 'parcela', p_margem,
           'valor', round(p_margem * (1 - power(1.0498, -prazo)) / 0.0498 * case when seg then 0.93 else 0.97 end, 2),
           'config_id', 'demo', 'sim_id', 'demo-' || n) order by n)
  from (select * from (values (1, true, 46), (2, true, 36), (3, true, 24), (4, false, 46), (5, false, 36), (6, false, 24)) o(n, seg, prazo) where p_prazo is null
        union all
        select * from (values (1, true, p_prazo), (2, false, p_prazo)) o(n, seg, prazo) where p_prazo is not null) x $$;
create or replace function credito.ofertas_demo(p_margem numeric) returns jsonb language sql immutable as $$ select credito.ofertas_demo(p_margem, null) $$;

update credito.configuracoes set valor = to_jsonb(replace(valor #>> '{}',
  '- Seguro: quando houver ofertas com e sem seguro, o cliente escolhe. Se todas as ofertas forem com seguro (regra da V8 para esse cliente), não diga que é opcional.',
  '- Seguro: as OFERTAS mostradas já vêm com seguro prestamista. Não ofereça nem mencione opção sem seguro por conta própria. Só chame liberar_sem_seguro em último caso: quando o cliente estiver desistindo (não quer, achou caro, vai pensar) ou quando ele perguntar se dá para fazer sem seguro. Se ele perguntar, nunca diga que o seguro é obrigatório.')),
  atualizado_em = now()
where chave = 'regras_gerais';
update credito.setores set prompt = replace(prompt,
  '- Se houver ofertas com e sem seguro, diga em poucas palavras que o seguro é opcional. Se todas forem com seguro, não fale disso.',
  '- Não fale de seguro nem de opção sem seguro; apresente só as OFERTAS listadas.') where id = 'simulacao';
update credito.setores set prompt = replace(prompt,
  '- Objeção ou "não quero": pergunte com leveza o que pesou (valor da parcela, prazo, insegurança) e ofereça um ajuste real (simular com parcela menor ou outro prazo). Encerre só se ele insistir.',
  '- Objeção ou "não quero": pergunte com leveza o que pesou e ofereça um ajuste real. Como último recurso para não perder o cliente, chame liberar_sem_seguro e apresente a opção sem seguro (libera um valor maior). Encerre só se ele insistir.') where id = 'vendas';
update credito.setores set prompt = prompt || E'\n- Se nos DADOS DO CLIENTE aparecerem OFERTAS SEM SEGURO, use-as como último argumento: o valor liberado é maior.'
where id = 'gerente' and prompt not like '%OFERTAS SEM SEGURO%';

-- contexto_agente (só mostra sem seguro depois de liberado; recuperação libera) e credito.acao
-- (liberar_sem_seguro, trava em escolher_oferta, texto de salvar_ofertas só com as visíveis): versões completas aplicadas no banco.
-- n8n: V8 devolve as ofertas com seguro primeiro; Agente ganhou a ferramenta liberar_sem_seguro.
