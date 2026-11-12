-- 050: mensagem da campanha com imagem, rodapé e botões (resposta rápida / link)
alter table credito.wpp_chips  add column if not exists msg_extra jsonb;
alter table credito.conversas  add column if not exists extra jsonb;
alter table credito.wpp_motor  add column if not exists botoes boolean not null default false;
update credito.wpp_motor set botoes = true where instancia in ('gmcred-campanha', 'gmcred-6');

create table if not exists credito.midias (id serial primary key, mime text not null, dados bytea not null, criado_em timestamptz not null default now());
create table if not exists credito.envios_teste (id serial primary key, instancia text not null, numero text not null, texto text not null, extra jsonb,
  criado_em timestamptz not null default now(), reservado_em timestamptz, enviado_em timestamptz, erro text);

-- transforma o "extra" (imagem/rodapé/botões) no formato de envio: interativo (números que aceitam botões) ou links no texto (os outros)
create or replace function credito.wpp_extra(x jsonb, p_botoes boolean) returns jsonb language plpgsql immutable as $$
declare e jsonb := x->'extra'; v_links text;
begin
  if e is null or jsonb_typeof(e) <> 'object' or coalesce(jsonb_array_length(e->'botoes'), 0) = 0 then return x - 'extra'; end if;
  if coalesce(p_botoes, false) then
    return (x - 'extra') || jsonb_build_object('interativo', jsonb_strip_nulls(jsonb_build_object(
      'headerImage', case when coalesce(e->>'imagem', '') <> '' then jsonb_build_object('mimetype', 'image/jpeg', 'filename', 'gmcred.jpg', 'url', e->>'imagem') end,
      'body', x->>'texto', 'footer', nullif(e->>'rodape', ''),
      'buttons', (select jsonb_agg(case when b->>'tipo' = 'link' then jsonb_build_object('type', 'url', 'text', b->>'texto', 'url', b->>'url')
                                        else jsonb_build_object('type', 'reply', 'id', 'b' || o, 'text', b->>'texto') end order by o)
                    from jsonb_array_elements(e->'botoes') with ordinality t(b, o)))));
  end if;
  select string_agg('👉 ' || (b->>'texto') || ': ' || (b->>'url'), E'\n' order by o) into v_links
    from jsonb_array_elements(e->'botoes') with ordinality t(b, o) where b->>'tipo' = 'link';
  return (x - 'extra') || jsonb_build_object('texto', (x->>'texto') || coalesce(E'\n\n' || v_links, ''));
end $$;

create or replace function credito.wpp_pendentes3() returns json language plpgsql as $$
declare p jsonb := credito.wpp_pendentes2()::jsonb; v_t jsonb;
begin
  with e as (update credito.envios_teste set reservado_em = now()
              where id in (select id from credito.envios_teste where enviado_em is null and erro is null and criado_em > now() - interval '15 minutes'
                             and (reservado_em is null or reservado_em < now() - interval '4 minutes') order by id limit 3)
             returning *)
  select coalesce(jsonb_agg(jsonb_build_object('id', -(2000000000 + e.id), 'numero', e.numero, 'texto', e.texto, 'modo', 'campanha', 'instancia', e.instancia, 'extra', e.extra)), '[]'::jsonb)
    into v_t from e;
  return (p || jsonb_build_object('msgs', coalesce((select jsonb_agg(case when w.instancia is not null
        then credito.wpp_extra(x || jsonb_build_object('extra', coalesce(x->'extra', (select cv.extra from credito.conversas cv where cv.id = (x->>'id')::bigint and (x->>'id')::bigint > 0))), w.botoes)
             || jsonb_build_object('motor', 'waha', 'url', w.url, 'apikey', w.apikey)
        else (x - 'extra') || jsonb_build_object('motor', 'evolution', 'url', p->>'url') end order by o)
      from jsonb_array_elements(coalesce(p->'msgs', '[]'::jsonb) || v_t) with ordinality as t(x, o)
      left join credito.wpp_motor w on w.ativo and w.instancia = coalesce(x->>'instancia', p->>'instancia')), '[]'::jsonb)))::json;
end $$;

create or replace function credito.wpp_marcar(p_id bigint) returns void language sql as $$
  update credito.conversas set enviado_wpp = now() where id = p_id;
  update credito.avisos set enviado_em = now() where id = -p_id and p_id > -1000000000;
  update credito.maturador_msgs set enviado_em = now() where id = -p_id - 1000000000 and p_id <= -1000000000 and p_id > -2000000000;
  update credito.envios_teste set enviado_em = now() where id = -p_id - 2000000000 and p_id <= -2000000000 $$;

-- falha de um envio de teste: grava o erro no teste
create or replace function credito.mig050() returns void language plpgsql as $f$
begin
  execute replace(pg_get_functiondef('credito.wpp_falhou'::regproc), 'begin
  select l.telefone', 'begin
  if p_id <= -2000000000 then
    if coalesce(p_resp, '''') ~* ''(ECONN|ETIMEDOUT|timeout|ngrok|"statusCode"\s*:\s*50[234])'' then update credito.envios_teste set reservado_em = now() where id = -p_id - 2000000000;
    else update credito.envios_teste set erro = left(coalesce(p_resp, ''falha''), 300) where id = -p_id - 2000000000; end if;
    return;
  end if;
  select l.telefone');
  execute replace(pg_get_functiondef('credito.campanha_passo'::regproc),
    'insert into credito.conversas (lead_id, agente_id, direcao, conteudo, setor_id, modo)
    values (v_lead, (select agente_id from credito.leads where id = v_lead), ''saida'', v_txt, ''prospeccao'', ''campanha'');',
    'insert into credito.conversas (lead_id, agente_id, direcao, conteudo, setor_id, modo, extra)
    values (v_lead, (select agente_id from credito.leads where id = v_lead), ''saida'', v_txt, ''prospeccao'', ''campanha'', (select ch.msg_extra from credito.wpp_chips ch where ch.nome = inst));');
  execute replace(pg_get_functiondef('credito.campanha_placar'::regproc), '''mensagem'', ch.mensagem,',
    '''mensagem'', ch.mensagem, ''extra'', ch.msg_extra, ''botoes'', coalesce((select w.botoes from credito.wpp_motor w where w.instancia = ch.nome), false),');
end $f$;
select credito.mig050();

-- campanha_api: novas ações (msg_salvar, imagem, msg_teste) por cima da original
do $$ begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'credito' and p.proname = 'campanha_api_base') then
    alter function credito.campanha_api(text, text, jsonb) rename to campanha_api_base;
  end if;
end $$;

create or replace function credito.campanha_api(k text, p_acao text, p_dados jsonb) returns json language plpgsql as $$
declare v jsonb := '{}'; v_b jsonb; v_e jsonb; v_img text; v_msg text; v_id int; v_bin bytea; ch record;
begin
  if not credito.validar_chave(k) then return null; end if;
  p_dados := coalesce(p_dados, '{}'::jsonb);
  if p_acao = 'msg_salvar' then
    v_msg := trim(coalesce(p_dados->>'mensagem', ''));
    if length(v_msg) < 15 then return (credito.campanha_api_base(k, 'ver', '{}')::jsonb || '{"erro":"Mensagem muito curta."}')::json; end if;
    begin v_e := (p_dados->>'extra')::jsonb; exception when others then v_e := null; end;
    select coalesce(jsonb_agg(case when b->>'tipo' = 'link' then jsonb_build_object('tipo', 'link', 'texto', left(trim(b->>'texto'), 20), 'url', left(trim(b->>'url'), 500))
                                   else jsonb_build_object('tipo', 'resposta', 'texto', left(trim(b->>'texto'), 20)) end order by o), '[]'::jsonb) into v_b
      from (select b, o from jsonb_array_elements(case when jsonb_typeof(v_e->'botoes') = 'array' then v_e->'botoes' else '[]'::jsonb end) with ordinality t(b, o)
             where trim(coalesce(b->>'texto', '')) <> '' and (b->>'tipo' <> 'link' or coalesce(b->>'url', '') ~ '^https?://[^ ]+$') limit 3) s;
    v_img := case when coalesce(v_e->>'imagem', '') ~ '^https://[^ ]+$' then v_e->>'imagem' end;
    update credito.wpp_chips set mensagem = left(v_msg, 600),
           msg_extra = case when jsonb_array_length(v_b) > 0 then jsonb_strip_nulls(jsonb_build_object('imagem', v_img, 'rodape', nullif(left(trim(coalesce(v_e->>'rodape', '')), 60), ''), 'botoes', v_b)) end
     where nome = p_dados->>'nome';
    v := jsonb_build_object('aviso', 'Mensagem salva');
  elsif p_acao = 'imagem' then
    begin v_bin := decode(regexp_replace(coalesce(p_dados->>'dados', ''), '^data:[^,]*,', ''), 'base64'); exception when others then v_bin := null; end;
    if v_bin is null or length(v_bin) < 100 or length(v_bin) > 1500000 then return (credito.campanha_api_base(k, 'ver', '{}')::jsonb || '{"erro":"Imagem inválida ou grande demais."}')::json; end if;
    insert into credito.midias (mime, dados) values ('image/jpeg', v_bin) returning id into v_id;
    v := jsonb_build_object('imagem_url', 'https://rarelookingorca-n8n.cloudfy.live/webhook/gmcred/midia?id=' || v_id);
  elsif p_acao = 'msg_teste' then
    select * into ch from credito.wpp_chips where nome = p_dados->>'nome';
    if ch.nome is null or coalesce(trim(ch.mensagem), '') = '' then return (credito.campanha_api_base(k, 'ver', '{}')::jsonb || '{"erro":"Salve a mensagem antes de testar."}')::json; end if;
    insert into credito.envios_teste (instancia, numero, texto, extra)
    values (ch.nome, credito.config('avisos')->>'dono', credito.variar_msg(ch.mensagem, 'Gustavo'), ch.msg_extra);
    v := jsonb_build_object('aviso', 'Teste na fila: chega no seu WhatsApp em até 2 minutos');
  else
    return (credito.campanha_api_base(k, p_acao, p_dados)::jsonb || jsonb_build_object('testes', (select coalesce(jsonb_agg(t order by t.id desc), '[]') from (
      select id, instancia, criado_em, enviado_em, left(erro, 120) erro from credito.envios_teste order by id desc limit 3) t)))::json;
  end if;
  return (credito.campanha_api_base(k, 'ver', '{}')::jsonb || v || jsonb_build_object('testes', (select coalesce(jsonb_agg(t order by t.id desc), '[]') from (
      select id, instancia, criado_em, enviado_em, left(erro, 120) erro from credito.envios_teste order by id desc limit 3) t)))::json;
end $$;

-- serve a imagem para o WhatsApp baixar
create or replace function credito.midia(p_id int) returns table(mime text, b64 text) language sql stable as $$
  select mime, encode(dados, 'base64') from credito.midias where id = p_id $$;
