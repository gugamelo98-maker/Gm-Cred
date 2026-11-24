-- Empresa virtual CLT — Programa de indicação
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-11. Idempotente.
-- Regras (dono, 11/11):
--  * qualquer pessoa pode indicar, sem limite; cadastro ANTES (nome completo, CPF, chave PIX) -> recebe código e link;
--  * código = PRIMEIRONOME + 2 números (JOAO27); link = wa.me/554891071361?text=Oi! Vim pela indicação JOAO27;
--  * a indicação só vale se o amigo chegar com o código (link) ou se o indicador passou o número do amigo antes
--    (aí a Ana chama o amigo pelo 1361). Sem código = sem indicação;
--  * crédito quando o contrato do indicado é PAGO: 20% da comissão (com seguro) ou 5% (sem seguro), mínimo R$ 20;
--  * saldo acumula; pago pelo painel (aba Indicações -> Marcar como pago), que lança o valor no Financeiro;
--  * o indicado também pode virar indicador.
create table if not exists credito.indicadores (
  id serial primary key, lead_id int, nome text not null, cpf text, pix text, telefone text,
  codigo text not null unique, criado_em timestamptz not null default now(), ativo boolean not null default true);
create table if not exists credito.indicacoes (
  id serial primary key, indicador_id int not null references credito.indicadores(id), lead_id int, nome text, telefone text,
  origem text not null default 'link', status text not null default 'aberta', valor numeric(12,2), contrato_id int,
  criado_em timestamptz not null default now(), creditada_em timestamptz);
create unique index if not exists indicacoes_lead_uq on credito.indicacoes (lead_id) where lead_id is not null;
create table if not exists credito.indicacao_pagamentos (
  id serial primary key, indicador_id int not null references credito.indicadores(id), valor numeric(12,2) not null,
  pago_em timestamptz not null default now(), obs text);
alter table credito.leads add column if not exists indicado_por int;
insert into credito.configuracoes (chave, valor) values ('indicacao', '{"numero":"554891071361","instancia":"gmcred-6","pct_com_seguro":20,"pct_sem_seguro":5,"minimo":20}'::jsonb)
on conflict (chave) do nothing;

create or replace function credito.ind_codigo(p_nome text) returns text language plpgsql as $f$
declare b text := upper(regexp_replace(translate(split_part(trim(coalesce(p_nome, 'AMIGO')), ' ', 1),
  'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^A-Za-z]', '', 'g'));
  c text; i int := 0;
begin
  if b = '' then b := 'AMIGO'; end if;
  b := left(b, 10);
  loop
    c := b || lpad((10 + floor(random() * (case when i < 40 then 90 else 900 end)))::int::text, 2, '0');
    exit when not exists (select 1 from credito.indicadores where codigo = c);
    i := i + 1;
  end loop;
  return c;
end $f$;

create or replace function credito.ind_link(p_codigo text) returns text language sql stable as $$
  select 'https://wa.me/' || (credito.config('indicacao')->>'numero') || '?text=' || replace('Oi! Vim pela indicação ' || p_codigo, ' ', '%20') $$;

create or replace function credito.ind_saldo(p_ind int) returns numeric language sql stable as $$
  select coalesce((select sum(valor) from credito.indicacoes where indicador_id = p_ind and status = 'creditada'), 0)
       - coalesce((select sum(valor) from credito.indicacao_pagamentos where indicador_id = p_ind), 0) $$;

-- cadastro (pela Ana ou pelo painel). Devolve código e link.
create or replace function credito.ind_cadastrar(p_lead int, p_nome text, p_cpf text, p_pix text, p_tel text) returns json language plpgsql as $f$
declare r credito.indicadores%rowtype; v_cpf text := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
begin
  if coalesce(trim(p_nome), '') = '' or v_cpf is null or coalesce(trim(p_pix), '') = '' then
    return json_build_object('ok', false, 'texto', 'Para cadastrar faltam dados: preciso do nome completo, CPF e chave PIX.');
  end if;
  select * into r from credito.indicadores where cpf = v_cpf limit 1;
  if r.id is null then
    insert into credito.indicadores (lead_id, nome, cpf, pix, telefone, codigo)
    values (p_lead, initcap(lower(trim(p_nome))), v_cpf, trim(p_pix), nullif(regexp_replace(coalesce(p_tel, ''), '\D', '', 'g'), ''), credito.ind_codigo(p_nome))
    returning * into r;
    perform credito.avisar('🎁 Novo indicador: ' || r.nome || ' · código ' || r.codigo);
  end if;
  return json_build_object('ok', true, 'codigo', r.codigo, 'link', credito.ind_link(r.codigo), 'texto',
    'Cadastro feito. Mande ao cliente o código ' || r.codigo || ' e o link ' || credito.ind_link(r.codigo)
    || ' para ele compartilhar com os amigos. Explique em 1 frase: quando o amigo fechar, ele ganha uma parte, mínimo R$ 20, pago no PIX.');
end $f$;

-- o indicador passa o número do amigo: cria o lead e a Ana chama o amigo pelo número de indicação
create or replace function credito.ind_amigo(p_lead int, p_nome text, p_tel text) returns json language plpgsql as $f$
declare i credito.indicadores%rowtype; t text := regexp_replace(coalesce(p_tel, ''), '\D', '', 'g'); v_lead int; c jsonb := credito.config('indicacao');
begin
  select * into i from credito.indicadores where lead_id = p_lead or telefone = (select regexp_replace(telefone, '\D', '', 'g') from credito.leads where id = p_lead) order by id limit 1;
  if i.id is null then return json_build_object('ok', false, 'texto', 'Esse cliente ainda não é indicador. Antes peça nome completo, CPF e chave PIX e chame cadastrar_indicador.'); end if;
  if length(t) in (10, 11) then t := '55' || t; end if;
  if length(t) < 12 then return json_build_object('ok', false, 'texto', 'O telefone do amigo parece incompleto. Peça com DDD.'); end if;
  if exists (select 1 from credito.numeros_bloqueados where telefone in (t, credito.tel_lead(t))) or exists (select 1 from credito.leads where regexp_replace(telefone, '\D', '', 'g') in (t, credito.tel_lead(t))) then
    return json_build_object('ok', false, 'texto', 'Esse contato já está na nossa base, então não conta como indicação nova. Agradeça mesmo assim.');
  end if;
  insert into credito.leads (telefone, nome, status, setor_id, canal, teste, aguardando, ultima_interacao, entrou_setor_em, instancia, indicado_por)
  values (t, nullif(initcap(lower(trim(coalesce(p_nome, '')))), ''), 'disparado', 'prospeccao', 'whatsapp', false, 'cliente', now(), now(), c->>'instancia', i.id)
  returning id into v_lead;
  perform credito.atribuir_agente(v_lead, 'prospeccao');
  insert into credito.indicacoes (indicador_id, lead_id, nome, telefone, origem) values (i.id, v_lead, p_nome, t, 'contato');
  insert into credito.conversas (lead_id, agente_id, direcao, conteudo, setor_id, modo)
  values (v_lead, (select agente_id from credito.leads where id = v_lead), 'saida',
    'Oi' || coalesce(' ' || nullif(split_part(trim(coalesce(p_nome, '')), ' ', 1), ''), '') || ', tudo bem? Aqui é a Ana, da GM Cred. '
    || split_part(i.nome, ' ', 1) || ' falou que você estava precisando resolver uma coisa de crédito. É isso mesmo?', 'prospeccao', 'indicacao');
  perform credito.avisar('🎁 Nova indicação de ' || i.nome || ' (' || i.codigo || '): ' || coalesce(nullif(p_nome, ''), 'contato') || ' ' || credito.tel_fmt(t));
  return json_build_object('ok', true, 'texto', 'Pronto, já vou chamar o amigo. Agradeça e diga que avisa quando ele fechar.');
end $f$;

-- amigo chega com o código: liga o lead à indicação (só se o lead ainda não tiver indicação)
create or replace function credito.ind_detectar(p_lead int, p_texto text) returns void language plpgsql as $f$
declare i credito.indicadores%rowtype; v_cod text;
begin
  if p_lead is null or exists (select 1 from credito.indicacoes where lead_id = p_lead) then return; end if;
  for i in select * from credito.indicadores where ativo loop
    if upper(regexp_replace(coalesce(p_texto, ''), '\s', '', 'g')) like '%' || i.codigo || '%' then
      if i.lead_id = p_lead then return; end if;  -- não vale indicar a si mesmo
      insert into credito.indicacoes (indicador_id, lead_id, nome, telefone, origem)
      select i.id, l.id, l.nome, l.telefone, 'link' from credito.leads l where l.id = p_lead on conflict do nothing;
      update credito.leads set indicado_por = i.id where id = p_lead;
      perform credito.avisar('🎁 Nova indicação de ' || i.nome || ' (' || i.codigo || '): ' || credito.tel_fmt((select telefone from credito.leads where id = p_lead)));
      return;
    end if;
  end loop;
end $f$;

-- contrato pago -> credita a indicação
create or replace function credito.fn_ind_credito() returns trigger language plpgsql as $f$
declare c jsonb := credito.config('indicacao'); x credito.indicacoes%rowtype; v numeric;
begin
  if new.etapa = 'pago' and (tg_op = 'INSERT' or old.etapa is distinct from 'pago') then
    select * into x from credito.indicacoes where lead_id = new.lead_id and status = 'aberta';
    if x.id is not null then
      v := greatest(coalesce((c->>'minimo')::numeric, 20),
             round(coalesce(new.comissao, 0) * (case when new.com_seguro then coalesce((c->>'pct_com_seguro')::numeric, 20) else coalesce((c->>'pct_sem_seguro')::numeric, 5) end) / 100, 2));
      update credito.indicacoes set status = 'creditada', valor = v, contrato_id = new.id, creditada_em = now() where id = x.id;
      perform credito.avisar('💰 Indicação paga: pagar R$ ' || replace(to_char(v, 'FM999990.00'), '.', ',') || ' para '
        || (select nome || ' · PIX ' || coalesce(pix, '?') || ' · saldo R$ ' || replace(to_char(credito.ind_saldo(id), 'FM999990.00'), '.', ',') from credito.indicadores where id = x.indicador_id));
    end if;
  end if;
  return new;
end $f$;
create or replace trigger trg_ind_credito after insert or update of etapa on credito.contratos for each row execute function credito.fn_ind_credito();

-- API do painel (POST /escritorio/indicacoes): ver | cadastrar | pagar
create or replace function credito.indicacoes_api(k text, p_acao text, p_dados jsonb) returns json language plpgsql as $f$
declare v_id int := nullif(p_dados->>'id', '')::int; v_s numeric; r json;
begin
  if not credito.validar_chave(k) then return null; end if;
  if p_acao = 'cadastrar' then
    r := credito.ind_cadastrar(null, p_dados->>'nome', p_dados->>'cpf', p_dados->>'pix', p_dados->>'telefone');
    if not (r->>'ok')::boolean then return json_build_object('erro', r->>'texto'); end if;
  elsif p_acao = 'pagar' and v_id is not null then
    v_s := credito.ind_saldo(v_id);
    if v_s > 0 then
      insert into credito.indicacao_pagamentos (indicador_id, valor, obs) values (v_id, v_s, 'pago pelo painel');
      insert into credito.gastos (data, categoria, valor, descricao, tipo)
      values ((now() at time zone 'America/Sao_Paulo')::date, 'outros', v_s, 'Indicação: ' || (select nome || ' (' || codigo || ')' from credito.indicadores where id = v_id), 'indicacao');
    end if;
  end if;
  return json_build_object(
    'indicadores', coalesce((select json_agg(json_build_object('id', i.id, 'nome', i.nome, 'cpf', i.cpf, 'pix', i.pix, 'telefone', i.telefone, 'codigo', i.codigo,
        'link', credito.ind_link(i.codigo), 'criado', i.criado_em,
        'indicacoes', (select count(*) from credito.indicacoes x where x.indicador_id = i.id),
        'fechadas', (select count(*) from credito.indicacoes x where x.indicador_id = i.id and x.status = 'creditada'),
        'ganho', (select coalesce(sum(valor), 0) from credito.indicacoes x where x.indicador_id = i.id and x.status = 'creditada'),
        'saldo', credito.ind_saldo(i.id)) order by credito.ind_saldo(i.id) desc, i.criado_em desc) from credito.indicadores i), '[]'::json),
    'indicacoes', coalesce((select json_agg(json_build_object('id', x.id, 'indicador', i.nome, 'codigo', i.codigo, 'nome', coalesce(l.nome, x.nome),
        'telefone', coalesce(l.telefone, x.telefone), 'origem', x.origem, 'status', x.status, 'valor', x.valor, 'criado', x.criado_em,
        'situacao', case when l.id is not null then credito.situacao_lead(l)->>'t' end) order by x.criado_em desc)
      from credito.indicacoes x join credito.indicadores i on i.id = x.indicador_id left join credito.leads l on l.id = x.lead_id), '[]'::json),
    'pago_mes', (select coalesce(sum(valor), 0) from credito.indicacao_pagamentos where pago_em >= date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'),
    'config', credito.config('indicacao'));
end $f$;

-- Também aplicado em 11/11:
--  * acao_agente: 'cadastrar_indicador' (tipo=nome, numero=CPF, chave=PIX) e 'indicar_amigo' (tipo=nome, numero=telefone);
--  * receber_wpp_v2: chama credito.ind_detectar(lead, texto) em toda mensagem de cliente (código no texto = indicação);
--  * contexto_agente: mostra se o cliente é indicador (código, link, saldo) e se veio por indicação;
--  * regras_gerais: "PROGRAMA DE INDICAÇÃO" (quando oferecer, o que pedir, ferramentas);
--  * n8n "GM Cred · Agente": ferramentas cadastrar_indicador e indicar_amigo; "Estado do Painel": POST /escritorio/indicacoes.
--  * CORREÇÃO: gatilhos de contratos escutavam "update of etapa", mas a etapa é calculada por um gatilho BEFORE a partir
--    do status da V8 -> não disparavam. Agora: after insert or update (trg_ind_credito e trg_avisos_contrato).
create or replace trigger trg_ind_credito after insert or update on credito.contratos for each row execute function credito.fn_ind_credito();
create or replace trigger trg_avisos_contrato after insert or update on credito.contratos for each row execute function credito.fn_avisos_contrato();
