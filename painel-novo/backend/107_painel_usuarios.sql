-- 107 · Usuários do painel novo: login com e-mail + senha cadastrados pelo admin (não aceita e-mail qualquer).
-- Senha guardada com bcrypt (pgcrypto). A sessão do painel também vale para o Motor (validar_chave).

create table if not exists credito.painel_usuarios (
  id bigserial primary key,
  nome text not null,
  email text not null,
  senha_hash text not null,
  papel text not null default 'atendente' check (papel in ('admin', 'gestor', 'atendente')),
  escopo text not null default 'proprios' check (escopo in ('todos', 'proprios')),
  leads_por_dia int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  ultimo_acesso timestamptz
);
create unique index if not exists painel_usuarios_email_idx on credito.painel_usuarios (lower(email));

create table if not exists credito.painel_sessoes (
  id bigserial primary key,
  usuario_id bigint not null references credito.painel_usuarios(id) on delete cascade,
  token_hash text not null unique,
  expira_em timestamptz not null,
  criado_em timestamptz not null default now()
);

-- regras de comissão da equipe (percentual sobre a comissão que a GM Cred recebe)
insert into credito.configuracoes (chave, valor) values ('comissao_equipe', '{
  "clt": [{"ate": 10, "pct": 30}, {"ate": 20, "pct": 35}, {"ate": 30, "pct": 40}],
  "fgts": 35,
  "bonus_clt": {"cada": 25000, "valor": 100},
  "bonus_fgts": {"cada": 5000, "valor": 100}
}') on conflict (chave) do update set valor = excluded.valor;

create or replace function credito.painel_hash(t text) returns text language sql immutable as
$$ select encode(sha256(convert_to(t, 'UTF8')), 'hex') $$;

create or replace function credito.painel_json(u credito.painel_usuarios) returns jsonb language sql stable as $$
  select jsonb_build_object('id', u.id::text, 'nome', u.nome, 'email', u.email, 'papel', u.papel, 'escopo', u.escopo,
    'leadsPorDia', u.leads_por_dia, 'ativo', u.ativo, 'ultimoAcesso', u.ultimo_acesso)
$$;

create or replace function credito.painel_sessao(k text) returns credito.painel_usuarios language plpgsql as $$
declare u credito.painel_usuarios;
begin
  select pu.* into u from credito.painel_sessoes s join credito.painel_usuarios pu on pu.id = s.usuario_id
   where s.token_hash = credito.painel_hash(coalesce(k, '')) and s.expira_em > now() and pu.ativo;
  if u.id is not null then
    update credito.painel_sessoes set expira_em = now() + interval '7 days' where token_hash = credito.painel_hash(k);
  end if;
  return u;
end $$;

create or replace function credito.painel_api(p_acao text, k text, p jsonb) returns jsonb language plpgsql as $$
declare u credito.painel_usuarios; alvo credito.painel_usuarios; v_token text; v_email text; v_senha text;
begin
  p := coalesce(p, '{}');
  if p_acao = 'entrar' then
    v_email := lower(trim(coalesce(p->>'email', '')));
    select * into u from credito.painel_usuarios where lower(email) = v_email;
    if u.id is null or u.senha_hash <> public.crypt(coalesce(p->>'senha', ''), u.senha_hash) then
      return jsonb_build_object('ok', false, 'codigo', 401, 'erro', 'E-mail ou senha incorretos.');
    end if;
    if not u.ativo then return jsonb_build_object('ok', false, 'codigo', 403, 'erro', 'Este usuário está desativado.'); end if;
    v_token := 'pnl-' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    insert into credito.painel_sessoes (usuario_id, token_hash, expira_em) values (u.id, credito.painel_hash(v_token), now() + interval '7 days');
    update credito.painel_usuarios set ultimo_acesso = now() where id = u.id returning * into u;
    delete from credito.painel_sessoes where expira_em < now();
    return jsonb_build_object('ok', true, 'token', v_token, 'usuario', credito.painel_json(u));
  end if;

  u := credito.painel_sessao(k);
  if u.id is null then return jsonb_build_object('ok', false, 'codigo', 401, 'erro', 'Sessão expirada. Entre de novo.'); end if;

  if p_acao = 'eu' then
    return jsonb_build_object('ok', true, 'usuario', credito.painel_json(u),
      'comissao', (select valor from credito.configuracoes where chave = 'comissao_equipe'));
  elsif p_acao = 'sair' then
    delete from credito.painel_sessoes where token_hash = credito.painel_hash(k);
    return jsonb_build_object('ok', true);
  elsif p_acao = 'listar' then
    return jsonb_build_object('ok', true, 'usuarios',
      (select coalesce(jsonb_agg(credito.painel_json(x) order by x.ativo desc, x.nome), '[]') from credito.painel_usuarios x
        where u.papel in ('admin', 'gestor') or x.id = u.id));
  elsif p_acao = 'senha' then
    v_senha := coalesce(p->>'senha', '');
    if length(v_senha) < 6 then return jsonb_build_object('ok', false, 'codigo', 400, 'erro', 'A senha precisa ter pelo menos 6 caracteres.'); end if;
    update credito.painel_usuarios set senha_hash = public.crypt(v_senha, public.gen_salt('bf')) where id = u.id;
    return jsonb_build_object('ok', true);
  elsif p_acao = 'salvar' then
    if u.papel <> 'admin' then return jsonb_build_object('ok', false, 'codigo', 403, 'erro', 'Só o administrador cadastra usuários.'); end if;
    v_email := lower(trim(coalesce(p->>'email', '')));
    v_senha := coalesce(p->>'senha', '');
    -- edição parcial (ex.: só a cota de leads) mantém nome e e-mail atuais
    if coalesce(p->>'id', '') <> '' then
      select * into alvo from credito.painel_usuarios where id = (p->>'id')::bigint;
      if alvo.id is null then return jsonb_build_object('ok', false, 'codigo', 404, 'erro', 'Usuário não encontrado.'); end if;
      if v_email = '' then v_email := alvo.email; end if;
      if coalesce(trim(p->>'nome'), '') = '' then p := p || jsonb_build_object('nome', alvo.nome); end if;
      if p->>'papel' is null then p := p || jsonb_build_object('papel', alvo.papel); end if;
      if p->>'ativo' is null then p := p || jsonb_build_object('ativo', alvo.ativo); end if;
    end if;
    if coalesce(trim(p->>'nome'), '') = '' then return jsonb_build_object('ok', false, 'codigo', 400, 'erro', 'Informe o nome.'); end if;
    if v_email !~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then return jsonb_build_object('ok', false, 'codigo', 400, 'erro', 'E-mail inválido.'); end if;
    if exists (select 1 from credito.painel_usuarios where lower(email) = v_email and id::text <> coalesce(p->>'id', '')) then
      return jsonb_build_object('ok', false, 'codigo', 409, 'erro', 'Já existe um usuário com este e-mail.');
    end if;
    if v_senha <> '' and length(v_senha) < 6 then return jsonb_build_object('ok', false, 'codigo', 400, 'erro', 'A senha precisa ter pelo menos 6 caracteres.'); end if;
    if coalesce(p->>'id', '') = '' then
      if v_senha = '' then return jsonb_build_object('ok', false, 'codigo', 400, 'erro', 'Defina uma senha para o novo usuário.'); end if;
      insert into credito.painel_usuarios (nome, email, senha_hash, papel, escopo, leads_por_dia, ativo)
      values (trim(p->>'nome'), v_email, public.crypt(v_senha, public.gen_salt('bf')), coalesce(p->>'papel', 'atendente'),
              case when coalesce(p->>'papel', 'atendente') = 'atendente' then coalesce(p->>'escopo', 'proprios') else 'todos' end,
              coalesce((p->>'leadsPorDia')::int, 0), coalesce((p->>'ativo')::boolean, true))
      returning * into alvo;
    else
      if (p->>'id')::bigint = u.id and (coalesce(p->>'papel', 'admin') <> 'admin' or coalesce((p->>'ativo')::boolean, true) = false) then
        return jsonb_build_object('ok', false, 'codigo', 400, 'erro', 'Você não pode tirar o seu próprio acesso de administrador.');
      end if;
      update credito.painel_usuarios set nome = trim(p->>'nome'), email = v_email,
             papel = coalesce(p->>'papel', papel),
             escopo = case when coalesce(p->>'papel', papel) = 'atendente' then coalesce(p->>'escopo', escopo) else 'todos' end,
             leads_por_dia = coalesce((p->>'leadsPorDia')::int, leads_por_dia), ativo = coalesce((p->>'ativo')::boolean, ativo),
             senha_hash = case when v_senha <> '' then public.crypt(v_senha, public.gen_salt('bf')) else senha_hash end
       where id = (p->>'id')::bigint returning * into alvo;
      if alvo.id is null then return jsonb_build_object('ok', false, 'codigo', 404, 'erro', 'Usuário não encontrado.'); end if;
      if not alvo.ativo then delete from credito.painel_sessoes where usuario_id = alvo.id; end if;
    end if;
    return jsonb_build_object('ok', true, 'usuario', credito.painel_json(alvo));
  end if;
  return jsonb_build_object('ok', false, 'codigo', 400, 'erro', 'Ação inválida.');
end $$;

-- a sessão do painel novo também libera o Motor (que valida com credito.validar_chave)
create or replace function credito.validar_chave(k text) returns boolean language plpgsql as $$
declare v_id bigint;
begin
  if k is null or length(k) < 20 then return false; end if;
  if k like 'pnl-%' then return (credito.painel_sessao(k)).id is not null; end if;
  update credito.sessoes s set ultimo_uso = now(), expira_em = now() + interval '7 days'
    from credito.acessos a
   where a.id = s.acesso_id and a.ativo and s.expira_em > now()
     and s.token_hash = encode(sha256(convert_to(k,'UTF8')),'hex')
   returning s.id into v_id;
  return v_id is not null;
end $$;
