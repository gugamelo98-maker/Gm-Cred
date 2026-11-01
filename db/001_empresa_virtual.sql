-- Empresa virtual CLT & FGTS — estrutura base (Fase 1)
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-01.
-- Idempotente: pode ser rodado de novo sem duplicar nada.

-- 1. SETORES (as salas do escritório)
create table if not exists credito.setores (
  id text primary key, nome text not null, descricao text, cor text not null,
  ordem int not null, sla_minutos int, ativo boolean not null default true
);
insert into credito.setores (id,nome,descricao,cor,ordem,sla_minutos) values
 ('recepcao','Recepção','Recebe o cliente, entende o interesse e pede o CPF','#ff6644',1,30),
 ('simulacao','Simulação','Consulta V8 Digital e Hub Crédito e monta a melhor oferta','#ffcc00',2,15),
 ('vendas','Vendas','Apresenta a oferta, contorna objeções e decide CLT ou FGTS','#00ccff',3,120),
 ('formalizacao','Formalização','Envia o link de assinatura e cobra quem não assinou','#44ff88',4,1440),
 ('posvenda','Pós-venda','Confirma liberação, oferece FGTS (upsell) e pede indicação','#cc44ff',5,4320),
 ('gerente','Gerente','Supervisiona todos os setores e resgata clientes parados','#aaaaaa',6,null)
on conflict (id) do update set nome=excluded.nome, descricao=excluded.descricao, cor=excluded.cor, ordem=excluded.ordem, sla_minutos=excluded.sla_minutos;

-- 2. NÚMEROS (portas de entrada do WhatsApp; todos os agentes atendem em todos)
create table if not exists credito.numeros (
  id serial primary key, instance_name text not null unique, telefone text, apelido text,
  ativo boolean not null default true,
  status_conexao text not null default 'desconhecido' check (status_conexao in ('conectado','desconectado','bloqueado','desconhecido')),
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);

-- 3. AGENTES = agentes de IA, um por setor
alter table credito.agentes alter column telefone drop not null;
alter table credito.agentes alter column instance_key drop not null;
alter table credito.agentes
  add column if not exists setor_id text references credito.setores(id),
  add column if not exists papel text,
  add column if not exists avatar jsonb not null default '{}'::jsonb,
  add column if not exists status text not null default 'livre',
  add column if not exists modelo text,
  add column if not exists prompt text,
  add column if not exists lead_atual_id int,
  add column if not exists ultima_atividade timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='agentes_status_check' and connamespace='credito'::regnamespace) then
    alter table credito.agentes add constraint agentes_status_check check (status in ('livre','trabalhando','pausado'));
  end if;
  if not exists (select 1 from pg_constraint where conname='agentes_setor_nome_key' and connamespace='credito'::regnamespace) then
    alter table credito.agentes add constraint agentes_setor_nome_key unique (setor_id, nome);
  end if;
end $$;
insert into credito.agentes (nome,setor_id,papel,avatar) values
 ('Ana','recepcao','Recepcionista','{"pele":"#f1c27d","cabelo":"#3b2219"}'),
 ('Bruno','simulacao','Analista de crédito','{"pele":"#e0ac69","cabelo":"#1a1a1a"}'),
 ('Carla','vendas','Consultora de vendas','{"pele":"#c68642","cabelo":"#5a3825"}'),
 ('Diego','formalizacao','Especialista em contratos','{"pele":"#8d5524","cabelo":"#0d0d0d"}'),
 ('Elisa','posvenda','Relacionamento','{"pele":"#ffdbac","cabelo":"#b55239"}'),
 ('Fernando','gerente','Gerente geral','{"pele":"#e0ac69","cabelo":"#777777"}')
on conflict (setor_id,nome) do nothing;

-- 4. LEADS: setor atual, número de entrada e tempos
alter table credito.leads
  add column if not exists setor_id text not null default 'recepcao' references credito.setores(id),
  add column if not exists numero_id int references credito.numeros(id),
  add column if not exists nome text,
  add column if not exists telefone text,
  add column if not exists valor numeric,
  add column if not exists comissao numeric,
  add column if not exists aguardando text not null default 'agente',
  add column if not exists ultima_interacao timestamptz not null default now(),
  add column if not exists entrou_setor_em timestamptz not null default now(),
  add column if not exists observacoes text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='leads_aguardando_check' and connamespace='credito'::regnamespace) then
    alter table credito.leads add constraint leads_aguardando_check check (aguardando in ('agente','cliente','humano'));
  end if;
end $$;
create index if not exists leads_setor_idx on credito.leads (setor_id) where status <> 'parou';
create index if not exists leads_telefone_idx on credito.leads (telefone);
create index if not exists leads_ultima_interacao_idx on credito.leads (ultima_interacao);

-- 5. CONVERSAS: por qual número e em qual setor
alter table credito.conversas
  add column if not exists numero_id int references credito.numeros(id),
  add column if not exists setor_id text references credito.setores(id);
create index if not exists conversas_lead_idx on credito.conversas (lead_id, criado_em);

-- 6. EVENTOS (feed ao vivo do painel)
create table if not exists credito.eventos (
  id bigserial primary key,
  lead_id int references credito.leads(id) on delete cascade,
  agente_id int references credito.agentes(id),
  setor_origem text references credito.setores(id),
  setor_destino text references credito.setores(id),
  tipo text not null, descricao text,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists eventos_criado_idx on credito.eventos (criado_em desc);
create index if not exists eventos_lead_idx on credito.eventos (lead_id);

-- 7. GATILHOS: gera evento sozinho quando o cliente entra, muda de setor ou de status
create or replace function credito.fn_leads_eventos() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into credito.eventos (lead_id, agente_id, setor_destino, tipo, descricao)
    values (new.id, new.agente_id, new.setor_id, 'entrou', coalesce(new.nome,'Cliente')||' entrou na '||(select nome from credito.setores where id=new.setor_id));
    return new;
  end if;
  new.atualizado_em := now();
  if new.setor_id is distinct from old.setor_id then
    new.entrou_setor_em := now();
    insert into credito.eventos (lead_id, agente_id, setor_origem, setor_destino, tipo, descricao)
    values (new.id, new.agente_id, old.setor_id, new.setor_id, 'mudou_setor',
      coalesce(new.nome,'Cliente')||' foi de '||(select nome from credito.setores where id=old.setor_id)||' para '||(select nome from credito.setores where id=new.setor_id));
  end if;
  if new.status is distinct from old.status then
    insert into credito.eventos (lead_id, agente_id, setor_origem, setor_destino, tipo, descricao, dados)
    values (new.id, new.agente_id, new.setor_id, new.setor_id,
      case new.status when 'assinou' then 'fechou' when 'parou' then 'perdeu' else 'status' end,
      coalesce(new.nome,'Cliente')||': '||old.status||' → '||new.status
        ||case when new.status='assinou' and new.valor is not null then ' (R$ '||to_char(new.valor,'FM999G999G990D00')||')' else '' end,
      jsonb_build_object('de',old.status,'para',new.status,'motivo',new.motivo_parada));
  end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname='trg_leads_eventos_ins') then
    create trigger trg_leads_eventos_ins after insert on credito.leads for each row execute function credito.fn_leads_eventos();
  end if;
  if not exists (select 1 from pg_trigger where tgname='trg_leads_eventos_upd') then
    create trigger trg_leads_eventos_upd before update on credito.leads for each row execute function credito.fn_leads_eventos();
  end if;
end $$;

-- 8. VISÕES do painel
create or replace view credito.v_funil as
 select status, count(*) as total,
   count(*) filter (where produto='clt') as clt,
   count(*) filter (where produto='fgts') as fgts,
   count(*) filter (where produto='ambos') as ambos
 from credito.leads where status <> 'parou' group by status;

create or replace view credito.v_agentes_metricas as
 select a.id, a.nome, a.telefone, a.ativo,
   count(l.id) as total_leads,
   count(l.id) filter (where l.status='assinou') as fechados,
   count(l.id) filter (where l.status='parou') as perdidos,
   count(l.id) filter (where l.status <> all (array['assinou','parou'])) as em_andamento,
   coalesce(sum(c.comissao),0::numeric) as receita_total,
   a.setor_id, a.status, a.papel, a.avatar, a.ultima_atividade
 from credito.agentes a
 left join credito.leads l on l.agente_id=a.id
 left join credito.contratos c on c.lead_id=l.id and c.status in ('assinado','pago')
 group by a.id;

-- clientes que estão num setor há mais tempo que o prazo dele
create or replace view credito.v_leads_parados as
 select l.id, l.nome, l.telefone, l.setor_id, s.nome as setor, l.status, l.aguardando,
   l.entrou_setor_em, l.ultima_interacao, s.sla_minutos,
   round(extract(epoch from now()-l.entrou_setor_em)/60)::int as minutos_no_setor
 from credito.leads l join credito.setores s on s.id=l.setor_id
 where l.status <> 'parou' and s.sla_minutos is not null
   and now()-l.entrou_setor_em > make_interval(mins => s.sla_minutos);

create or replace view credito.v_setores_painel as
 select s.id, s.nome, s.descricao, s.cor, s.ordem, s.sla_minutos,
   (select count(*) from credito.leads l where l.setor_id=s.id and l.status<>'parou') as leads_ativos,
   (select count(*) from credito.v_leads_parados p where p.setor_id=s.id) as leads_parados,
   (select count(*) from credito.agentes a where a.setor_id=s.id and a.ativo) as agentes,
   (select count(*) from credito.agentes a where a.setor_id=s.id and a.ativo and a.status='trabalhando') as agentes_trabalhando
 from credito.setores s where s.ativo order by s.ordem;

create or replace view credito.v_resumo_hoje as
 with d as (select (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo') as ini)
 select
  (select count(*) from credito.leads, d where criado_em >= d.ini) as entraram_hoje,
  (select count(*) from credito.leads where status not in ('parou','assinou')) as em_andamento,
  (select count(*) from credito.leads, d where dt_assinou >= d.ini) as fecharam_hoje,
  (select coalesce(sum(comissao),0) from credito.leads, d where dt_assinou >= d.ini) as comissao_hoje,
  (select coalesce(sum(valor),0) from credito.leads, d where dt_assinou >= d.ini) as volume_hoje,
  (select count(*) from credito.v_leads_parados) as parados,
  (select count(*) from credito.leads, d where status='parou' and atualizado_em >= d.ini) as perdidos_hoje;
