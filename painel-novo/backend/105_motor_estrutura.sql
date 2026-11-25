-- 105 · Motor de crédito: estrutura (aplicado em 24/11/2026). Separado da Ana.
-- O motor guarda cada consulta em credito.motor_consultas: uma "parte" por banco+produto
-- (v8_clt, v8_fgts, unno_clt, unno_fgts, hub_clt, hub_fgts), cada uma com situação, passo e ofertas.
-- O fluxo n8n "[Motor] 🧮 Motor de Crédito" avança as partes a cada chamada (consultar / atualizar);
-- "[Motor] 🔑 Acessos" renova os tokens de HUB (API oficial), V8 FGTS e Unno em credito.motor_tokens.

create table if not exists credito.motor_tokens (
  nome text primary key,                 -- hub | v8_fgts | unno
  token text,
  expira_em timestamptz,
  atualizado_em timestamptz not null default now()
);

create table if not exists credito.motor_consultas (
  id bigserial primary key,
  cpf text not null,
  cliente jsonb not null default '{}',   -- nome, nascimento, telefone, email, sexo, cidade
  partes jsonb not null default '{}',    -- { v8_clt: {situacao, passo, ofertas[], ...}, ... }
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists motor_consultas_cpf_idx on credito.motor_consultas (cpf, criado_em desc);

-- guarda os tokens que o fluxo de acessos obteve: {"hub": {"token": "...", "expira_s": 3600}, ...}
create or replace function credito.motor_tokens_salvar(p jsonb) returns jsonb language plpgsql as $$
declare k text; v jsonb; n int := 0;
begin
  for k, v in select * from jsonb_each(coalesce(p, '{}')) loop
    if coalesce(v->>'token', '') <> '' then
      insert into credito.motor_tokens (nome, token, expira_em, atualizado_em)
      values (k, v->>'token', now() + make_interval(secs => greatest(60, coalesce((v->>'expira_s')::int, 3600)) - 120), now())
      on conflict (nome) do update set token = excluded.token, expira_em = excluded.expira_em, atualizado_em = now();
      n := n + 1;
    end if;
  end loop;
  return jsonb_build_object('salvos', n, 'tokens', (select jsonb_object_agg(nome, expira_em) from credito.motor_tokens));
end $$;

-- contexto de uma chamada do motor: valida a chave, abre/carrega a consulta e entrega tokens e configurações
create or replace function credito.motor_api(k text, p_acao text, p_cpf text, p_id bigint) returns jsonb language plpgsql as $$
declare v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'); c credito.motor_consultas%rowtype; v_lead jsonb;
begin
  if not credito.validar_chave(k) then return jsonb_build_object('ok', false, 'codigo', 401, 'erro', 'sem acesso'); end if;
  if p_acao = 'consultar' then
    if length(v_cpf) <> 11 then return jsonb_build_object('ok', false, 'codigo', 400, 'erro', 'CPF precisa ter 11 números'); end if;
    select jsonb_strip_nulls(jsonb_build_object('nome', nullif(l.dados_v8->>'nome', ''), 'nascimento', nullif(l.dados_v8->>'nascimento', ''),
             'telefone', nullif(l.telefone, ''), 'email', coalesce(nullif(l.dados_v8->>'email', ''), nullif(l.unno->>'email', ''))))
      into v_lead from credito.leads l
     where regexp_replace(coalesce(l.cpf_informado, l.cpf_base, ''), '\D', '', 'g') = v_cpf order by l.id desc limit 1;
    insert into credito.motor_consultas (cpf, cliente) values (v_cpf, coalesce(v_lead, '{}')) returning * into c;
  elsif p_acao = 'atualizar' then
    select * into c from credito.motor_consultas where id = p_id;
    if c.id is null then return jsonb_build_object('ok', false, 'codigo', 404, 'erro', 'consulta não encontrada'); end if;
  else
    return jsonb_build_object('ok', false, 'codigo', 400, 'erro', 'ação inválida');
  end if;
  return jsonb_build_object('ok', true, 'id', c.id, 'cpf', c.cpf, 'cliente', c.cliente, 'partes', c.partes, 'criado_em', c.criado_em,
    'tokens', jsonb_build_object(
      'hub', (select token from credito.motor_tokens where nome = 'hub' and expira_em > now()),
      'v8_fgts', (select token from credito.motor_tokens where nome = 'v8_fgts' and expira_em > now()),
      'unno', (select token from credito.motor_tokens where nome = 'unno' and expira_em > now()),
      'v8_clt', (select token from credito.v8_token where id = 1 and expira_em > now() + interval '2 minutes')),
    'cfg', jsonb_build_object(
      'hub_loja', coalesce((select (valor->>'loja_id')::int from credito.configuracoes where chave = 'hub_fgts'), 9562),
      'unno_base', (select valor->>'base' from credito.configuracoes where chave = 'unno'),
      'unno_user_uuid', (select valor->>'user_uuid' from credito.configuracoes where chave = 'unno'),
      'sessao', (select valor->>'sessao' from credito.configuracoes where chave = 'motor')));
end $$;

-- % de comissão de uma oferta conforme a parte (banco + produto)
create or replace function credito.motor_pct(p_parte text, o jsonb) returns numeric language plpgsql stable as $$
declare v_seg boolean := coalesce((o->>'seguro')::boolean, true); v_pz int := nullif(o->>'prazo', '')::numeric::int; v_val numeric := nullif(o->>'valor', '')::numeric;
begin
  return case p_parte
    when 'v8_clt' then (select percentual from credito.tabelas_comissao where ativo and banco = 'v8digital' and com_seguro = v_seg and parcelas <= coalesce(v_pz, 0) order by parcelas desc limit 1)
    when 'unno_clt' then credito.unno_pct(o->>'banco', o->>'tabela', coalesce(nullif(o->>'variante', ''), o->>'tabela'), v_seg, v_pz)
    when 'hub_clt' then credito.motor_comissao_pct('hub', 'clt', null, o->>'tabela', v_pz, null)
    when 'hub_fgts' then credito.comissao_fgts_pct(nullif(o->>'tabela_cod', '')::int, v_val)
    when 'v8_fgts' then credito.motor_comissao_pct('v8', 'fgts', o->>'banco', o->>'tabela', null, v_val)
    when 'unno_fgts' then credito.motor_comissao_pct('unno', 'fgts', o->>'banco', o->>'tabela', null, v_val)
  end;
end $$;

-- salva o andamento e devolve a consulta com a comissão de cada oferta, ordenada pela maior comissão
create or replace function credito.motor_salvar(p_id bigint, p_partes jsonb, p_cliente jsonb) returns jsonb language plpgsql as $$
declare c credito.motor_consultas%rowtype; k text; v jsonb; saida jsonb := '{}'; ofs jsonb; todas jsonb := '[]'; pend int := 0;
begin
  update credito.motor_consultas
     set partes = partes || coalesce(p_partes, '{}'), cliente = cliente || coalesce(p_cliente, '{}'), atualizado_em = now()
   where id = p_id returning * into c;
  if c.id is null then return jsonb_build_object('ok', false, 'erro', 'consulta não encontrada'); end if;
  for k, v in select * from jsonb_each(c.partes) loop
    select coalesce(jsonb_agg(x order by (x->>'comissao')::numeric desc nulls last, (x->>'valor')::numeric desc), '[]') into ofs
      from (select o || jsonb_build_object('comissao_pct', pct, 'comissao', round(coalesce((o->>'valor')::numeric, 0) * pct / 100, 2)) as x
              from jsonb_array_elements(coalesce(v->'ofertas', '[]')) o, lateral (select credito.motor_pct(k, o) as pct) p) t;
    saida := saida || jsonb_build_object(k, v || jsonb_build_object('ofertas', ofs));
    todas := todas || (select coalesce(jsonb_agg(x || jsonb_build_object('parte', k)), '[]') from jsonb_array_elements(ofs) x);
    if coalesce(v->>'situacao', 'processando') in ('iniciando', 'processando', 'aguardando_termo', 'aguardando_autorizacao', 'simulando') then pend := pend + 1; end if;
  end loop;
  return jsonb_build_object('ok', true, 'id', c.id, 'cpf', c.cpf, 'cliente', c.cliente - 'sexo' - 'cidade', 'partes', saida,
    'pendentes', pend, 'atualizado_em', c.atualizado_em,
    'melhor', (select x from jsonb_array_elements(todas) x where x->>'comissao' is not null order by (x->>'comissao')::numeric desc limit 1));
end $$;
