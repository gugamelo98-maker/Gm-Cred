-- Empresa virtual CLT — campanha em vários números ao mesmo tempo + número reserva das conversas
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-11. Idempotente.
--  * wpp_chips.campanha: números marcados para a campanha. A cada intervalo (5 min), CADA número marcado e conectado manda
--    1 mensagem ao mesmo tempo (2 números = 2 mensagens a cada 5 min, 3 = 3...). Sem nenhum marcado, usa o campanha.instancia.
--  * O passo antigo dentro de wpp_pendentes() foi desligado ("if false and ..."); quem faz agora é credito.campanha_passo().
--  * Reserva: se um número cair, as conversas ativas dele (cliente respondeu, não encerrado, últimos 3 dias) passam para o
--    número reserva (configuracoes.atendente.reserva = gmcred-6, final 1361), que manda uma mensagem explicando a troca;
--    quando o cliente responde, a IA segue o atendimento com todo o histórico.
alter table credito.wpp_chips add column if not exists campanha boolean not null default false;
update credito.wpp_chips set campanha = true where nome = 'gmcred-campanha' and not exists (select 1 from credito.wpp_chips where campanha);
update credito.configuracoes set valor = valor || '{"reserva":"gmcred-6"}'::jsonb where chave = 'atendente' and not valor ? 'reserva';

create or replace function credito.campanha_instancias() returns text[] language sql stable as $$
  select coalesce((select array_agg(n.nome order by n.nome) from json_to_recordset(credito.wpp_numeros()) as n(nome text, estado text, campanha boolean)
                    where n.campanha and n.estado = 'open'),
                  case when exists (select 1 from credito.wpp_chips where campanha) then '{}'::text[] else array[credito.config('campanha')->>'instancia'] end) $$;

create or replace function credito.campanha_passo() returns int language plpgsql as $function$
declare c jsonb := credito.config('campanha'); h int := extract(hour from now() at time zone 'America/Sao_Paulo'); x record; inst text; v_lead int; v_txt text; n int := 0;
begin
  if not coalesce((c->>'ativa')::boolean, false) or h < coalesce((c->>'hora_inicio')::int, 8) or h >= coalesce((c->>'hora_fim')::int, 20) then return 0; end if;
  if coalesce((select max(enviado_em) from credito.campanha_contatos), 'epoch') > now() - make_interval(mins => coalesce((c->>'intervalo_min')::int, 5)) + interval '20 seconds' then return 0; end if;
  foreach inst in array credito.campanha_instancias() loop
    select * into x from credito.campanha_contatos cc where cc.status = 'na_fila' and cc.wpp_verificado is not null
       and not exists (select 1 from credito.numeros_bloqueados b where b.telefone = cc.telefone) order by cc.id limit 1 for update skip locked;
    exit when x.id is null;
    insert into credito.leads (telefone, nome, status, setor_id, canal, teste, cpf_base, aguardando, ultima_interacao, entrou_setor_em, margem, instancia)
    values (x.telefone, x.nome, 'disparado', 'prospeccao', 'whatsapp', false, x.cpf, 'cliente', now(), now(), x.margem, inst) returning id into v_lead;
    perform credito.atribuir_agente(v_lead, 'prospeccao');
    v_txt := regexp_replace(replace(c->>'mensagem', '{nome}', coalesce(split_part(x.nome, ' ', 1), '')), '^Oi\s+,', 'Oi,');
    insert into credito.conversas (lead_id, agente_id, direcao, conteudo, setor_id, modo)
    values (v_lead, (select agente_id from credito.leads where id = v_lead), 'saida', v_txt, 'prospeccao', 'campanha');
    update credito.campanha_contatos set status = 'enviado', enviado_em = now(), lead_id = v_lead where id = x.id;
    n := n + 1;
  end loop;
  return n;
end $function$;

-- conferência de WhatsApp: deixa conferidos tantos contatos quantos números de campanha (1 consulta por envio)
create or replace function credito.wpp_a_verificar() returns json language sql stable as $$
  select json_build_object('url', 'https://rarelookingorca-evolution.cloudfy.live', 'instancia', v.inst,
    'apikey', (select i.token from public."Instance" i where i.name = v.inst),
    'numeros', case when coalesce((c->>'ativa')::boolean, false)
                     and extract(hour from now() at time zone 'America/Sao_Paulo') >= coalesce((c->>'hora_inicio')::int, 8)
                     and extract(hour from now() at time zone 'America/Sao_Paulo') < coalesce((c->>'hora_fim')::int, 20)
                     and v.falta > 0
               then coalesce((select json_agg(telefone) from (select telefone from credito.campanha_contatos
                      where status = 'na_fila' and wpp_verificado is null order by id limit v.falta) x), '[]'::json)
               else '[]'::json end)
  from (select credito.config('campanha') c) y,
       lateral (select coalesce((credito.campanha_instancias())[1], y.c->>'instancia') as inst,
                       coalesce(array_length(credito.campanha_instancias(), 1), 1)
                         - (select count(*) from credito.campanha_contatos where status = 'na_fila' and wpp_verificado is not null)::int as falta) v $$;

create or replace function credito.transferir_conversas(p_inst text) returns int language plpgsql as $function$
declare r text := coalesce(credito.config('atendente')->>'reserva', 'gmcred-6'); l record; n int := 0;
begin
  if p_inst = r or not exists (select 1 from json_to_recordset(credito.wpp_numeros()) as x(nome text, estado text) where x.nome = r and x.estado = 'open') then return 0; end if;
  for l in select * from credito.leads where coalesce(instancia, credito.config('campanha')->>'instancia') = p_inst and canal = 'whatsapp' and not coalesce(teste, false)
              and dt_respondeu is not null and status <> 'parou' and not nao_contatar and ultima_interacao > now() - interval '3 days' loop
    update credito.leads set instancia = r where id = l.id;
    insert into credito.conversas (lead_id, agente_id, direcao, conteudo, setor_id, modo)
    values (l.id, null, 'saida', 'Oi' || coalesce(' ' || nullif(split_part(l.nome, ' ', 1), ''), '') || ', aqui é a Ana, da GM Cred 😊 Meu outro número ficou fora do ar, '
      || 'então vou continuar seu atendimento por aqui, tá bom? Pode me responder por este número que eu sigo de onde paramos.', l.setor_id, 'troca');
    n := n + 1;
  end loop;
  if n > 0 then perform credito.avisar('🔁 ' || n || ' conversa(s) do número que caiu passaram para o reserva ' || credito.tel_fmt((select split_part("ownerJid", '@', 1) from public."Instance" where name = r)) || '.'); end if;
  return n;
end $function$;

create or replace function credito.patch_040() returns text language plpgsql as $f$
declare d text; a text;
begin
  d := pg_get_functiondef('credito.wpp_pendentes()'::regprocedure);
  a := $x$if coalesce((c->>'ativa')::boolean, false) and h >= $x$;
  if position(a in d) > 0 then execute replace(d, a, $x$if false and coalesce((c->>'ativa')::boolean, false) and h >= $x$); end if;
  d := pg_get_functiondef('credito.wpp_pendentes2()'::regprocedure);
  if position('campanha_passo' in d) = 0 then execute replace(d, 'perform credito.maturador_passo();', 'perform credito.maturador_passo(); perform credito.campanha_passo();'); end if;
  d := pg_get_functiondef('credito.wpp_numeros()'::regprocedure);
  if position('''campanha'', coalesce' in d) = 0 then execute replace(d, $x$'maturar', coalesce(ch.maturar, false),$x$, $x$'maturar', coalesce(ch.maturar, false), 'campanha', coalesce(ch.campanha, false),$x$); end if;
  d := pg_get_functiondef('credito.numeros_api(text,text,jsonb)'::regprocedure);
  if position('campanha = coalesce' in d) = 0 then execute replace(d, $x$maturar = coalesce((p_dados->>'maturar')::boolean, maturar)$x$, $x$maturar = coalesce((p_dados->>'maturar')::boolean, maturar), campanha = coalesce((p_dados->>'campanha')::boolean, campanha)$x$); end if;
  d := pg_get_functiondef('credito.wpp_evento(text,text,text,text)'::regprocedure);
  if position('transferir_conversas' in d) = 0 then execute replace(d, $x$|| E'\nPara reconectar: painel → aba Números → Conectar.');$x$, $x$|| E'\nPara reconectar: painel → aba Números → Conectar.');
    perform credito.transferir_conversas(p_inst);$x$); end if;
  return 'ok';
end $f$;
select credito.patch_040();
