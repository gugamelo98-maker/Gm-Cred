-- 066: aba "API oficial" — disparo por mensagem modelo (template) da Meta, separado do disparo dos chips.
--  * Conexão (Phone Number ID, WABA ID, token) fica em credito.configuracoes 'oficial'; o painel nunca recebe o token de volta.
--  * Sem filtros de bloqueio/atendimento (pedido do dono). Só tira telefone repetido/ inválido da mesma lista.
--  * Envio: n8n "[Escritório] API oficial" chama credito.oficial_pendentes() a cada minuto e devolve o resultado em oficial_marcar().
--  * Retorno da Meta (enviado/entregue/lido/falhou/respostas) chega em /webhook/gmcred/meta -> credito.oficial_webhook().
--  * Clique: botão de link com sufixo = telefone (gmcredconsignado.com.br/<telefone>) -> rotador registra quem clicou.

create table if not exists credito.oficial_disparos (
  id serial primary key, nome text not null, status text not null default 'rascunho',
  template text, idioma text, corpo jsonb not null default '[]', cabecalho_imagem text, botao_telefone boolean not null default false,
  por_minuto int not null default 20, hora_inicio int not null default 8, hora_fim int not null default 22,
  criado_em timestamptz not null default now(), iniciado_em timestamptz, encerrado_em timestamptz);
create table if not exists credito.oficial_contatos (
  id bigserial primary key, disparo_id int not null references credito.oficial_disparos(id) on delete cascade,
  telefone text not null, nome text, status text not null default 'na_fila', wamid text, erro text,
  reservado_em timestamptz, enviado_em timestamptz, entregue_em timestamptz, lido_em timestamptz,
  clicou_em timestamptz, respondeu_em timestamptz, resposta text, lead_id int);
create unique index if not exists oficial_contatos_uni on credito.oficial_contatos (disparo_id, telefone);
create index if not exists oficial_contatos_fila on credito.oficial_contatos (disparo_id, status, id);
create index if not exists oficial_contatos_wamid on credito.oficial_contatos (wamid);
create index if not exists oficial_contatos_tel on credito.oficial_contatos (telefone);
alter table credito.rotador_cliques add column if not exists codigo text;

insert into credito.configuracoes (chave, valor) values ('oficial', '{}'::jsonb) on conflict (chave) do nothing;

create or replace function credito.oficial_tel(t text) returns text language sql immutable as $$
  select case when length(d) in (10, 11) then '55' || d when length(d) in (12, 13) and d like '55%' then d end
    from (select regexp_replace(coalesce(t, ''), '\D', '', 'g') d) x $$;

-- mesmo número com ou sem o 9 (o WhatsApp às vezes entrega sem): mesmo DDI+DDD e mesmos 8 últimos dígitos
create or replace function credito.tel_igual(a text, b text) returns boolean language sql immutable as $$
  select length(x) >= 12 and length(y) >= 12 and left(x, 4) = left(y, 4) and right(x, 8) = right(y, 8)
    from (select regexp_replace(coalesce(a, ''), '\D', '', 'g') x, regexp_replace(coalesce(b, ''), '\D', '', 'g') y) t $$;

create or replace function credito.oficial_cfg_publica() returns jsonb language sql stable as $$
  select jsonb_build_object('phone_id', c->>'phone_id', 'waba_id', c->>'waba_id', 'versao', coalesce(c->>'versao', 'v21.0'),
    'tem_token', coalesce(c->>'token', '') <> '', 'token_fim', right(coalesce(c->>'token', ''), 4),
    'verify_token', c->>'verify_token', 'webhook_url', 'https://rarelookingorca-n8n.cloudfy.live/webhook/gmcred/meta',
    'templates', coalesce(c->'templates', '[]'::jsonb), 'templates_em', c->>'templates_em', 'templates_erro', c->>'templates_erro')
  from (select coalesce(credito.config('oficial'), '{}'::jsonb) c) x $$;

create or replace function credito.oficial_resumo(p_id int) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'total', count(*), 'na_fila', count(*) filter (where status = 'na_fila'),
    'enviadas', count(*) filter (where enviado_em is not null), 'entregues', count(*) filter (where entregue_em is not null),
    'lidas', count(*) filter (where lido_em is not null), 'falharam', count(*) filter (where status = 'falhou'),
    'clicaram', count(*) filter (where clicou_em is not null), 'responderam', count(*) filter (where respondeu_em is not null),
    'chamaram', count(*) filter (where lead_id is not null))
  from credito.oficial_contatos where disparo_id = p_id and status not like 'teste%' $$;

-- monta a mensagem modelo de um contato
create or replace function credito.oficial_payload(d credito.oficial_disparos, c credito.oficial_contatos) returns jsonb language plpgsql stable as $$
declare comp jsonb := '[]'; params jsonb;
begin
  if coalesce(d.cabecalho_imagem, '') <> '' then
    comp := comp || jsonb_build_array(jsonb_build_object('type', 'header', 'parameters', jsonb_build_array(jsonb_build_object('type', 'image', 'image', jsonb_build_object('link', d.cabecalho_imagem)))));
  end if;
  select jsonb_agg(jsonb_build_object('type', 'text', 'text',
           case when v->>'tipo' = 'nome' then coalesce(nullif(initcap(split_part(trim(coalesce(c.nome, '')), ' ', 1)), ''), coalesce(nullif(v->>'padrao', ''), 'tudo bem'))
                else coalesce(nullif(v->>'texto', ''), '-') end) order by o)
    into params from jsonb_array_elements(coalesce(d.corpo, '[]')) with ordinality t(v, o);
  if params is not null then comp := comp || jsonb_build_array(jsonb_build_object('type', 'body', 'parameters', params)); end if;
  if d.botao_telefone then
    comp := comp || jsonb_build_array(jsonb_build_object('type', 'button', 'sub_type', 'url', 'index', '0',
      'parameters', jsonb_build_array(jsonb_build_object('type', 'text', 'text', c.telefone))));
  end if;
  return jsonb_build_object('messaging_product', 'whatsapp', 'to', c.telefone, 'type', 'template',
    'template', jsonb_build_object('name', d.template, 'language', jsonb_build_object('code', coalesce(d.idioma, 'pt_BR')), 'components', comp));
end $$;

-- fila: até por_minuto por disparo ativo, dentro do horário
create or replace function credito.oficial_pendentes() returns table(id bigint, url text, token text, corpo jsonb) language plpgsql as $$
declare cfg jsonb := coalesce(credito.config('oficial'), '{}'::jsonb); d credito.oficial_disparos; h int := extract(hour from now() at time zone 'America/Sao_Paulo');
begin
  if coalesce(cfg->>'token', '') = '' or coalesce(cfg->>'phone_id', '') = '' then return; end if;
  update credito.oficial_contatos set status = 'na_fila', reservado_em = null where status = 'enviando' and reservado_em < now() - interval '10 minutes';
  for d in select * from credito.oficial_disparos where status = 'ativo' and h >= hora_inicio and h < hora_fim order by id loop
    if not exists (select 1 from credito.oficial_contatos x where x.disparo_id = d.id and x.status in ('na_fila', 'enviando')) then
      update credito.oficial_disparos set status = 'concluido', encerrado_em = now() where oficial_disparos.id = d.id; continue;
    end if;
    return query
      with sel as (select x.id from credito.oficial_contatos x where x.disparo_id = d.id and x.status = 'na_fila' order by x.id limit greatest(1, least(d.por_minuto, 200)) for update skip locked),
           up as (update credito.oficial_contatos x set status = 'enviando', reservado_em = now() from sel where x.id = sel.id returning x.*)
      select up.id, 'https://graph.facebook.com/' || coalesce(cfg->>'versao', 'v21.0') || '/' || (cfg->>'phone_id') || '/messages', cfg->>'token',
             credito.oficial_payload(d, up::credito.oficial_contatos) from up;
  end loop;
end $$;

create or replace function credito.oficial_marcar(p_id bigint, p_status int, p_resp text) returns void language plpgsql as $$
declare j jsonb;
begin
  begin j := p_resp::jsonb; exception when others then j := null; end;
  if p_status between 200 and 299 and j #>> '{messages,0,id}' is not null then
    update credito.oficial_contatos set status = 'enviado', enviado_em = now(), wamid = j #>> '{messages,0,id}', erro = null where id = p_id;
  else
    update credito.oficial_contatos set status = 'falhou', erro = left(coalesce(j #>> '{error,error_data,details}', j #>> '{error,message}', p_resp, 'falha'), 300) where id = p_id;
  end if;
end $$;

-- retorno da Meta: status das mensagens e respostas dos clientes
create or replace function credito.oficial_webhook(p jsonb) returns void language plpgsql as $$
declare ch jsonb; s jsonb; m jsonb; v_tel text; v_txt text;
begin
  for ch in select jsonb_array_elements(e->'changes') from jsonb_array_elements(coalesce(p->'entry', '[]')) e loop
    for s in select jsonb_array_elements(coalesce(ch #> '{value,statuses}', '[]')) loop
      update credito.oficial_contatos set
        status = case when s->>'status' = 'failed' then 'falhou' when status = 'falhou' then status else coalesce(nullif(s->>'status', ''), status) end,
        enviado_em = coalesce(enviado_em, now()),
        entregue_em = case when s->>'status' in ('delivered', 'read') then coalesce(entregue_em, now()) else entregue_em end,
        lido_em = case when s->>'status' = 'read' then coalesce(lido_em, now()) else lido_em end,
        erro = case when s->>'status' = 'failed' then left(coalesce(s #>> '{errors,0,error_data,details}', s #>> '{errors,0,title}', 'falhou'), 300) else erro end
       where wamid = s->>'id';
    end loop;
    for m in select jsonb_array_elements(coalesce(ch #> '{value,messages}', '[]')) loop
      v_tel := regexp_replace(coalesce(m->>'from', ''), '\D', '', 'g');
      v_txt := coalesce(m #>> '{text,body}', m #>> '{button,text}', m #>> '{interactive,button_reply,title}', m->>'type');
      update credito.oficial_contatos set respondeu_em = coalesce(respondeu_em, now()), resposta = left(v_txt, 300)
       where id = (select id from credito.oficial_contatos where telefone in (v_tel, case when length(v_tel) = 12 then substr(v_tel, 1, 4) || '9' || substr(v_tel, 5) end,
                                                                                   case when length(v_tel) = 13 then substr(v_tel, 1, 4) || substr(v_tel, 6) end)
                    order by enviado_em desc nulls last limit 1);
    end loop;
  end loop;
end $$;

create or replace function credito.oficial_verificar(p_token text) returns boolean language sql stable as $$
  select coalesce(credito.config('oficial')->>'verify_token', '') <> '' and credito.config('oficial')->>'verify_token' = p_token $$;

create or replace function credito.oficial_templates_salvar(p_resp text, p_status int) returns void language plpgsql as $$
declare j jsonb; t jsonb;
begin
  begin j := p_resp::jsonb; exception when others then j := null; end;
  if p_status between 200 and 299 and jsonb_typeof(j->'data') = 'array' then
    select coalesce(jsonb_agg(jsonb_build_object('nome', x->>'name', 'idioma', x->>'language', 'status', x->>'status', 'categoria', x->>'category',
             'corpo', (select c->>'text' from jsonb_array_elements(x->'components') c where c->>'type' = 'BODY' limit 1),
             'cabecalho', (select c->>'format' from jsonb_array_elements(x->'components') c where c->>'type' = 'HEADER' limit 1),
             'botoes', (select jsonb_agg(jsonb_build_object('tipo', b->>'type', 'texto', b->>'text', 'url', b->>'url'))
                          from jsonb_array_elements(x->'components') c, jsonb_array_elements(coalesce(c->'buttons', '[]')) b where c->>'type' = 'BUTTONS'))
             order by x->>'name'), '[]') into t from jsonb_array_elements(j->'data') x;
    update credito.configuracoes set valor = valor || jsonb_build_object('templates', t, 'templates_em', now(), 'templates_erro', null) where chave = 'oficial';
  else
    update credito.configuracoes set valor = valor || jsonb_build_object('templates_erro', left(coalesce(j #>> '{error,message}', p_resp, 'sem resposta'), 300)) where chave = 'oficial';
  end if;
end $$;

create or replace function credito.oficial_api(k text, p_acao text, p_dados jsonb) returns json language plpgsql as $$
declare v jsonb := '{}'; v_id int := nullif(p_dados->>'id', '')::int; l jsonb; v_tel text; v_ok int := 0; v_dup int := 0; v_inv int := 0; cfg jsonb; v_corpo jsonb;
begin
  if not credito.validar_chave(k) then return null; end if;
  p_dados := coalesce(p_dados, '{}'::jsonb);
  cfg := coalesce(credito.config('oficial'), '{}'::jsonb);
  if p_acao = 'conexao' then
    cfg := cfg || jsonb_strip_nulls(jsonb_build_object(
      'phone_id', nullif(regexp_replace(coalesce(p_dados->>'phone_id', ''), '\D', '', 'g'), ''),
      'waba_id', nullif(regexp_replace(coalesce(p_dados->>'waba_id', ''), '\D', '', 'g'), ''),
      'token', nullif(trim(coalesce(p_dados->>'token', '')), '')));
    if coalesce(cfg->>'verify_token', '') = '' then cfg := cfg || jsonb_build_object('verify_token', 'gmcred-' || substr(md5(random()::text), 1, 16)); end if;
    update credito.configuracoes set valor = cfg where chave = 'oficial';
    v := jsonb_build_object('aviso', 'Conexão salva', 'buscar_templates', true);
  elsif p_acao = 'templates' then
    v := jsonb_build_object('buscar_templates', true);
  elsif p_acao = 'criar' then
    insert into credito.oficial_disparos (nome) values (coalesce(nullif(left(trim(p_dados->>'nome'), 60), ''), 'Oficial ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')))
      returning id into v_id;
    v := jsonb_build_object('aviso', 'Disparo criado');
  elsif p_acao = 'salvar' and v_id is not null then
    begin v_corpo := (p_dados->>'corpo')::jsonb; exception when others then v_corpo := null; end;
    update credito.oficial_disparos set
      nome = coalesce(nullif(left(trim(p_dados->>'nome'), 60), ''), nome),
      template = coalesce(nullif(left(p_dados->>'template', 200), ''), template),
      idioma = coalesce(nullif(left(p_dados->>'idioma', 20), ''), idioma),
      corpo = case when jsonb_typeof(v_corpo) = 'array' then v_corpo else corpo end,
      cabecalho_imagem = case when p_dados ? 'cabecalho_imagem' then nullif(left(trim(p_dados->>'cabecalho_imagem'), 500), '') else cabecalho_imagem end,
      botao_telefone = coalesce((p_dados->>'botao_telefone')::boolean, botao_telefone),
      por_minuto = greatest(1, least(200, coalesce(nullif(p_dados->>'por_minuto', '')::int, por_minuto))),
      hora_inicio = greatest(0, least(23, coalesce(nullif(p_dados->>'hora_inicio', '')::int, hora_inicio))),
      hora_fim = greatest(1, least(24, coalesce(nullif(p_dados->>'hora_fim', '')::int, hora_fim)))
     where id = v_id and status in ('rascunho', 'pausado', 'ativo');
    v := jsonb_build_object('aviso', 'Salvo');
  elsif p_acao = 'importar' and v_id is not null then
    for l in select jsonb_array_elements(coalesce(p_dados->'linhas', '[]')) loop
      v_tel := credito.oficial_tel(l->>'telefone');
      if v_tel is null then v_inv := v_inv + 1; continue; end if;
      insert into credito.oficial_contatos (disparo_id, telefone, nome) values (v_id, v_tel, nullif(left(trim(coalesce(l->>'nome', '')), 80), ''))
        on conflict (disparo_id, telefone) do nothing;
      if found then v_ok := v_ok + 1; else v_dup := v_dup + 1; end if;
    end loop;
    v := jsonb_build_object('aviso', v_ok || ' contatos na fila' || case when v_dup > 0 then ' · ' || v_dup || ' repetidos' else '' end || case when v_inv > 0 then ' · ' || v_inv || ' inválidos' else '' end);
  elsif p_acao = 'limpar_fila' and v_id is not null then
    delete from credito.oficial_contatos where disparo_id = v_id and status = 'na_fila';
    v := jsonb_build_object('aviso', 'Fila limpa');
  elsif p_acao = 'ativar' and v_id is not null then
    if coalesce(cfg->>'token', '') = '' or coalesce(cfg->>'phone_id', '') = '' then v := jsonb_build_object('erro', 'Preencha a conexão com a Meta antes.');
    elsif (select coalesce(template, '') from credito.oficial_disparos where id = v_id) = '' then v := jsonb_build_object('erro', 'Escolha a mensagem modelo antes.');
    else update credito.oficial_disparos set status = 'ativo', iniciado_em = coalesce(iniciado_em, now()), encerrado_em = null where id = v_id; v := jsonb_build_object('aviso', 'Disparo começou'); end if;
  elsif p_acao in ('pausar', 'encerrar') and v_id is not null then
    update credito.oficial_disparos set status = case when p_acao = 'pausar' then 'pausado' else 'encerrado' end, encerrado_em = case when p_acao = 'encerrar' then now() end where id = v_id;
    v := jsonb_build_object('aviso', case when p_acao = 'pausar' then 'Pausado' else 'Encerrado' end);
  elsif p_acao = 'apagar' and v_id is not null then
    delete from credito.oficial_disparos where id = v_id and (status = 'rascunho' or not exists (select 1 from credito.oficial_contatos where disparo_id = v_id and enviado_em is not null));
    v := jsonb_build_object('aviso', 'Apagado'); v_id := null;
  elsif p_acao = 'teste' and v_id is not null then
    v_tel := credito.oficial_tel(coalesce(nullif(p_dados->>'telefone', ''), credito.config('avisos')->>'dono'));
    if v_tel is null then v := jsonb_build_object('erro', 'Telefone de teste inválido.');
    elsif coalesce(cfg->>'token', '') = '' or coalesce(cfg->>'phone_id', '') = '' then v := jsonb_build_object('erro', 'Preencha a conexão com a Meta antes.');
    elsif (select coalesce(template, '') from credito.oficial_disparos where id = v_id) = '' then v := jsonb_build_object('erro', 'Escolha a mensagem modelo antes.');
    else
      insert into credito.oficial_contatos (disparo_id, telefone, nome, status) values (v_id, v_tel, 'Gustavo', 'teste')
        on conflict (disparo_id, telefone) do update set status = 'teste', wamid = null, erro = null, enviado_em = null, entregue_em = null, lido_em = null;
      v := jsonb_build_object('teste', (select jsonb_build_object('id', c.id, 'corpo', credito.oficial_payload(d, c),
                                                 'url', 'https://graph.facebook.com/' || coalesce(cfg->>'versao', 'v21.0') || '/' || (cfg->>'phone_id') || '/messages')
                                          from credito.oficial_contatos c join credito.oficial_disparos d on d.id = c.disparo_id where c.disparo_id = v_id and c.telefone = v_tel),
                              'aviso', 'Teste enviado para ' || credito.tel_fmt(v_tel));
    end if;
  end if;
  return (v || jsonb_build_object(
    'conexao', credito.oficial_cfg_publica(),
    'disparos', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'nome', d.nome, 'status', d.status, 'template', d.template, 'idioma', d.idioma, 'corpo', d.corpo,
                   'cabecalho_imagem', d.cabecalho_imagem, 'botao_telefone', d.botao_telefone, 'por_minuto', d.por_minuto, 'hora_inicio', d.hora_inicio, 'hora_fim', d.hora_fim,
                   'criado_em', d.criado_em, 'resumo', credito.oficial_resumo(d.id)) order by d.id desc), '[]') from credito.oficial_disparos d),
    'atual', v_id,
    'contatos', case when v_id is not null then (select coalesce(jsonb_agg(c order by c.ord), '[]') from (
        select row_number() over (order by coalesce(x.enviado_em, x.reservado_em) desc nulls last, x.id desc) ord, x.telefone, x.nome, x.status, x.erro,
               x.enviado_em, x.entregue_em, x.lido_em, x.clicou_em, x.respondeu_em, x.resposta, x.lead_id
          from credito.oficial_contatos x where x.disparo_id = v_id order by 1 limit 300) c) end))::json;
end $$;

-- teste: grava o resultado do envio do teste
create or replace function credito.oficial_teste_marcar(p_id bigint, p_status int, p_resp text) returns void language plpgsql as $$
begin
  perform credito.oficial_marcar(p_id, p_status, p_resp);
  update credito.oficial_contatos set status = case when status = 'enviado' then 'teste_ok' else 'teste_falhou' end where id = p_id;
end $$;

-- rotador: aceita o código do botão (telefone) e marca quem clicou
create or replace function credito.rotador_proximo(p_slug text, p_cod text) returns jsonb language plpgsql as $$
declare r jsonb; v_tel text := credito.oficial_tel(p_cod);
begin
  r := credito.rotador_proximo(p_slug);
  if v_tel is not null then
    update credito.rotador_cliques set codigo = v_tel where id = (select max(id) from credito.rotador_cliques where slug = p_slug);
    update credito.oficial_contatos set clicou_em = coalesce(clicou_em, now())
     where id = (select id from credito.oficial_contatos where telefone = v_tel and enviado_em is not null order by enviado_em desc limit 1);
  end if;
  return r;
end $$;

-- quem chamou o atendimento depois de receber a mensagem oficial (até 3 dias): liga o lead ao contato
create or replace function credito.oficial_ligar_leads() returns int language plpgsql as $$
declare n int;
begin
  update credito.oficial_contatos c set lead_id = l.id
    from credito.leads l
   where c.lead_id is null and c.enviado_em is not null and c.enviado_em > now() - interval '7 days'
     and credito.tel_igual(l.telefone, c.telefone)
     and l.criado_em >= c.enviado_em - interval '1 minute' and l.criado_em < c.enviado_em + interval '3 days';
  get diagnostics n = row_count;
  return n;
end $$;

-- origem do lead: quem recebeu a mensagem oficial (até 7 dias) ou chegou com "Olá! Quero simular" (link da API oficial)
create or replace function credito.mig066() returns void language plpgsql as $f$
declare v text := pg_get_functiondef('credito.marcar_origem'::regproc);
begin
  if position('API oficial' in v) > 0 then return; end if;
  v := replace(v, $a$  update credito.leads set origem = case
      when v_cc.instancia is not null$a$, $b$  update credito.leads set origem = case
      when exists (select 1 from credito.oficial_contatos oc join credito.leads l2 on l2.id = p_lead
                    where oc.enviado_em > now() - interval '7 days' and credito.tel_igual(oc.telefone, l2.telefone))
        then 'API oficial · ' || (select od.nome from credito.oficial_contatos oc join credito.oficial_disparos od on od.id = oc.disparo_id join credito.leads l2 on l2.id = p_lead
                                   where credito.tel_igual(oc.telefone, l2.telefone) order by oc.enviado_em desc nulls last limit 1)
      when coalesce(p_texto, '') ~* '^\s*ol[aá]!? quero \*?simular' then 'API oficial · link'
      when v_cc.instancia is not null$b$);
  if position('API oficial' in v) = 0 then raise exception 'marcar_origem: trecho não encontrado'; end if;
  execute v;
end $f$;
select credito.mig066();

-- link da API oficial com "Olá" (identificação)
update credito.rotadores set texto = 'Olá! Quero *simular* meu crédito CLT' where slug = 'redirect1';

-- sem link com telefone (o botão da mensagem modelo na Meta não tem variável)
alter table credito.oficial_disparos alter column botao_telefone set default false;

-- 067: a API oficial manda a fila toda de uma vez (até 500 por rodada de 1 minuto, 20 em paralelo no n8n)
-- em credito.oficial_pendentes: 'limit greatest(1, least(d.por_minuto, 200))' -> 'limit 500'; reserva expira em 30 min
