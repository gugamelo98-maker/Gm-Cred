-- 111 · BI: contratos lidos direto dos bancos (aplicado em 25/11/2026).
-- Fluxo n8n "[BI] 💰 Contratos dos bancos (coleta)" (a cada hora + POST /webhook/bi/coletar) grava as propostas do mês cruas;
-- "[Painel] 📊 BI (contratos pagos)" (POST /webhook/painel/bi) devolve o resumo para a tela.
-- Pago = V8 'paid', Unno 'disbursed', HUB situacao 7 (AprovadaEncerrada).

create table if not exists credito.bi_bancos_raw (
  fonte text not null, id_externo text not null, item jsonb not null, coletado_em timestamptz not null default now(),
  primary key (fonte, id_externo));
create table if not exists credito.bi_coletas (id bigserial primary key, em timestamptz default now(), resumo jsonb);

-- funções aplicadas no banco: credito.bi_tokens(), credito.bi_salvar(jsonb), credito.bi_api(text, jsonb)
-- e a view credito.bi_contratos (V8 CLT/FGTS, Unno CLT/FGTS, HUB CLT/FGTS normalizados com valor, data, tabela e comissão estimada).
