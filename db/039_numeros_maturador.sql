-- Empresa virtual CLT — aba Números (onde cada chip está, status, QR para reconectar, aviso quando cai) e Maturador
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-11. Idempotente.
create table if not exists credito.maturador_msgs (id bigserial primary key, de text not null, para text not null, texto text not null,
  criado_em timestamptz not null default now(), enviado_em timestamptz, erro text);
insert into credito.configuracoes (chave, valor) values ('maturador', '{"ativo":false,"intervalo_min":8,"hora_inicio":8,"hora_fim":21}'::jsonb)
on conflict (chave) do nothing;
create table if not exists credito.wpp_chips (nome text primary key, aparelho text, maturar boolean not null default false,
  estado text, codigo int, mudou_em timestamptz);
insert into credito.wpp_chips (nome, aparelho) values
  ('gmcred-campanha', null), ('gmcred-2', 'Motorola · slot principal'), ('gmcred-3', 'iPhone 8'),
  ('gmcred-4', 'Motorola · slot 2'), ('gmcred-5', 'Motorola · slot 3'), ('gmcred-6', 'Motorola · slot 5')
on conflict (nome) do nothing;

create or replace function credito.tel_fmt(t text) returns text language sql immutable as $$
  select case when length(d) >= 12 then '(' || substr(d, 3, 2) || ') ' || substr(d, 5, length(d) - 8) || '-' || right(d, 4) else d end
  from (select regexp_replace(coalesce(t, ''), '\D', '', 'g') d) x $$;

-- evento CONNECTION_UPDATE da Evolution: guarda o estado e avisa no celular quando cai / volta
create or replace function credito.wpp_evento(p_ev text, p_inst text, p_estado text, p_codigo text) returns void language plpgsql as $function$
declare ch credito.wpp_chips%rowtype; v_num text; v_cod int := nullif(regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g'), '')::int;
begin
  if lower(replace(coalesce(p_ev, ''), '_', '.')) <> 'connection.update' or coalesce(p_inst, '') not like 'gmcred%' or coalesce(p_estado, '') = '' then return; end if;
  insert into credito.wpp_chips (nome) values (p_inst) on conflict do nothing;
  select * into ch from credito.wpp_chips where nome = p_inst;
  update credito.wpp_chips set estado = p_estado, codigo = v_cod, mudou_em = now() where nome = p_inst and estado is distinct from p_estado;
  select split_part("ownerJid", '@', 1) into v_num from public."Instance" where name = p_inst;
  if p_estado = 'close' and coalesce(ch.estado, 'open') <> 'close' then
    perform credito.avisar('🔴 Número CAIU: ' || credito.tel_fmt(v_num) || coalesce(' · ' || ch.aparelho, '') || E'\nMotivo: '
      || case when v_cod in (402, 403) then 'restringido / banido pelo WhatsApp' when v_cod = 401 then 'desconectado no celular (ou banido)' else 'conexão perdida (' || coalesce(v_cod::text, '?') || ')' end
      || E'\nPara reconectar: painel → aba Números → Conectar.');
  elsif p_estado = 'open' and ch.estado = 'close' then
    perform credito.avisar('🟢 Número voltou: ' || credito.tel_fmt(v_num) || coalesce(' · ' || ch.aparelho, ''));
  end if;
end $function$;

create or replace function credito.wpp_numeros() returns json language sql stable as $$
  select coalesce(json_agg(json_build_object('nome', i.name, 'numero', split_part(coalesce(i."ownerJid", ''), '@', 1), 'perfil', i."profileName",
      'aparelho', ch.aparelho, 'maturar', coalesce(ch.maturar, false), 'estado', e.estado, 'caiu_em', case when e.estado <> 'open' then coalesce(ch.mudou_em, i."disconnectionAt") end,
      'codigo', e.codigo,
      'situacao', case when e.estado = 'open' then 'Conectado' when e.codigo in (402, 403) then 'Restringido / banido pelo WhatsApp'
                       when e.codigo = 401 then 'Desconectado no celular (ou banido)' when e.estado = 'connecting' then 'Reconectando' else 'Desconectado' end,
      'enviadas_hoje', (select count(*) from credito.conversas c join credito.leads l on l.id = c.lead_id
                         where coalesce(l.instancia, 'gmcred-campanha') = i.name and c.direcao = 'saida'
                           and c.enviado_wpp >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'),
      'falhas_hoje', (select count(*) from credito.conversas c join credito.leads l on l.id = c.lead_id
                         where coalesce(l.instancia, 'gmcred-campanha') = i.name and c.erro_wpp is not null and c.erro_wpp not like '{"key"%'
                           and c.criado_em >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'),
      'maturadas_hoje', (select count(*) from credito.maturador_msgs m where m.de = i.name and m.enviado_em >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'))
      order by i.name), '[]'::json)
  from public."Instance" i
  left join credito.wpp_chips ch on ch.nome = i.name
  cross join lateral (select case when ch.mudou_em is not null and ch.mudou_em >= coalesce(i."disconnectionAt", 'epoch') then ch.estado
                                  when i."disconnectionReasonCode" in (401, 402, 403) and i."disconnectionAt" > now() - interval '3 days' then 'close'
                                  else i."connectionStatus"::text end as estado,
                             case when ch.mudou_em is not null and ch.mudou_em >= coalesce(i."disconnectionAt", 'epoch') then ch.codigo else i."disconnectionReasonCode" end as codigo) e
  where i.name like 'gmcred%' $$;

-- MATURADOR: os números marcados conversam entre si com frases soltas, em horário comercial

create or replace function credito.frase_solta() returns text language sql volatile as $$
  select string_agg(f, ' ') from (select f from unnest(array['kkkk','bom dia','choveu aí?','pão de queijo','o gato subiu no telhado','amanhã talvez','azul ou verde?',
    'vish','manda depois','tá','blz','que horas são aí?','esqueci a chave','olha isso','rsrs','comprei café','a fila tava enorme','sei lá','acho que sim',
    'o ônibus atrasou','faz frio hoje','pizza de quê?','tô chegando','depois te falo','nossa','hahaha','que calor','vai ter jogo hoje?','achei meu fone',
    'deu ruim','tranquilo','show','beleza então','quase','eita','👍','😂','🙏','☕','🌧️']) f order by random() limit 1 + floor(random() * 3)::int) x $$;

create or replace function credito.maturador_passo() returns void language plpgsql as $function$
declare c jsonb := credito.config('maturador'); h int := extract(hour from now() at time zone 'America/Sao_Paulo'); a text; b text;
begin
  if not coalesce((c->>'ativo')::boolean, false) or h < coalesce((c->>'hora_inicio')::int, 8) or h >= coalesce((c->>'hora_fim')::int, 21) then return; end if;
  if exists (select 1 from credito.maturador_msgs where criado_em > now() - make_interval(mins => coalesce((c->>'intervalo_min')::int, 8)) * (0.7 + random() * 0.6)) then return; end if;
  select n.nome into a from json_to_recordset(credito.wpp_numeros()) as n(nome text, maturar boolean, estado text) where n.maturar and n.estado = 'open' order by random() limit 1;
  select n.nome into b from json_to_recordset(credito.wpp_numeros()) as n(nome text, maturar boolean, estado text) where n.maturar and n.estado = 'open' and n.nome <> a order by random() limit 1;
  if a is null or b is null then return; end if;
  insert into credito.maturador_msgs (de, para, texto) values (a, b, credito.frase_solta());
end $function$;

-- saída única: mensagens + avisos + maturador (id do maturador = -(1e9 + id))
create or replace function credito.wpp_pendentes2() returns json language plpgsql as $function$
declare p jsonb; c jsonb := credito.config('avisos'); a jsonb; m jsonb;
begin
  perform credito.maturador_passo();
  p := credito.wpp_pendentes()::jsonb;
  select coalesce(jsonb_agg(jsonb_build_object('id', -v.id, 'numero', c->>'numero', 'texto', v.texto, 'instancia', c->>'instancia',
           'apikey', (select i.token from public."Instance" i where i.name = c->>'instancia')) order by v.id), '[]'::jsonb)
    into a from (select * from credito.avisos where enviado_em is null and erro is null and criado_em > now() - interval '6 hours' order by id limit 5) v;
  select coalesce(jsonb_agg(jsonb_build_object('id', -(1000000000 + x.id), 'numero', (select split_part("ownerJid", '@', 1) from public."Instance" where name = x.para),
           'texto', x.texto, 'instancia', x.de, 'apikey', (select i.token from public."Instance" i where i.name = x.de))), '[]'::jsonb)
    into m from (select * from credito.maturador_msgs where enviado_em is null and erro is null and criado_em > now() - interval '30 minutes' order by id limit 3) x;
  return (p || jsonb_build_object('msgs', coalesce(p->'msgs', '[]'::jsonb) || a || m))::json;
end $function$;

create or replace function credito.wpp_marcar(p_id bigint) returns void language sql as $$
  update credito.conversas set enviado_wpp = now() where id = p_id;
  update credito.avisos set enviado_em = now() where id = -p_id and p_id > -1000000000;
  update credito.maturador_msgs set enviado_em = now() where id = -p_id - 1000000000 and p_id <= -1000000000 $$;

-- mensagem entre os nossos próprios números (maturador) não vira cliente
create or replace function credito.receber_wpp_v2(p_tel text, p_texto text, p_nome text, p_eu text, p_inst text) returns json language plpgsql as $function$
declare r json; v_lead int; t text := regexp_replace(coalesce(p_tel, ''), '\D', '', 'g');
begin
  if exists (select 1 from public."Instance" i where i.name like 'gmcred%' and split_part(i."ownerJid", '@', 1) in (t, credito.tel_lead(t))) then
    return json_build_object('interno', true);
  end if;
  if p_eu = 'true' then r := credito.receber_humano_wpp(p_tel, p_texto); else r := credito.receber_whatsapp(p_tel, p_texto, p_nome); end if;
  v_lead := coalesce((r->'lead'->>'id')::int, (r->>'lead')::int);
  if v_lead is not null and coalesce(p_inst, '') like 'gmcred%' then
    update credito.leads set instancia = p_inst where id = v_lead and instancia is distinct from p_inst;
  end if;
  return r;
end $function$;

-- API das abas Números e Maturador (POST /escritorio/numeros)
create or replace function credito.numeros_api(k text, p_acao text, p_dados jsonb) returns json language plpgsql as $function$
declare v_nome text := p_dados->>'nome';
begin
  if not credito.validar_chave(k) then return null; end if;
  if p_acao = 'salvar' and v_nome like 'gmcred%' then
    insert into credito.wpp_chips (nome) values (v_nome) on conflict do nothing;
    update credito.wpp_chips set aparelho = coalesce(nullif(left(p_dados->>'aparelho', 80), ''), aparelho),
           maturar = coalesce((p_dados->>'maturar')::boolean, maturar) where nome = v_nome;
  elsif p_acao = 'maturador' then
    update credito.configuracoes set valor = valor || jsonb_strip_nulls(jsonb_build_object('ativo', (p_dados->>'ativo')::boolean,
           'intervalo_min', case when nullif(p_dados->>'intervalo_min', '') is not null then greatest(3, least(120, (p_dados->>'intervalo_min')::int)) end)), atualizado_em = now() where chave = 'maturador';
  elsif p_acao = 'qr' and v_nome like 'gmcred%' then
    return json_build_object('qr', json_build_object('url', 'https://rarelookingorca-evolution.cloudfy.live/instance/connect/' || v_nome,
           'apikey', (select token from public."Instance" where name = v_nome)));
  end if;
  return json_build_object('numeros', credito.wpp_numeros(), 'maturador', credito.config('maturador'),
    'ultimas', coalesce((select json_agg(json_build_object('de', credito.tel_fmt((select split_part("ownerJid", '@', 1) from public."Instance" where name = m.de)),
        'para', credito.tel_fmt((select split_part("ownerJid", '@', 1) from public."Instance" where name = m.para)), 'texto', m.texto, 'em', m.criado_em,
        'ok', m.enviado_em is not null) order by m.id desc) from (select * from credito.maturador_msgs order by id desc limit 30) m), '[]'::json));
end $function$;

-- 11/11: avisos vão para o grupo "Avisos GM Cred" (120363412985164405@g.us), criado pelo dono com os 6 números.
--  configuracoes.avisos = {numero: <grupo>, instancia: gmcred-4, reserva: [gmcred-5, gmcred-6]};
--  wpp_pendentes2() usa a instância configurada e, se ela tiver caído, a primeira reserva conectada.
--  O número da campanha (6775) também está no grupo, mas não é usado para enviar avisos (para preservar a campanha).

-- 11/11: numeros_api acao 'criar' (aparelho) escolhe o próximo nome gmcred-N e grava o aparelho; o n8n
-- "Estado do Painel" cria a instância na Evolution (nó Evolution API, credencial evolution_cloudfy) já com o webhook
-- MESSAGES_UPSERT + CONNECTION_UPDATE e devolve o QR (GET /instance/connect com o hash da nova instância).

-- 11/11: numeros_api acao 'testar' (nome, destino, mensagem) -> o n8n "Estado do Painel" envia a mensagem pela instância
-- (nó "Enviar teste") e responde se a Evolution aceitou. Painel: botão "✉️ Testar envio" no cartão de cada número conectado.
