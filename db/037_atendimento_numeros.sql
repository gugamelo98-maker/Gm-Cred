-- Empresa virtual CLT — vários números de WhatsApp, status de cada número e aba "Conversas" (atender pelo painel)
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-11. Idempotente.
--  * leads.instancia: número (instância Evolution) por onde o cliente fala; a resposta sai pelo MESMO número.
--  * credito.receber_wpp_v2(tel, texto, nome, eu, instancia): entrada única do webhook (cliente ou atendente).
--  * credito.wpp_numeros(): status de cada número gmcred-* lido do banco da Evolution (conectado / caiu / restrito).
--  * credito.atendimento_api(k, acao, dados): lista | conversa | enviar | devolver  (POST /escritorio/atendimento).
alter table credito.leads add column if not exists instancia text;

create or replace function credito.receber_wpp_v2(p_tel text, p_texto text, p_nome text, p_eu text, p_inst text) returns json language plpgsql as $function$
declare r json; v_lead int;
begin
  if p_eu = 'true' then r := credito.receber_humano_wpp(p_tel, p_texto); else r := credito.receber_whatsapp(p_tel, p_texto, p_nome); end if;
  v_lead := coalesce((r->'lead'->>'id')::int, (r->>'lead')::int);
  if v_lead is not null and coalesce(p_inst, '') like 'gmcred%' then
    update credito.leads set instancia = p_inst where id = v_lead and instancia is distinct from p_inst;
  end if;
  return r;
end $function$;

create or replace function credito.wpp_numeros() returns json language sql stable as $$
  select coalesce(json_agg(json_build_object('nome', i.name, 'numero', split_part(coalesce(i."ownerJid", ''), '@', 1), 'perfil', i."profileName",
      'estado', i."connectionStatus", 'caiu_em', i."disconnectionAt", 'codigo', i."disconnectionReasonCode",
      'situacao', case when i."connectionStatus" = 'open' then 'Conectado'
                       when i."disconnectionReasonCode" in (403, 402) then 'Restringido / banido pelo WhatsApp'
                       when i."disconnectionReasonCode" = 401 then 'Desconectado no celular (ou banido)'
                       when i."connectionStatus" = 'connecting' then 'Reconectando'
                       else 'Desconectado' end,
      'enviadas_hoje', (select count(*) from credito.conversas c join credito.leads l on l.id = c.lead_id
                         where coalesce(l.instancia, credito.config('campanha')->>'instancia') = i.name and c.direcao = 'saida'
                           and c.enviado_wpp >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'),
      'falhas_hoje', (select count(*) from credito.conversas c join credito.leads l on l.id = c.lead_id
                         where coalesce(l.instancia, credito.config('campanha')->>'instancia') = i.name and c.erro_wpp is not null
                           and c.criado_em >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'))
      order by i.name), '[]'::json)
  from public."Instance" i where i.name like 'gmcred%' $$;

create or replace function credito.atendimento_api(k text, p_acao text, p_dados jsonb) returns json language plpgsql as $function$
#variable_conflict use_column
declare v_id int := nullif(p_dados->>'id', '')::int; l credito.leads%rowtype; v_txt text; v_msg bigint; v_inst text;
begin
  if not credito.validar_chave(k) then return null; end if;
  if p_acao = 'lista' then
    return json_build_object('numeros', credito.wpp_numeros(), 'conversas', coalesce((select json_agg(x order by x.ultima_em desc) from (
      select l.id, l.nome, l.telefone, l.aguardando, l.instancia, l.teste, s->>'t' as situacao, s->>'g' as grupo,
             m.conteudo as ultima, m.direcao as ultima_dir, m.criado_em as ultima_em,
             (select count(*) from credito.conversas e where e.lead_id = l.id and e.direcao = 'entrada'
                 and e.id > coalesce((select max(id) from credito.conversas o where o.lead_id = l.id and o.direcao = 'saida'), 0)) as sem_resposta
        from credito.leads l
        cross join lateral credito.situacao_lead(l) s
        join lateral (select * from credito.conversas c where c.lead_id = l.id order by c.id desc limit 1) m on true
       where l.dt_respondeu is not null and m.criado_em > now() - interval '15 days' and not coalesce(l.teste, false)
       order by m.criado_em desc limit 150) x), '[]'::json));
  end if;
  select * into l from credito.leads where id = v_id;
  if l.id is null then return json_build_object('ok', false, 'erro', 'cliente não encontrado'); end if;
  if p_acao = 'conversa' then
    return json_build_object('ok', true, 'lead', json_build_object('id', l.id, 'nome', l.nome, 'telefone', l.telefone, 'aguardando', l.aguardando,
        'instancia', l.instancia, 'situacao', credito.situacao_lead(l)->>'t', 'setor', l.setor_id, 'humano', l.aguardando = 'humano'),
      'msgs', coalesce((select json_agg(json_build_object('id', c.id, 'dir', c.direcao, 'txt', c.conteudo, 'modo', c.modo, 'em', c.criado_em,
          'enviado', c.enviado_wpp is not null, 'erro', c.erro_wpp) order by c.id) from (select * from credito.conversas where lead_id = l.id order by id desc limit 200) c), '[]'::json));
  elsif p_acao = 'enviar' then
    v_txt := left(trim(coalesce(p_dados->>'texto', '')), 2000);
    if v_txt = '' then return json_build_object('ok', false, 'erro', 'mensagem vazia'); end if;
    v_inst := coalesce(l.instancia, credito.config('campanha')->>'instancia');
    insert into credito.conversas (lead_id, agente_id, direcao, conteudo, setor_id, modo, enviado_wpp)
    values (l.id, null, 'saida', v_txt, l.setor_id, 'humano', case when l.canal = 'whatsapp' then now() end) returning id into v_msg;
    update credito.leads set aguardando = 'humano', humano_em = now(), ultima_interacao = now(),
           setor_id = case when setor_id = 'prospeccao' then 'recepcao' else setor_id end where id = l.id;
    return json_build_object('ok', true, 'msg_id', v_msg, 'envio', case when l.canal = 'whatsapp' then json_build_object(
        'id', v_msg, 'url', 'https://rarelookingorca-evolution.cloudfy.live', 'instancia', v_inst,
        'apikey', (select i.token from public."Instance" i where i.name = v_inst), 'numero', regexp_replace(l.telefone, '\D', '', 'g'), 'texto', v_txt) end);
  elsif p_acao = 'devolver' then
    update credito.leads set aguardando = 'agente', humano_em = null where id = l.id;
    return json_build_object('ok', true);
  end if;
  return json_build_object('ok', false, 'erro', 'ação inválida');
end $function$;

-- envio: cada mensagem sai pelo número do próprio cliente
create or replace function credito.patch_037() returns text language plpgsql as $f$
declare d text := pg_get_functiondef('credito.wpp_pendentes()'::regprocedure); a text := $x$'texto', cv.conteudo)$x$;
begin
  if position('l.instancia' in d) > 0 then return 'ja'; end if;
  if position(a in d) = 0 then raise exception 'wpp_pendentes: trecho não encontrado'; end if;
  execute replace(d, a, $x$'texto', cv.conteudo, 'instancia', coalesce(l.instancia, c->>'instancia'),
      'apikey', (select i.token from public."Instance" i where i.name = coalesce(l.instancia, c->>'instancia')))$x$);
  return 'ok';
end $f$;
select credito.patch_037();
