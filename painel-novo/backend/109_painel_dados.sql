-- 109 · Dados reais do painel novo. Clientes/conversas/pipeline começam zerados (só leads criados a partir de
-- 'painel_novo_inicio'), mas funcionando; números, maturador, indicações e gastos são os mesmos do painel antigo.

alter table credito.leads add column if not exists painel_etapa text;
alter table credito.leads add column if not exists painel_responsavel bigint;
alter table credito.wpp_chips add column if not exists painel_dono bigint;
create table if not exists credito.painel_notas (
  id bigserial primary key, lead_id int not null, autor text, texto text not null, criado_em timestamptz not null default now());

insert into credito.configuracoes (chave, valor) values ('painel_novo_inicio', to_jsonb(now()))
on conflict (chave) do nothing;

create or replace function credito.painel_cliente(l credito.leads) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', l.id::text, 'nome', coalesce(nullif(l.nome, ''), 'Sem nome'), 'telefone', coalesce(l.telefone, ''),
    'cpf', nullif(coalesce(l.cpf_informado, l.cpf_base), ''),
    'produto', case when coalesce(l.produto, '') ilike '%fgts%' then 'FGTS' else 'CLT' end,
    'origem', case when l.disparo_id is not null or l.origem ilike 'disparo%' then 'disparo' when l.indicado_por is not null then 'indicacao'
                   when l.origem = 'leads_dia' then 'leads_dia' when l.origem ilike '%oficial%' or l.origem ilike '%traf%' then 'trafego' else 'organico' end,
    'origemRef', l.origem,
    'etapa', coalesce(l.painel_etapa, case when l.finalizado_em is not null then 'perdido' when l.dt_fechou is not null then 'posvenda'
                   when l.setor_id = 'formalizacao' then 'formalizacao' when l.setor_id = 'vendas' then 'vendas'
                   when l.dt_simulou is not null then 'simulacao' else 'recepcao' end),
    'situacao', credito.situacao_lead(l)->>'t', 'etiqueta', l.etiqueta, 'margem', l.margem,
    'banco', case when l.banco_escolhido ilike '%unno%' then 'Unno' when l.banco_escolhido ilike '%hub%' then 'HUB' when l.banco_escolhido is not null then 'V8' end,
    'valorLiberado', l.valor, 'parcela', nullif(l.oferta->>'parcela', '')::numeric, 'prazo', nullif(l.oferta->>'prazo', '')::numeric::int, 'comissao', l.comissao,
    'atendente', case when l.aguardando = 'humano' then coalesce(l.painel_responsavel::text, 'humano') else 'ia' end,
    'responsavel', l.painel_responsavel::text, 'numeroId', coalesce(l.instancia, ''),
    'naoLidas', (select count(*) from credito.conversas e where e.lead_id = l.id and e.direcao = 'entrada' and e.criado_em > coalesce(l.lido_em, 'epoch')),
    'entrouEm', l.criado_em, 'cpfEm', case when coalesce(l.cpf_informado, '') <> '' then coalesce(l.dt_simulou, l.atualizado_em) end,
    'margemEm', case when coalesce(l.margem, 0) > 0 then coalesce(l.dt_simulou, l.atualizado_em) end,
    'propostaEm', l.dt_proposta, 'pagoEm', l.dt_fechou, 'ultimaMsgEm', coalesce(l.ultima_interacao, l.atualizado_em, l.criado_em), 'historico', '[]'::jsonb)
$$;

create or replace function credito.painel_dados_api(p_acao text, k text, p jsonb) returns jsonb language plpgsql as $$
declare u credito.painel_usuarios; ini timestamptz := coalesce((select (valor #>> '{}')::timestamptz from credito.configuracoes where chave = 'painel_novo_inicio'), now());
  l credito.leads; v_id int := nullif(p->>'id', '')::int;
begin
  p := coalesce(p, '{}');
  u := credito.painel_sessao(k);
  if u.id is null then return jsonb_build_object('ok', false, 'codigo', 401, 'erro', 'Sessão expirada. Entre de novo.'); end if;

  if p_acao = 'estado' then
    return jsonb_build_object('ok', true,
      'clientes', (select coalesce(jsonb_agg(credito.painel_cliente(x) order by coalesce(x.ultima_interacao, x.criado_em) desc), '[]')
                   from credito.leads x where x.criado_em >= ini and not coalesce(x.teste, false)
                     and (u.papel <> 'atendente' or u.escopo = 'todos' or x.painel_responsavel = u.id)),
      'numeros', (select coalesce(jsonb_agg(jsonb_build_object('id', n->>'nome', 'sessao', n->>'nome', 'telefone', coalesce(n->>'numero', ''), 'nomePerfil', coalesce(n->>'perfil', ''),
                     'funcao', coalesce(n->>'funcao', 'reserva'), 'estado', case n->>'estado' when 'open' then 'conectado' when 'close' then 'caiu' when 'refused' then 'caiu' else 'aguardando_qr' end,
                     'aparelho', coalesce(n->>'aparelho', ''), 'enviadasHoje', coalesce((n->>'enviadas_hoje')::int, 0), 'entreguesHoje', coalesce((n->>'entregues_hoje')::int, 0),
                     'falhasHoje', coalesce((n->>'falhas_hoje')::int, 0), 'maturar', coalesce((n->>'maturar')::boolean, false), 'travaAte', n->>'trava_ate', 'conectadoDesde', null,
                     'dono', (select c.painel_dono::text from credito.wpp_chips c where c.nome = n->>'nome'))), '[]')
                  from jsonb_array_elements(credito.wpp_numeros()::jsonb) n),
      'maturador', (select jsonb_build_object('ativo', coalesce((valor->>'ativo')::boolean, false), 'intervaloMin', coalesce((valor->>'intervalo_min')::int, 8),
                     'horaInicio', coalesce((valor->>'hora_inicio')::int, 8), 'horaFim', coalesce((valor->>'hora_fim')::int, 21),
                     'ultimas', (select coalesce(jsonb_agg(jsonb_build_object('em', coalesce(m.enviado_em, m.criado_em), 'de', m.de, 'para', m.para, 'texto', m.texto) order by m.id desc), '[]')
                                 from (select * from credito.maturador_msgs order by id desc limit 15) m))
                    from credito.configuracoes where chave = 'maturador'),
      'indicadores', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id::text, 'nome', i.nome, 'telefone', coalesce(i.telefone, ''), 'codigo', i.codigo, 'pix', coalesce(i.pix, ''),
                     'link', credito.ind_link(i.codigo),
                     'indicacoes', (select count(*) from credito.indicacoes x where x.indicador_id = i.id),
                     'fechadas', (select count(*) from credito.indicacoes x where x.indicador_id = i.id and x.status = 'creditada'),
                     'premio', (select coalesce(sum(valor), 0) from credito.indicacoes x where x.indicador_id = i.id and x.status = 'creditada'),
                     'pago', (select coalesce(sum(valor), 0) from credito.indicacao_pagamentos x where x.indicador_id = i.id)) order by i.criado_em desc), '[]')
                     from credito.indicadores i),
      'gastos', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id::text, 'data', g.data, 'descricao', coalesce(g.descricao, ''), 'valor', g.valor,
                     'categoria', case when g.categoria in ('disparos', 'numeros', 'trafego', 'bms', 'equipe', 'outros') then g.categoria else 'outros' end) order by g.data desc), '[]')
                 from credito.gastos g where g.data >= current_date - 120),
      'respostas', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id::text, 'atalho', lower(regexp_replace(coalesce(r.tema, 'r' || r.id), '\W+', '', 'g')), 'titulo', coalesce(r.pergunta, r.tema), 'texto', r.resposta) order by r.id), '[]')
                    from credito.respostas_prontas r where r.ativo));
  elsif p_acao = 'mensagens' then
    update credito.leads set lido_em = now() where id = v_id;
    return jsonb_build_object('ok', true, 'mensagens', (select coalesce(jsonb_agg(x order by x->>'em'), '[]') from (
      select jsonb_build_object('id', c.id::text, 'clienteId', c.lead_id::text, 'de', case when c.direcao = 'entrada' then 'cliente' when c.modo = 'humano' then 'humano' else 'ia' end,
        'autor', null, 'texto', coalesce(c.conteudo, ''), 'midia', null, 'em', c.criado_em,
        'status', case when c.direcao = 'entrada' then null when c.erro_wpp is not null then 'erro' when c.wpp_status in ('read', 'lida') then 'lida'
                       when c.wpp_status in ('delivered', 'entregue') then 'entregue' when c.enviado_wpp is not null then 'enviada' else 'enviando' end) x
        from credito.conversas c where c.lead_id = v_id
      union all
      select jsonb_build_object('id', 'n' || n.id, 'clienteId', n.lead_id::text, 'de', 'nota', 'autor', n.autor, 'texto', n.texto, 'midia', null, 'em', n.criado_em, 'status', null)
        from credito.painel_notas n where n.lead_id = v_id) t));
  elsif p_acao = 'nota' then
    if u.papel <> 'admin' then return jsonb_build_object('ok', false, 'codigo', 403, 'erro', 'Só o administrador escreve notas.'); end if;
    insert into credito.painel_notas (lead_id, autor, texto) values (v_id, u.id::text, p->>'texto');
    return jsonb_build_object('ok', true);
  end if;

  select * into l from credito.leads where id = v_id;
  if p_acao in ('mover', 'responsavel', 'assumir', 'salvar_cliente') and l.id is null then return jsonb_build_object('ok', false, 'codigo', 404, 'erro', 'Cliente não encontrado.'); end if;
  if p_acao = 'mover' then
    update credito.leads set painel_etapa = p->>'etapa', finalizado_em = case when p->>'etapa' = 'perdido' then coalesce(finalizado_em, now()) else finalizado_em end,
           dt_fechou = case when p->>'etapa' = 'posvenda' then coalesce(dt_fechou, now()) else dt_fechou end where id = v_id returning * into l;
  elsif p_acao = 'responsavel' then
    update credito.leads set painel_responsavel = nullif(p->>'responsavel', '')::bigint where id = v_id returning * into l;
  elsif p_acao = 'assumir' then
    update credito.leads set aguardando = 'humano', humano_em = now(), painel_responsavel = coalesce(painel_responsavel, u.id) where id = v_id returning * into l;
  elsif p_acao = 'salvar_cliente' then
    update credito.leads set nome = coalesce(p->>'nome', nome), etiqueta = case when p ? 'etiqueta' then p->>'etiqueta' else etiqueta end,
           cpf_informado = coalesce(nullif(regexp_replace(coalesce(p->>'cpf', ''), '\D', '', 'g'), ''), cpf_informado) where id = v_id returning * into l;
  elsif p_acao = 'dono_numero' then
    update credito.wpp_chips set painel_dono = nullif(p->>'dono', '')::bigint where nome = p->>'nome';
    return jsonb_build_object('ok', true);
  else
    return jsonb_build_object('ok', false, 'codigo', 400, 'erro', 'Ação inválida.');
  end if;
  return jsonb_build_object('ok', true, 'cliente', credito.painel_cliente(l));
end $$;
