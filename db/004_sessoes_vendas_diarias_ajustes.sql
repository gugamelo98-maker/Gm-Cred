-- Empresa virtual CLT — sessões de acesso, vendas por dia e ajustes de textos/cores
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-09. Idempotente.

-- 1. SESSÕES: a chave mestra só é enviada no login; o painel passa a usar um token de sessão.
--    Assim a chave não fica gravada no histórico de execuções do n8n a cada consulta.
create table if not exists credito.sessoes (
  id bigserial primary key,
  acesso_id int not null references credito.acessos(id) on delete cascade,
  token_hash text not null unique,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  ultimo_uso timestamptz);

create or replace function credito.login_painel(k text) returns json language plpgsql as $$
declare v_id int; v_token text;
begin
  if k is null or length(k) < 8 then return null; end if;
  select id into v_id from credito.acessos where ativo and chave_hash = encode(sha256(convert_to(k,'UTF8')),'hex');
  if v_id is null then return null; end if;
  update credito.acessos set ultimo_uso = now() where id = v_id;
  delete from credito.sessoes where expira_em < now();
  v_token := 'ses-' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into credito.sessoes (acesso_id, token_hash, expira_em)
  values (v_id, encode(sha256(convert_to(v_token,'UTF8')),'hex'), now() + interval '7 days');
  return json_build_object('token', v_token, 'expira_em', now() + interval '7 days');
end $$;

-- validar_chave passa a aceitar só tokens de sessão (renovados por 7 dias a cada uso)
create or replace function credito.validar_chave(k text) returns boolean language plpgsql as $$
declare v_id bigint;
begin
  if k is null or length(k) < 20 then return false; end if;
  update credito.sessoes s set ultimo_uso = now(), expira_em = now() + interval '7 days'
   from credito.acessos a
   where a.id = s.acesso_id and a.ativo and s.expira_em > now()
     and s.token_hash = encode(sha256(convert_to(k,'UTF8')),'hex')
   returning s.id into v_id;
  return v_id is not null;
end $$;

-- 2. TEXTOS, CORES E PRAZOS dos setores (paleta do painel claro; operação só V8 / CLT)
update credito.setores set cor='#f26b4d', descricao='Recebe o cliente, entende o interesse e pede o CPF' where id='recepcao';
update credito.setores set cor='#e0a100', descricao='Consulta a margem na V8 e monta a melhor oferta', sla_minutos=30 where id='simulacao';
update credito.setores set cor='#2f8fd8', descricao='Apresenta a oferta, ajusta prazo e parcela e contorna objeções' where id='vendas';
update credito.setores set cor='#16a36a', descricao='Coleta os dados, digita a proposta na V8 e cobra a assinatura' where id='formalizacao';
update credito.setores set cor='#8a5cd6', descricao='Acompanha o pagamento, resolve pendências e pede indicação' where id='posvenda';
update credito.setores set cor='#6b7787', descricao='Supervisiona todos os setores e resgata clientes parados' where id='gerente';

-- 3. VENDAS POR DIA (últimos 62 dias, fuso de São Paulo)
create or replace function credito.vendas_diarias() returns json language sql stable as $$
 with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
 dias as (select generate_series((select d from hoje) - 61, (select d from hoje), interval '1 day')::date as dia),
 l as (select (criado_em at time zone 'America/Sao_Paulo')::date as dia, count(*) as n from credito.leads group by 1),
 dg as (select (criado_em at time zone 'America/Sao_Paulo')::date as dia, count(*) as n from credito.contratos where coalesce(etapa,'')<>'cancelado' group by 1),
 pg as (select (dt_pagamento at time zone 'America/Sao_Paulo')::date as dia, count(*) as n, sum(valor_liberado) as v, sum(comissao) as c
          from credito.contratos where etapa='pago' and dt_pagamento is not null group by 1)
 select coalesce(json_agg(json_build_object(
          'dia', dias.dia, 'clientes', coalesce(l.n,0), 'digitados', coalesce(dg.n,0),
          'pagos', coalesce(pg.n,0), 'liberado', coalesce(pg.v,0), 'comissao', coalesce(pg.c,0)) order by dias.dia), '[]'::json)
 from dias left join l on l.dia=dias.dia left join dg on dg.dia=dias.dia left join pg on pg.dia=dias.dia
$$;

create or replace function credito.estado_painel_v2(k text) returns json language plpgsql as $$
declare e json;
begin
  e := credito.estado_painel(k);
  if e is null then return null; end if;
  return (e::jsonb || jsonb_build_object('simulacao', credito.simulacao_dados()::jsonb,
                                         'vendas', credito.vendas_diarias()::jsonb))::json;
end $$;
