-- Empresa virtual CLT — comissão (V8 · CLT Acelera · Venda Digital) e meta diária
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-09. Idempotente.
-- Comissão = valor liberado ao cliente × % da tabela (com/sem seguro × nº de parcelas).

create table if not exists credito.tabelas_comissao (
  id serial primary key, banco text not null default 'v8digital', tabela text not null,
  com_seguro boolean not null, parcelas int not null, percentual numeric(6,3) not null,
  ativo boolean not null default true, unique (banco, com_seguro, parcelas));
insert into credito.tabelas_comissao (tabela, com_seguro, parcelas, percentual)
select 'CLT ACELERA - COM SEGURO - VD', true, p, case when p in (46,48) then 9.50 when p in (24,36,38) then 7.00 when p=18 then 4.50 when p=12 then 4.01 else 3.01 end
from unnest(array[3,4,5,6,7,8,9,10,11,12,18,24,36,38,46,48]) p
on conflict (banco, com_seguro, parcelas) do update set percentual=excluded.percentual, tabela=excluded.tabela;
insert into credito.tabelas_comissao (tabela, com_seguro, parcelas, percentual)
select 'CLT ACELERA - SEM SEGURO - VD', false, p, case when p in (24,36,38,46,48) then 3.01 when p in (12,18) then 2.01 else 1.01 end
from unnest(array[3,4,5,6,7,8,9,10,11,12,18,24,36,38,46,48]) p
on conflict (banco, com_seguro, parcelas) do update set percentual=excluded.percentual, tabela=excluded.tabela;

create table if not exists credito.metas (chave text primary key, valor numeric not null, descricao text);
insert into credito.metas values
 ('contratos_dia', 2, 'Mínimo de contratos digitados por dia'),
 ('valor_contrato', 2500, 'Valor liberado ao cliente por contrato (R$)'),
 ('valor_dia', 5000, 'Valor liberado total por dia (R$)')
on conflict (chave) do update set valor=excluded.valor, descricao=excluded.descricao;

alter table credito.leads add column if not exists consult_id text;
create index if not exists leads_consult_idx on credito.leads (consult_id);

alter table credito.contratos
  add column if not exists operation_id text, add column if not exists consult_id text,
  add column if not exists tabela text, add column if not exists com_seguro boolean,
  add column if not exists parcelas int, add column if not exists valor_liberado numeric,
  add column if not exists valor_parcela numeric, add column if not exists percentual_comissao numeric(6,3),
  add column if not exists status_v8 text, add column if not exists etapa text,
  add column if not exists dt_formalizacao timestamptz;
create unique index if not exists contratos_operation_uidx on credito.contratos (operation_id) where operation_id is not null;

-- status da operação V8 -> etapa do painel
create or replace function credito.etapa_contrato(st text) returns text language sql immutable as $$
  select case lower(coalesce(st,''))
    when 'generating_ccb' then 'aguardando_formalizacao' when 'formalization' then 'aguardando_formalizacao'
    when 'analysis' then 'formalizado' when 'manual_analysis' then 'formalizado' when 'awaiting_call' then 'formalizado'
    when 'processing' then 'formalizado' when 'pending' then 'formalizado'
    when 'paid' then 'pago'
    when 'canceled' then 'cancelado' when 'awaiting_cancel' then 'cancelado' when 'refunded' then 'cancelado' when 'rejected' then 'cancelado'
    else 'aguardando_formalizacao' end $$;

create or replace function credito.fn_contratos_calc() returns trigger language plpgsql as $$
declare v_pct numeric; v_nome text;
begin
  new.etapa := credito.etapa_contrato(new.status_v8);
  if new.percentual_comissao is null and new.parcelas is not null and new.com_seguro is not null then
    select percentual into v_pct from credito.tabelas_comissao
     where ativo and banco=coalesce(new.banco,'v8digital') and com_seguro=new.com_seguro and parcelas=new.parcelas;
    new.percentual_comissao := v_pct;
  end if;
  if new.valor_liberado is not null and new.percentual_comissao is not null then
    new.comissao := round(new.valor_liberado * new.percentual_comissao / 100, 2);
  end if;
  if tg_op='UPDATE' then
    new.atualizado_em := now();
    if new.etapa='formalizado' and old.etapa='aguardando_formalizacao' and new.dt_formalizacao is null then new.dt_formalizacao := now(); end if;
    if new.etapa='pago' and old.etapa is distinct from 'pago' and new.dt_pagamento is null then new.dt_pagamento := now(); end if;
    if new.etapa is distinct from old.etapa then
      select nome into v_nome from credito.leads where id=new.lead_id;
      insert into credito.eventos (lead_id, tipo, descricao, dados)
      values (new.lead_id, 'contrato_'||new.etapa,
        coalesce(v_nome,'Cliente')||': contrato '||replace(new.etapa,'_',' ')||' (R$ '||to_char(coalesce(new.valor_liberado,0),'FM999G999G990D00')||' · comissão R$ '||to_char(coalesce(new.comissao,0),'FM999G999G990D00')||')',
        jsonb_build_object('de',old.etapa,'para',new.etapa,'operation_id',new.operation_id));
    end if;
  end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname='trg_contratos_calc') then
    create trigger trg_contratos_calc before insert or update on credito.contratos for each row execute function credito.fn_contratos_calc();
  end if;
end $$;

-- aguardando formalização / formalizado (em aberto) e pago (mês atual)
create or replace view credito.v_comissao_etapas as
 with d as (select (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo') as hoje,
                   (date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo') as mes)
 select e.etapa, e.ordem,
   count(c.id) filter (where e.etapa<>'pago' or c.dt_pagamento >= d.mes) as contratos,
   coalesce(sum(c.valor_liberado) filter (where e.etapa<>'pago' or c.dt_pagamento >= d.mes),0) as valor_liberado,
   coalesce(sum(c.comissao) filter (where e.etapa<>'pago' or c.dt_pagamento >= d.mes),0) as comissao,
   count(c.id) filter (where c.dt_pagamento >= d.hoje) as contratos_hoje,
   coalesce(sum(c.comissao) filter (where c.dt_pagamento >= d.hoje),0) as comissao_hoje
 from (values ('aguardando_formalizacao',1),('formalizado',2),('pago',3)) e(etapa,ordem)
 cross join d left join credito.contratos c on c.etapa=e.etapa
 group by e.etapa, e.ordem order by e.ordem;

-- meta: contratos digitados hoje (não cancelados)
create or replace view credito.v_meta_hoje as
 with d as (select (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo') as hoje),
 c as (select * from credito.contratos, d where criado_em >= d.hoje and etapa <> 'cancelado')
 select (select valor from credito.metas where chave='contratos_dia')::int as meta_contratos,
   (select valor from credito.metas where chave='valor_dia') as meta_valor,
   (select valor from credito.metas where chave='valor_contrato') as meta_valor_contrato,
   (select count(*) from c)::int as contratos_hoje,
   (select coalesce(sum(valor_liberado),0) from c) as valor_hoje,
   (select coalesce(sum(comissao),0) from c) as comissao_hoje;
