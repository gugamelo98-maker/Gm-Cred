-- 108 · Comissões da equipe: contratos de cada usuário, metas, saldo e pedidos de saque.
-- Regras em credito.configuracoes 'comissao_equipe' (% sobre a comissão que a GM Cred recebe).

create table if not exists credito.painel_contratos (
  id bigserial primary key,
  usuario_id bigint not null references credito.painel_usuarios(id),
  consulta_id bigint,
  produto text not null check (produto in ('CLT', 'FGTS')),
  banco text, tabela text, cliente_nome text, cpf text,
  valor numeric not null default 0,              -- valor liberado ao cliente (produção)
  comissao_empresa numeric not null default 0,   -- o que a GM Cred recebe
  proposta text,
  status text not null default 'digitado' check (status in ('digitado', 'pago', 'cancelado')),
  criado_em timestamptz not null default now(),
  pago_em timestamptz
);
create index if not exists painel_contratos_usuario_idx on credito.painel_contratos (usuario_id, pago_em);

create table if not exists credito.painel_saques (
  id bigserial primary key,
  usuario_id bigint not null references credito.painel_usuarios(id),
  valor numeric not null check (valor > 0),
  pix text not null,
  status text not null default 'solicitado' check (status in ('solicitado', 'pago', 'recusado')),
  obs text,
  criado_em timestamptz not null default now(),
  decidido_em timestamptz
);

-- comissão de um usuário num mês (só contratos pagos no mês)
create or replace function credito.comissao_mes(p_usuario bigint, p_mes date) returns jsonb language plpgsql stable as $$
declare r jsonb := (select valor from credito.configuracoes where chave = 'comissao_equipe');
  ini timestamptz := date_trunc('month', p_mes); fim timestamptz := date_trunc('month', p_mes) + interval '1 month';
  q int; prod numeric; emp numeric; fprod numeric; femp numeric; faixa jsonb; prox jsonb; pct numeric;
  b_clt numeric; b_fgts numeric; c_clt numeric; c_fgts numeric;
begin
  select count(*), coalesce(sum(valor), 0), coalesce(sum(comissao_empresa), 0) into q, prod, emp
    from credito.painel_contratos where usuario_id = p_usuario and produto = 'CLT' and status = 'pago' and pago_em >= ini and pago_em < fim;
  select coalesce(sum(valor), 0), coalesce(sum(comissao_empresa), 0) into fprod, femp
    from credito.painel_contratos where usuario_id = p_usuario and produto = 'FGTS' and status = 'pago' and pago_em >= ini and pago_em < fim;
  select x into faixa from jsonb_array_elements(r->'clt') x where q <= (x->>'ate')::int order by (x->>'ate')::int limit 1;
  if faixa is null then select x into faixa from jsonb_array_elements(r->'clt') x order by (x->>'ate')::int desc limit 1; end if;
  select x into prox from jsonb_array_elements(r->'clt') x where (x->>'pct')::numeric > (faixa->>'pct')::numeric order by (x->>'ate')::int limit 1;
  pct := (faixa->>'pct')::numeric;
  c_clt := round(emp * pct / 100, 2);
  b_clt := floor(prod / (r->'bonus_clt'->>'cada')::numeric) * (r->'bonus_clt'->>'valor')::numeric;
  c_fgts := round(femp * (r->>'fgts')::numeric / 100, 2);
  b_fgts := floor(fprod / (r->'bonus_fgts'->>'cada')::numeric) * (r->'bonus_fgts'->>'valor')::numeric;
  return jsonb_build_object('mes', to_char(ini, 'YYYY-MM'),
    'clt', jsonb_build_object('contratos', q, 'producao', prod, 'comissao_empresa', emp, 'pct', pct, 'comissao', c_clt, 'bonus', b_clt,
      'proxima_faixa', case when prox is null then null else jsonb_build_object('pct', (prox->>'pct')::numeric,
        'faltam', (select min((x->>'ate')::int) from jsonb_array_elements(r->'clt') x where (x->>'pct')::numeric = pct) + 1 - q) end,
      'proximo_bonus_faltam', (r->'bonus_clt'->>'cada')::numeric - mod(prod, (r->'bonus_clt'->>'cada')::numeric)),
    'fgts', jsonb_build_object('producao', fprod, 'comissao_empresa', femp, 'pct', (r->>'fgts')::numeric, 'comissao', c_fgts, 'bonus', b_fgts,
      'proximo_bonus_faltam', (r->'bonus_fgts'->>'cada')::numeric - mod(fprod, (r->'bonus_fgts'->>'cada')::numeric)),
    'digitados', (select count(*) from credito.painel_contratos where usuario_id = p_usuario and status = 'digitado'),
    'total', c_clt + b_clt + c_fgts + b_fgts);
end $$;

-- saldo para saque = tudo que ganhou (todos os meses) − saques pedidos ou pagos
create or replace function credito.comissao_saldo(p_usuario bigint) returns jsonb language plpgsql stable as $$
declare ganho numeric := 0; m date; pedido numeric; pago numeric;
begin
  for m in select distinct date_trunc('month', pago_em)::date from credito.painel_contratos where usuario_id = p_usuario and status = 'pago' loop
    ganho := ganho + (credito.comissao_mes(p_usuario, m)->>'total')::numeric;
  end loop;
  select coalesce(sum(valor) filter (where status = 'solicitado'), 0), coalesce(sum(valor) filter (where status = 'pago'), 0) into pedido, pago
    from credito.painel_saques where usuario_id = p_usuario;
  return jsonb_build_object('ganho', ganho, 'sacado', pago, 'em_analise', pedido, 'disponivel', greatest(0, ganho - pago - pedido));
end $$;

create or replace function credito.comissoes_api(p_acao text, k text, p jsonb) returns jsonb language plpgsql as $$
declare u credito.painel_usuarios; v_mes date; v_id bigint; s jsonb; adm boolean;
begin
  p := coalesce(p, '{}');
  u := credito.painel_sessao(k);
  if u.id is null then return jsonb_build_object('ok', false, 'codigo', 401, 'erro', 'Sessão expirada. Entre de novo.'); end if;
  adm := u.papel in ('admin', 'gestor');
  v_mes := coalesce(nullif(p->>'mes', '')::date, current_date);

  if p_acao = 'meu' then
    return jsonb_build_object('ok', true, 'mes', credito.comissao_mes(u.id, v_mes), 'saldo', credito.comissao_saldo(u.id),
      'regras', (select valor from credito.configuracoes where chave = 'comissao_equipe'),
      'contratos', (select coalesce(jsonb_agg(to_jsonb(c) - 'usuario_id' order by c.criado_em desc), '[]') from credito.painel_contratos c
                     where c.usuario_id = u.id and (c.status = 'digitado' or coalesce(c.pago_em, c.criado_em) >= date_trunc('month', v_mes) - interval '2 months')),
      'saques', (select coalesce(jsonb_agg(to_jsonb(x) order by x.criado_em desc), '[]') from credito.painel_saques x where x.usuario_id = u.id));

  elsif p_acao = 'pedir_saque' then
    s := credito.comissao_saldo(u.id);
    if coalesce((p->>'valor')::numeric, 0) <= 0 then return jsonb_build_object('ok', false, 'codigo', 400, 'erro', 'Informe o valor.'); end if;
    if (p->>'valor')::numeric > (s->>'disponivel')::numeric then return jsonb_build_object('ok', false, 'codigo', 400, 'erro', 'Valor maior que o saldo disponível.'); end if;
    if coalesce(trim(p->>'pix'), '') = '' then return jsonb_build_object('ok', false, 'codigo', 400, 'erro', 'Informe a chave PIX.'); end if;
    insert into credito.painel_saques (usuario_id, valor, pix) values (u.id, round((p->>'valor')::numeric, 2), trim(p->>'pix'));
    return jsonb_build_object('ok', true, 'saldo', credito.comissao_saldo(u.id));
  end if;

  if not adm then return jsonb_build_object('ok', false, 'codigo', 403, 'erro', 'Sem permissão.'); end if;

  if p_acao = 'equipe' then
    return jsonb_build_object('ok', true,
      'pessoas', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id::text, 'nome', x.nome, 'papel', x.papel, 'ativo', x.ativo,
                    'mes', credito.comissao_mes(x.id, v_mes), 'saldo', credito.comissao_saldo(x.id)) order by x.nome), '[]')
                  from credito.painel_usuarios x where x.ativo or exists (select 1 from credito.painel_contratos c where c.usuario_id = x.id)),
      'contratos', (select coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object('usuario', pu.nome) order by c.criado_em desc), '[]')
                    from credito.painel_contratos c join credito.painel_usuarios pu on pu.id = c.usuario_id
                    where c.status = 'digitado' or coalesce(c.pago_em, c.criado_em) >= date_trunc('month', v_mes)),
      'saques', (select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('usuario', pu.nome) order by x.status <> 'solicitado', x.criado_em desc), '[]')
                 from credito.painel_saques x join credito.painel_usuarios pu on pu.id = x.usuario_id
                 where x.status = 'solicitado' or x.criado_em >= date_trunc('month', v_mes)));
  elsif p_acao = 'contrato_status' then
    if u.papel <> 'admin' then return jsonb_build_object('ok', false, 'codigo', 403, 'erro', 'Só o administrador.'); end if;
    update credito.painel_contratos set status = p->>'status',
           pago_em = case when p->>'status' = 'pago' then coalesce(nullif(p->>'pago_em', '')::timestamptz, now()) else null end
     where id = (p->>'id')::bigint;
    return jsonb_build_object('ok', true);
  elsif p_acao = 'contrato_novo' then
    if u.papel <> 'admin' then return jsonb_build_object('ok', false, 'codigo', 403, 'erro', 'Só o administrador.'); end if;
    insert into credito.painel_contratos (usuario_id, produto, banco, tabela, cliente_nome, cpf, valor, comissao_empresa, proposta, status, pago_em)
    values ((p->>'usuario_id')::bigint, p->>'produto', p->>'banco', p->>'tabela', p->>'cliente_nome', regexp_replace(coalesce(p->>'cpf', ''), '\D', '', 'g'),
            coalesce((p->>'valor')::numeric, 0), coalesce((p->>'comissao_empresa')::numeric, 0), p->>'proposta', coalesce(p->>'status', 'digitado'),
            case when p->>'status' = 'pago' then now() end)
    returning id into v_id;
    return jsonb_build_object('ok', true, 'id', v_id);
  elsif p_acao = 'saque_status' then
    if u.papel <> 'admin' then return jsonb_build_object('ok', false, 'codigo', 403, 'erro', 'Só o administrador.'); end if;
    update credito.painel_saques set status = p->>'status', obs = p->>'obs', decidido_em = now() where id = (p->>'id')::bigint and status = 'solicitado';
    return jsonb_build_object('ok', true);
  end if;
  return jsonb_build_object('ok', false, 'codigo', 400, 'erro', 'Ação inválida.');
end $$;

-- digitação enviada com sucesso pelo Motor vira contrato do usuário que digitou
create or replace function credito.motor_digitacao_salvar(p_id bigint, r jsonb, k text, oferta jsonb) returns jsonb language plpgsql as $$
declare u credito.painel_usuarios; c credito.motor_consultas%rowtype; pct numeric;
begin
  perform credito.motor_digitacao_salvar(p_id, r);
  if coalesce((r->>'enviado')::boolean, false) and coalesce((r->>'ok')::boolean, false) then
    u := credito.painel_sessao(k);
    select * into c from credito.motor_consultas where id = p_id;
    if u.id is not null and c.id is not null then
      pct := credito.motor_pct(r->>'parte', oferta);
      insert into credito.painel_contratos (usuario_id, consulta_id, produto, banco, tabela, cliente_nome, cpf, valor, comissao_empresa, proposta)
      values (u.id, p_id, case when r->>'parte' like '%fgts' then 'FGTS' else 'CLT' end,
              upper(split_part(r->>'parte', '_', 1)) || coalesce(' · ' || nullif(oferta->>'banco', ''), ''), oferta->>'tabela',
              c.cliente->>'nome', c.cpf, coalesce((oferta->>'valor')::numeric, 0),
              round(coalesce((oferta->>'valor')::numeric, 0) * coalesce(pct, 0) / 100, 2), r->>'proposta');
    end if;
  end if;
  return r;
end $$;
