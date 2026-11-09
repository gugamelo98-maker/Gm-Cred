-- Empresa virtual CLT — "precisa da sua atenção", ficha do cliente, funil, saúde do sistema e chave de acesso
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-09. Idempotente.

-- 1. CHAVE DE ACESSO DO PAINEL (guarda só o hash SHA-256; a chave em si não fica no banco)
create table if not exists credito.acessos (
  id serial primary key, nome text not null, chave_hash text not null unique,
  ativo boolean not null default true, criado_em timestamptz not null default now(), ultimo_uso timestamptz);

create or replace function credito.validar_chave(k text) returns boolean language plpgsql as $$
declare v_id int;
begin
  if k is null or length(k) < 8 then return false; end if;
  update credito.acessos set ultimo_uso = now()
   where ativo and chave_hash = encode(sha256(convert_to(k,'UTF8')),'hex') returning id into v_id;
  return v_id is not null;
end $$;

-- 2. ALERTAS (os agentes registram aqui o que precisa de um humano)
create table if not exists credito.alertas (
  id bigserial primary key,
  tipo text not null,                      -- ex.: cancelamento, pendencia, v8_erro, pedido_humano
  prioridade int not null default 2,       -- 1 = urgente, 2 = normal, 3 = baixa
  lead_id int references credito.leads(id) on delete cascade,
  contrato_id int references credito.contratos(id) on delete set null,
  titulo text not null, detalhe text,
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz, resolvido_por text);
create index if not exists alertas_abertos_idx on credito.alertas (criado_em desc) where resolvido_em is null;

-- 3. SAÚDE DOS SERVIÇOS (as ferramentas dos agentes atualizam a linha "v8" a cada chamada)
create table if not exists credito.saude_servicos (
  servico text primary key, ok boolean, detalhe text, verificado_em timestamptz);
insert into credito.saude_servicos (servico, ok, detalhe) values ('v8', null, 'Sem chamadas ainda')
on conflict (servico) do nothing;

-- 4. "PRECISA DA SUA ATENÇÃO"
create or replace view credito.v_atencao as
 select 'alerta-'||a.id as chave, a.tipo, a.prioridade, a.titulo, a.detalhe, a.lead_id, a.id as alerta_id, l.nome as cliente, a.criado_em as desde
   from credito.alertas a left join credito.leads l on l.id=a.lead_id where a.resolvido_em is null
 union all
 select 'humano-'||l.id, 'humano', 1, 'Cliente aguardando atendimento humano', 'Setor: '||s.nome, l.id, null, l.nome, l.ultima_interacao
   from credito.leads l join credito.setores s on s.id=l.setor_id where l.aguardando='humano' and l.status<>'parou'
 union all
 select 'pendencia-'||c.id, 'pendencia', 1, 'Pendência na proposta V8', coalesce(c.tabela,'')||' · '||coalesce(c.parcelas::text,'?')||'x', c.lead_id, null, l.nome, c.atualizado_em
   from credito.contratos c left join credito.leads l on l.id=c.lead_id where lower(coalesce(c.status_v8,''))='pending'
 union all
 select 'numero-'||n.id, 'numero', 1, 'Número de WhatsApp '||n.status_conexao, coalesce(n.apelido,n.instance_name), null, null, null, n.atualizado_em
   from credito.numeros n where n.ativo and n.status_conexao in ('desconectado','bloqueado')
 union all
 select 'travado-'||p.id, 'travado', 2, 'Cliente travado há '||p.minutos_no_setor||' min', 'Setor: '||p.setor||' (prazo '||p.sla_minutos||' min)', p.id, null, p.nome, p.entrou_setor_em
   from credito.v_leads_parados p where p.minutos_no_setor >= p.sla_minutos*2 and p.aguardando<>'humano';

-- 5. FUNIL DOS ÚLTIMOS 30 DIAS (os agentes preenchem consult_id e dt_simulou / dt_proposta / dt_assinou)
create or replace view credito.v_funil_30d as
 with l as (select * from credito.leads where criado_em >= now() - interval '30 days')
 select
  (select count(*) from l) as entraram,
  (select count(*) from l where consult_id is not null) as enviaram_cpf,
  (select count(*) from l where dt_simulou is not null) as com_margem,
  (select count(*) from l where dt_proposta is not null) as receberam_proposta,
  (select count(*) from l where dt_assinou is not null) as assinaram,
  (select count(distinct c.lead_id) from credito.contratos c join l on l.id=c.lead_id where c.etapa='pago') as pagos,
  coalesce((select json_agg(m order by m.total desc) from (
     select coalesce(nullif(trim(motivo_parada),''),'Sem motivo informado') as motivo, count(*) as total
       from l where status='parou' group by 1 order by 2 desc limit 5) m), '[]'::json) as motivos_perda,
  (select count(*) from l where status='parou') as perdidos;

-- 6. ESTADO COMPLETO DO PAINEL (retorna NULL se a chave for inválida)
create or replace function credito.estado_painel(k text) returns json language plpgsql as $$
begin
  if not credito.validar_chave(k) then return null; end if;
  return json_build_object(
  'gerado_em', now(),
  'resumo', (select row_to_json(r) from credito.v_resumo_hoje r),
  'setores', coalesce((select json_agg(s order by s.ordem) from credito.v_setores_painel s), '[]'::json),
  'agentes', coalesce((select json_agg(json_build_object('id',a.id,'nome',a.nome,'setor_id',a.setor_id,'papel',a.papel,'status',a.status,'avatar',a.avatar,'lead_atual_id',a.lead_atual_id,'ultima_atividade',a.ultima_atividade,'fechados',m.fechados,'em_andamento',m.em_andamento,'receita_total',m.receita_total) order by a.id) from credito.agentes a join credito.v_agentes_metricas m on m.id=a.id where a.ativo), '[]'::json),
  'leads', coalesce((select json_agg(json_build_object('id',l.id,'nome',l.nome,'telefone',l.telefone,'setor_id',l.setor_id,'status',l.status,'produto',l.produto,'banco',l.banco_escolhido,'valor',l.valor,'comissao',l.comissao,'agente_id',l.agente_id,'numero_id',l.numero_id,'aguardando',l.aguardando,'entrou_setor_em',l.entrou_setor_em,'ultima_interacao',l.ultima_interacao,'parado',exists(select 1 from credito.v_leads_parados p where p.id=l.id)) order by l.ultima_interacao desc) from (select * from credito.leads where status <> 'parou' order by ultima_interacao desc limit 300) l), '[]'::json),
  'eventos', coalesce((select json_agg(e order by e.criado_em desc) from (select id, lead_id, agente_id, setor_origem, setor_destino, tipo, descricao, criado_em from credito.eventos order by criado_em desc limit 40) e), '[]'::json),
  'numeros', coalesce((select json_agg(json_build_object('id',n.id,'apelido',n.apelido,'telefone',n.telefone,'status_conexao',n.status_conexao,'ativo',n.ativo,'leads_ativos',(select count(*) from credito.leads l where l.numero_id=n.id and l.status<>'parou'))) from credito.numeros n), '[]'::json),
  'financeiro', coalesce((select json_agg(f order by f.ordem) from credito.v_comissao_etapas f), '[]'::json),
  'meta', (select row_to_json(m) from credito.v_meta_hoje m),
  'contratos', coalesce((select json_agg(json_build_object('id',c.id,'lead_id',c.lead_id,'nome',l.nome,'etapa',c.etapa,'status_v8',c.status_v8,'tabela',c.tabela,'com_seguro',c.com_seguro,'parcelas',c.parcelas,'valor_liberado',c.valor_liberado,'valor_parcela',c.valor_parcela,'percentual',c.percentual_comissao,'comissao',c.comissao,'criado_em',c.criado_em,'dt_pagamento',c.dt_pagamento) order by c.criado_em desc) from (select * from credito.contratos where etapa in ('aguardando_formalizacao','formalizado') or (etapa='pago' and dt_pagamento >= date_trunc('month', now())) order by criado_em desc limit 200) c left join credito.leads l on l.id=c.lead_id), '[]'::json),
  'atencao', coalesce((select json_agg(a order by a.prioridade, a.desde) from (select * from credito.v_atencao limit 100) a), '[]'::json),
  'funil', (select row_to_json(f) from credito.v_funil_30d f),
  'saude', json_build_object(
     'v8', (select json_build_object('ok',ok,'detalhe',detalhe,'verificado_em',verificado_em) from credito.saude_servicos where servico='v8'),
     'whatsapp', (select json_build_object(
          'total', count(*),
          'conectados', count(*) filter (where i."connectionStatus"='open'),
          'ok', case when count(*)=0 then null else bool_and(i."connectionStatus"='open') end,
          'detalhe', case when count(*)=0 then 'Nenhum número cadastrado' else count(*) filter (where i."connectionStatus"='open')||' de '||count(*)||' conectados' end)
        from credito.numeros n left join public."Instance" i on i.name=n.instance_name where n.ativo),
     'n8n', (select json_build_object('ok', count(*)=0, 'erros_1h', count(*), 'detalhe', case when count(*)=0 then 'Sem erros na última hora' else count(*)||' erro(s) na última hora' end)
        from rarelookingorca.execution_entity where status='error' and "startedAt" > now() - interval '1 hour'))
  );
end $$;

-- 7. FICHA DO CLIENTE (conversa, linha do tempo, contratos e simulações)
create or replace function credito.ficha_cliente(k text, p_lead int) returns json language plpgsql as $$
begin
  if not credito.validar_chave(k) then return null; end if;
  return (select json_build_object(
    'lead', (select row_to_json(x) from (select l.id, l.nome, l.telefone, l.cpf_informado as cpf, l.setor_id, s.nome as setor, l.status, l.produto, l.valor, l.comissao, l.aguardando,
               l.consult_id, l.motivo_parada, l.observacoes, l.criado_em, l.entrou_setor_em, l.ultima_interacao, n.apelido as numero
             from credito.leads l join credito.setores s on s.id=l.setor_id left join credito.numeros n on n.id=l.numero_id where l.id=p_lead) x),
    'conversa', coalesce((select json_agg(c order by c.criado_em) from (select direcao, conteudo, tipo, setor_id, criado_em from credito.conversas where lead_id=p_lead order by criado_em desc limit 150) c), '[]'::json),
    'eventos', coalesce((select json_agg(e order by e.criado_em) from (select tipo, descricao, setor_origem, setor_destino, criado_em from credito.eventos where lead_id=p_lead order by criado_em desc limit 100) e), '[]'::json),
    'contratos', coalesce((select json_agg(json_build_object('id',c.id,'etapa',c.etapa,'status_v8',c.status_v8,'tabela',c.tabela,'com_seguro',c.com_seguro,'parcelas',c.parcelas,'valor_liberado',c.valor_liberado,'valor_parcela',c.valor_parcela,'percentual',c.percentual_comissao,'comissao',c.comissao,'link',c.link_assinatura,'criado_em',c.criado_em) order by c.criado_em desc) from credito.contratos c where c.lead_id=p_lead), '[]'::json),
    'simulacoes', coalesce((select json_agg(s order by s.criado_em desc) from (select banco, produto, valor_liberado, parcela, prazo_meses, taxa_mensal, comissao, criado_em from credito.simulacoes where lead_id=p_lead order by criado_em desc limit 5) s), '[]'::json),
    'alertas', coalesce((select json_agg(a order by a.criado_em desc) from (select id, tipo, titulo, detalhe, criado_em, resolvido_em from credito.alertas where lead_id=p_lead order by criado_em desc limit 20) a), '[]'::json)
  ));
end $$;

-- 8. AÇÕES DO PAINEL: assumir / devolver atendimento e resolver alerta
create or replace function credito.executar_acao(k text, p_tipo text, p_lead int, p_alerta bigint) returns json language plpgsql as $$
declare v_nome text;
begin
  if not credito.validar_chave(k) then return json_build_object('ok',false,'erro','chave_invalida'); end if;
  if p_tipo = 'assumir' then
    update credito.leads set aguardando='humano', ultima_interacao=now() where id=p_lead returning nome into v_nome;
    if not found then return json_build_object('ok',false,'erro','cliente_nao_encontrado'); end if;
    insert into credito.eventos (lead_id, tipo, descricao) values (p_lead, 'humano_assumiu', coalesce(v_nome,'Cliente')||': atendimento assumido por um humano (agente pausado)');
    return json_build_object('ok',true);
  elsif p_tipo = 'devolver' then
    update credito.leads set aguardando='agente', ultima_interacao=now() where id=p_lead returning nome into v_nome;
    if not found then return json_build_object('ok',false,'erro','cliente_nao_encontrado'); end if;
    insert into credito.eventos (lead_id, tipo, descricao) values (p_lead, 'humano_devolveu', coalesce(v_nome,'Cliente')||': atendimento devolvido ao agente');
    return json_build_object('ok',true);
  elsif p_tipo = 'resolver' then
    update credito.alertas set resolvido_em=now(), resolvido_por='painel' where id=p_alerta and resolvido_em is null;
    if not found then return json_build_object('ok',false,'erro','alerta_nao_encontrado'); end if;
    return json_build_object('ok',true);
  end if;
  return json_build_object('ok',false,'erro','acao_desconhecida');
end $$;

-- 9. ABA SIMULAÇÃO: dados para previsão (taxas, valores médios, mês corrente) — painel chama estado_painel_v2
create or replace function credito.simulacao_dados() returns json language sql stable as $$
 with sp as (select (now() at time zone 'America/Sao_Paulo') as agora),
 mes as (select (date_trunc('month', agora) at time zone 'America/Sao_Paulo') as ini, agora from sp),
 l30 as (select * from credito.leads where criado_em >= now() - interval '30 days'),
 c30 as (select * from credito.contratos where criado_em >= now() - interval '30 days' and coalesce(etapa,'') <> 'cancelado')
 select json_build_object(
  'dias_janela', coalesce((select greatest(1, least(30, ceil(extract(epoch from now() - min(criado_em))/86400.0)))::int from l30), 0),
  'clientes', (select count(*) from l30),
  'contratos', (select count(*) from c30),
  'pagos', (select count(*) from c30 where etapa='pago'),
  'formalizados_ou_pagos', (select count(*) from c30 where etapa in ('formalizado','pago')),
  'valor_medio', (select round(avg(valor_liberado),2) from c30 where valor_liberado is not null),
  'pct_seguro', (select round(avg(case when com_seguro then 1.0 else 0 end),4) from c30 where com_seguro is not null),
  'parcelas_media', (select round(avg(parcelas)) from c30 where parcelas is not null),
  'comissao_media', (select round(avg(comissao),2) from c30 where comissao is not null),
  'pago_mes_valor', (select coalesce(sum(valor_liberado),0) from credito.contratos, mes where etapa='pago' and dt_pagamento >= mes.ini),
  'pago_mes_comissao', (select coalesce(sum(comissao),0) from credito.contratos, mes where etapa='pago' and dt_pagamento >= mes.ini),
  'dias_mes', (select extract(day from (date_trunc('month', agora) + interval '1 month - 1 day'))::int from sp),
  'dia_atual', (select extract(day from agora)::int from sp),
  'meta_dia', (select valor from credito.metas where chave='valor_dia')
 )
$$;

create or replace function credito.estado_painel_v2(k text) returns json language plpgsql as $$
declare e json;
begin
  e := credito.estado_painel(k);
  if e is null then return null; end if;
  return (e::jsonb || jsonb_build_object('simulacao', credito.simulacao_dados()::jsonb))::json;
end $$;
