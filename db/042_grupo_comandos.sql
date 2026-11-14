-- Empresa virtual CLT — perguntas no grupo "Avisos GM Cred"
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-11. Idempotente.
-- Quando o dono (configuracoes.avisos.dono) manda no grupo uma mensagem com "?" ou palavras como status/resumo/quantos/
-- atendimento/formalização/aviso/parado/números/campanha/hoje, o sistema responde no grupo com o resumo do momento.
-- Só a instância que envia os avisos responde (os 6 números recebem a mesma mensagem do grupo).
update credito.configuracoes set valor = valor || '{"dono":"5548996077545"}'::jsonb where chave = 'avisos' and not valor ? 'dono';

create or replace function credito.resumo_grupo() returns text language plpgsql stable as $function$
declare r text; h timestamptz := (date_trunc('day', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo'; x record; t text := '';
begin
  perform set_config('credito.ver_teste', '0', true);
  r := '📊 *GM Cred agora* (' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') || E')\n\n';
  r := r || '👥 Em atendimento: *' || (select count(*) from credito.leads l where credito.no_escritorio(l)) || '*';
  select string_agg(s.nome || ' ' || n, ' · ' order by s.ordem) into t from (select setor_id, count(*) n from credito.leads l where credito.no_escritorio(l) group by 1) q join credito.setores s on s.id = q.setor_id;
  r := r || coalesce(E'\n   ' || t, '') || E'\n';
  r := r || '🧑 Esperando você (atendente): *' || (select count(*) from credito.leads l where l.aguardando = 'humano' and l.status <> 'parou' and not coalesce(l.teste, false)) || E'*\n';
  for x in select l.nome, l.telefone from credito.leads l where l.aguardando = 'humano' and l.status <> 'parou' and not coalesce(l.teste, false) order by l.ultima_interacao desc limit 5 loop
    r := r || '   • ' || coalesce(x.nome, 'sem nome') || ' ' || credito.tel_fmt(x.telefone) || E'\n';
  end loop;
  r := r || '⏳ Parados (esperando nossa resposta): *' || (select count(*) from credito.v_leads_parados) || E'*\n';
  r := r || '✍️ Formalização: *' || (select count(*) from credito.leads l where l.setor_id = 'formalizacao' and credito.no_escritorio(l)) || '* em andamento';
  t := (select string_agg(coalesce(l.nome, 'sem nome') || ' (' || round(extract(epoch from now() - coalesce(l.ultima_interacao, l.entrou_setor_em)) / 3600) || 'h)', ', ')
          from credito.leads l where l.setor_id = 'formalizacao' and credito.no_escritorio(l) and coalesce(l.ultima_interacao, l.entrou_setor_em) < now() - interval '2 hours');
  r := r || coalesce(E'\n   ⚠️ Parados há mais de 2h: ' || t, '') || E'\n';
  r := r || '💰 Com margem (recebeu proposta e sumiu): *' || (select count(*) from credito.leads l where (credito.situacao_lead(l)->>'g') = 'com_margem' and not coalesce(l.teste, false)) || E'*\n\n';
  r := r || E'*Hoje*\n' || '• Entraram: ' || (select count(*) from credito.leads l where coalesce(l.dt_respondeu, l.criado_em) >= h and l.setor_id <> 'prospeccao' and not coalesce(l.teste, false))
        || ' · Simulados: ' || (select count(*) from credito.leads l where l.dt_simulou >= h and not coalesce(l.teste, false))
        || ' · Links: ' || (select count(*) from credito.leads l where l.dt_proposta >= h and not coalesce(l.teste, false))
        || E'\n• Assinados: ' || (select count(*) from credito.leads l where l.dt_assinou >= h and not coalesce(l.teste, false))
        || ' · Pagos: ' || (select count(*) from credito.contratos c where c.etapa = 'pago' and c.dt_pagamento >= h)
        || ' · Comissão: R$ ' || to_char((select coalesce(sum(comissao), 0) from credito.contratos c where c.etapa = 'pago' and c.dt_pagamento >= h), 'FM999G990D00') || E'\n';
  r := r || '• Campanha: ' || (select count(*) from credito.campanha_contatos where enviado_em >= h) || ' enviadas, '
        || (select count(*) from credito.campanha_contatos c join credito.leads l on l.id = c.lead_id where c.enviado_em >= h and l.dt_respondeu is not null) || ' responderam · '
        || (select count(*) from credito.campanha_contatos where status = 'na_fila') || ' na fila (' || case when coalesce((credito.config('campanha')->>'ativa')::boolean, false) then 'ligada' else 'pausada' end || E')\n\n';
  r := r || E'*Números*\n';
  for x in select * from json_to_recordset(credito.wpp_numeros()) as n(nome text, numero text, estado text, situacao text, aparelho text) order by n.nome loop
    r := r || case when x.estado = 'open' then '🟢 ' else '🔴 ' end || credito.tel_fmt(x.numero) || coalesce(' · ' || x.aparelho, '') || case when x.estado = 'open' then '' else ' · ' || x.situacao end || E'\n';
  end loop;
  t := (select string_agg('• ' || a.titulo, E'\n') from (select coalesce(nullif(titulo, ''), tipo) titulo from credito.alertas where resolvido_em is null order by criado_em desc limit 5) a);
  r := r || coalesce(E'\n*Avisos pendentes*\n' || t, E'\n✅ Nenhum aviso pendente.');
  return r;
end $function$;

create or replace function credito.grupo_comando(p_inst text, p_grupo text, p_autor text, p_texto text) returns json language plpgsql as $function$
declare c jsonb := credito.config('avisos'); v_inst text;
begin
  if coalesce(p_grupo, '') <> c->>'numero' or right(regexp_replace(coalesce(p_autor, ''), '\D', '', 'g'), 8) <> right(c->>'dono', 8) then return null; end if;
  if coalesce(p_texto, '') !~* '(\?|status|resumo|quant|atendiment|formaliza|aviso|parad|n[uú]mero|campanha|hoje|como est|novidade|relat)' then return null; end if;
  -- só uma instância responde: a primeira conectada entre a dos avisos e as reservas
  select n.nome into v_inst from json_to_recordset(credito.wpp_numeros()) as n(nome text, estado text)
   where n.estado = 'open' and n.nome in (select c->>'instancia' union all select jsonb_array_elements_text(coalesce(c->'reserva', '[]'::jsonb)))
   order by (n.nome = c->>'instancia') desc, n.nome limit 1;
  if v_inst is distinct from p_inst then return null; end if;
  perform credito.avisar(credito.resumo_grupo());
  return json_build_object('ok', true);
end $function$;
-- n8n "GM Cred · WhatsApp (entrada)": o nó Mensagem devolve grupo/autor e o nó "Evento do número" chama também
-- credito.grupo_comando(instancia, grupo, autor, texto).

-- 11/11 (v2): a pergunta do dono vai para uma IA (OpenRouter, gemini-2.5-flash) que responde SÓ o que foi perguntado,
-- com os dados de credito.contexto_gestor() (resumo + projeção do mês + funil 30 dias + campanha + agentes).
-- grupo_comando() agora devolve {pergunta, contexto}; o n8n "WhatsApp (entrada)" chama a IA e grava a resposta com
-- credito.avisar() (sai no grupo pelo envio de 1 em 1 minuto). Se a IA falhar, manda o resumo geral.
-- O dono é reconhecido pelos últimos 8 dígitos (o WhatsApp manda o número sem o 9).
