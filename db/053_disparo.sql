-- 053: aba Disparo — rodadas de disparo com lista própria, números de disparo, mensagem com botões e
-- variações aprovadas (sorteadas a cada envio, com {saudacao} e {nome}).
create table if not exists credito.disparos (
  id serial primary key, nome text not null, status text not null default 'rascunho',
  numeros text[] not null default '{}', intervalo_min int not null default 5, hora_inicio int not null default 8, hora_fim int not null default 20,
  mensagem text not null default '', variacoes jsonb not null default '[]', extra jsonb,
  criado_em timestamptz not null default now(), iniciado_em timestamptz, encerrado_em timestamptz);
create table if not exists credito.disparo_contatos (
  id bigserial primary key, disparo_id int not null references credito.disparos(id) on delete cascade,
  nome text, telefone text not null, status text not null default 'na_fila', instancia text, lead_id int, texto text,
  enviado_em timestamptz, erro text, unique (disparo_id, telefone));
create index if not exists disparo_contatos_fila on credito.disparo_contatos (disparo_id, status, id);
create index if not exists disparo_contatos_tel on credito.disparo_contatos (telefone);
create index if not exists disparo_contatos_inst on credito.disparo_contatos (instancia, enviado_em);
alter table credito.leads add column if not exists disparo_id int;

-- texto de um envio: sorteia uma variação aprovada (diferente da última usada nesse número) e troca {saudacao} e {nome}
alter table credito.disparo_contatos add column if not exists modelo text;
create or replace function credito.disparo_modelo(p_disparo int, p_ultimo text) returns text language sql volatile as $$
  select coalesce((select t from (select value #>> '{}' t from jsonb_array_elements(coalesce(d.variacoes, '[]'))) x
                    where trim(t) <> '' order by (t = coalesce(p_ultimo, '')), random() limit 1), d.mensagem)
    from credito.disparos d where d.id = p_disparo $$;
create or replace function credito.disparo_render(p_tpl text, p_nome text) returns text language plpgsql stable as $$
declare v text := coalesce(p_tpl, ''); h int := extract(hour from now() at time zone 'America/Sao_Paulo'); v_n text := initcap(nullif(split_part(trim(coalesce(p_nome, '')), ' ', 1), ''));
        v_s text := case when h < 12 then 'Bom dia' when h < 18 then 'Boa tarde' else 'Boa noite' end;
begin
  v := replace(replace(v, '{saudacao}', v_s), '{Saudacao}', v_s);
  if v_n is null then v := regexp_replace(v, '[ \t]*\{nome\}', '', 'g'); else v := replace(v, '{nome}', v_n); end if;
  return v;
end $$;
create or replace function credito.disparo_texto(p_disparo int, p_nome text, p_ultimo text) returns text language sql volatile as $$
  select credito.disparo_render(credito.disparo_modelo(p_disparo, p_ultimo), p_nome) $$;

create or replace function credito.disparo_passo() returns int language plpgsql as $$
declare d record; inst text; x record; v_lead int; v_txt text; v_ult text; n int := 0; h int := extract(hour from now() at time zone 'America/Sao_Paulo');
begin
  for d in select * from credito.disparos where status = 'ativo' and h >= hora_inicio and h < hora_fim order by id loop
    foreach inst in array d.numeros loop
      continue when not exists (select 1 from json_to_recordset(credito.wpp_numeros()) as w(nome text, estado text) where w.nome = inst and w.estado = 'open');
      continue when exists (select 1 from credito.wpp_motor w where w.instancia = inst and w.trava_ate > now());
      continue when coalesce((select c.funcao from credito.wpp_chips c where c.nome = inst), 'disparo') <> 'disparo';
      continue when coalesce((select max(enviado_em) from credito.disparo_contatos where instancia = inst), 'epoch') > now() - make_interval(mins => d.intervalo_min) + interval '20 seconds';
      loop
        select * into x from credito.disparo_contatos c where c.disparo_id = d.id and c.status = 'na_fila' order by c.id limit 1 for update skip locked;
        exit when x.id is null;
        if exists (select 1 from credito.numeros_bloqueados b where b.telefone = x.telefone) then
          update credito.disparo_contatos set status = 'removido', erro = 'bloqueado / não contatar' where id = x.id; continue;
        end if;
        if exists (select 1 from credito.leads l where regexp_replace(l.telefone, '\D', '', 'g') = x.telefone and not coalesce(l.teste, false)
                    and l.dt_respondeu is not null and l.status <> 'parou' and l.ultima_interacao > now() - interval '7 days') then
          update credito.disparo_contatos set status = 'removido', erro = 'já está em atendimento' where id = x.id; continue;
        end if;
        exit;
      end loop;
      if x.id is null then
        update credito.disparos set status = 'concluido', encerrado_em = now() where id = d.id and status = 'ativo'
           and not exists (select 1 from credito.disparo_contatos where disparo_id = d.id and status = 'na_fila');
        exit;
      end if;
      select modelo into v_ult from credito.disparo_contatos where instancia = inst and modelo is not null order by enviado_em desc nulls last limit 1;
      v_ult := credito.disparo_modelo(d.id, v_ult);
      v_txt := credito.disparo_render(v_ult, x.nome);
      insert into credito.leads (telefone, nome, status, setor_id, canal, teste, aguardando, ultima_interacao, entrou_setor_em, instancia, disparo_id, origem, dt_disparo)
      values (x.telefone, x.nome, 'disparado', 'prospeccao', 'whatsapp', false, 'cliente', now(), now(), inst, d.id, 'disparo · ' || d.nome || ' · ' || inst, now())
      returning id into v_lead;
      perform credito.atribuir_agente(v_lead, 'prospeccao');
      insert into credito.conversas (lead_id, agente_id, direcao, conteudo, setor_id, modo, extra)
      values (v_lead, (select agente_id from credito.leads where id = v_lead), 'saida', v_txt, 'prospeccao', 'campanha', d.extra);
      update credito.disparo_contatos set status = 'enviado', enviado_em = now(), instancia = inst, lead_id = v_lead, texto = v_txt, modelo = v_ult where id = x.id;
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;

-- números do disparo: resultado por rodada
create or replace function credito.disparo_resumo(p_id int) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'total', (select count(*) from credito.disparo_contatos where disparo_id = p_id),
    'na_fila', (select count(*) from credito.disparo_contatos where disparo_id = p_id and status = 'na_fila'),
    'removidos', (select count(*) from credito.disparo_contatos where disparo_id = p_id and status = 'removido'),
    'enviadas', count(*), 
    'entregues', count(*) filter (where exists (select 1 from credito.conversas cv where cv.lead_id = l.id and cv.modo = 'campanha' and cv.wpp_status in ('DELIVERY_ACK', 'READ', 'PLAYED'))),
    'lidas', count(*) filter (where exists (select 1 from credito.conversas cv where cv.lead_id = l.id and cv.modo = 'campanha' and cv.wpp_status in ('READ', 'PLAYED'))),
    'nao_entregues', count(*) filter (where exists (select 1 from credito.conversas cv where cv.lead_id = l.id and cv.modo = 'campanha' and (cv.wpp_status = 'ERROR' or cv.erro_wpp is not null))),
    'responderam', count(*) filter (where l.dt_respondeu is not null and coalesce(l.motivo_parada, '') not like '%clicou em bloquear%'),
    'atendimento', count(*) filter (where l.instancia in (select nome from credito.wpp_chips where funcao = 'atendimento')),
    'bloquearam', count(*) filter (where coalesce(l.motivo_parada, '') like '%clicou em bloquear%'),
    'simularam', count(*) filter (where l.consult_id is not null or l.dt_simulou is not null),
    'propostas', count(*) filter (where l.ofertas is not null or l.dt_proposta is not null),
    'pagos', count(*) filter (where l.status_operacao = 'paid'))
  from credito.leads l where l.disparo_id = p_id $$;

create or replace function credito.disparo_api(k text, p_acao text, p_dados jsonb) returns json language plpgsql as $$
declare v jsonb := '{}'; v_id int := nullif(p_dados->>'id', '')::int; r jsonb; v_tel text; v_ok int := 0; v_dup int := 0; v_inv int := 0; v_blq int := 0;
        v_num text[]; v_b jsonb; v_e jsonb; d credito.disparos%rowtype;
begin
  if not credito.validar_chave(k) then return null; end if;
  p_dados := coalesce(p_dados, '{}'::jsonb);
  if p_acao = 'criar' then
    insert into credito.disparos (nome, numeros) values (coalesce(nullif(left(trim(p_dados->>'nome'), 60), ''), 'Disparo ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')),
      coalesce((select array_agg(nome order by nome) from credito.wpp_chips where funcao = 'disparo' and not coalesce(oculto, false)), '{}'))
    returning id into v_id;
    v := jsonb_build_object('aviso', 'Disparo criado');
  elsif p_acao = 'salvar' and v_id is not null then
    select * into d from credito.disparos where id = v_id;
    begin v_num := array(select jsonb_array_elements_text((p_dados->>'numeros')::jsonb)); exception when others then v_num := d.numeros; end;
    begin v_e := (p_dados->>'extra')::jsonb; exception when others then v_e := null; end;
    select coalesce(jsonb_agg(case when b->>'tipo' = 'link' then jsonb_build_object('tipo', 'link', 'texto', left(trim(b->>'texto'), 20), 'url', left(trim(b->>'url'), 500))
                                   else jsonb_build_object('tipo', 'resposta', 'texto', left(trim(b->>'texto'), 20)) end order by o), '[]'::jsonb) into v_b
      from (select b, o from jsonb_array_elements(case when jsonb_typeof(v_e->'botoes') = 'array' then v_e->'botoes' else '[]'::jsonb end) with ordinality t(b, o)
             where trim(coalesce(b->>'texto', '')) <> '' and (b->>'tipo' <> 'link' or coalesce(b->>'url', '') ~ '^https?://[^ ]+$') limit 3) s;
    update credito.disparos set
      nome = coalesce(nullif(left(trim(p_dados->>'nome'), 60), ''), nome),
      numeros = coalesce(v_num, numeros),
      intervalo_min = greatest(1, least(120, coalesce(nullif(p_dados->>'intervalo_min', '')::int, intervalo_min))),
      hora_inicio = greatest(0, least(23, coalesce(nullif(p_dados->>'hora_inicio', '')::int, hora_inicio))),
      hora_fim = greatest(1, least(24, coalesce(nullif(p_dados->>'hora_fim', '')::int, hora_fim))),
      mensagem = coalesce(left(p_dados->>'mensagem', 800), mensagem),
      variacoes = case when p_dados ? 'variacoes' then coalesce((select jsonb_agg(left(trim(t), 800)) from jsonb_array_elements_text(
                         case when jsonb_typeof((p_dados->>'variacoes')::jsonb) = 'array' then (p_dados->>'variacoes')::jsonb else '[]' end) t where length(trim(t)) >= 15), '[]') else variacoes end,
      extra = case when p_dados ? 'extra' then case when jsonb_array_length(v_b) > 0 then jsonb_strip_nulls(jsonb_build_object(
                'imagem', case when coalesce(v_e->>'imagem', '') ~ '^https://[^ ]+$' then v_e->>'imagem' end,
                'rodape', nullif(left(trim(coalesce(v_e->>'rodape', '')), 60), ''), 'botoes', v_b)) end else extra end
     where id = v_id;
    v := jsonb_build_object('aviso', 'Salvo');
  elsif p_acao = 'importar' and v_id is not null then
    for r in select * from jsonb_array_elements(coalesce(p_dados->'linhas', '[]'::jsonb)) loop
      v_tel := regexp_replace(coalesce(r->>'telefone', ''), '\D', '', 'g');
      if length(v_tel) in (10, 11) then v_tel := '55' || v_tel; end if;
      if length(v_tel) not in (12, 13) or substr(v_tel, 1, 2) <> '55' then v_inv := v_inv + 1; continue; end if;
      if exists (select 1 from credito.numeros_bloqueados b where b.telefone in (v_tel, credito.tel_lead(v_tel))) then v_blq := v_blq + 1; continue; end if;
      insert into credito.disparo_contatos (disparo_id, nome, telefone) values (v_id, nullif(initcap(left(trim(coalesce(r->>'nome', '')), 80)), ''), v_tel)
        on conflict (disparo_id, telefone) do nothing;
      if found then v_ok := v_ok + 1; else v_dup := v_dup + 1; end if;
    end loop;
    v := jsonb_build_object('aviso', v_ok || ' importado(s)' || case when v_dup > 0 then ' · ' || v_dup || ' repetido(s)' else '' end
      || case when v_blq > 0 then ' · ' || v_blq || ' bloqueado(s)' else '' end || case when v_inv > 0 then ' · ' || v_inv || ' com telefone inválido' else '' end);
  elsif p_acao in ('ativar', 'pausar', 'encerrar') and v_id is not null then
    select * into d from credito.disparos where id = v_id;
    if p_acao = 'ativar' then
      if not exists (select 1 from credito.disparo_contatos where disparo_id = v_id and status = 'na_fila') then v := jsonb_build_object('erro', 'Importe a lista antes de começar.');
      elsif coalesce(array_length(d.numeros, 1), 0) = 0 then v := jsonb_build_object('erro', 'Escolha pelo menos um número.');
      elsif jsonb_array_length(d.variacoes) = 0 and length(trim(d.mensagem)) < 15 then v := jsonb_build_object('erro', 'Escreva a mensagem antes de começar.');
      else update credito.disparos set status = 'ativo', iniciado_em = coalesce(iniciado_em, now()), encerrado_em = null where id = v_id; v := jsonb_build_object('aviso', 'Disparo começou'); end if;
    else
      update credito.disparos set status = case when p_acao = 'pausar' then 'pausado' else 'encerrado' end, encerrado_em = case when p_acao = 'encerrar' then now() end where id = v_id;
    end if;
  elsif p_acao = 'limpar_fila' and v_id is not null then
    delete from credito.disparo_contatos where disparo_id = v_id and status = 'na_fila';
    v := jsonb_build_object('aviso', 'Fila limpa');
  elsif p_acao = 'apagar' and v_id is not null then
    delete from credito.disparos where id = v_id and status in ('rascunho') and not exists (select 1 from credito.disparo_contatos where disparo_id = v_id and status = 'enviado');
    v_id := null;
  elsif p_acao = 'teste' and v_id is not null then
    select * into d from credito.disparos where id = v_id;
    if coalesce(nullif(p_dados->>'nome', ''), '') = '' then v := jsonb_build_object('erro', 'Escolha o número do teste.');
    elsif jsonb_array_length(d.variacoes) = 0 and length(trim(d.mensagem)) < 15 then v := jsonb_build_object('erro', 'Salve a mensagem antes de testar.');
    else
      insert into credito.envios_teste (instancia, numero, texto, extra)
      values (p_dados->>'nome', credito.config('avisos')->>'dono', credito.disparo_texto(v_id, 'Gustavo', null), d.extra);
      v := jsonb_build_object('aviso', 'Teste na fila: chega no seu WhatsApp em até 2 minutos');
    end if;
  elsif p_acao = 'gerar' then
    v := jsonb_build_object('gerar', jsonb_build_object('mensagem', left(coalesce(p_dados->>'mensagem', ''), 800)));
  end if;
  return (v || jsonb_build_object('atual', v_id,
    'disparos', (select coalesce(jsonb_agg(jsonb_build_object('id', d2.id, 'nome', d2.nome, 'status', d2.status, 'criado_em', d2.criado_em, 'iniciado_em', d2.iniciado_em,
                    'numeros', d2.numeros, 'intervalo_min', d2.intervalo_min, 'hora_inicio', d2.hora_inicio, 'hora_fim', d2.hora_fim, 'mensagem', d2.mensagem,
                    'variacoes', d2.variacoes, 'extra', d2.extra, 'resumo', credito.disparo_resumo(d2.id)) order by d2.id desc), '[]') from credito.disparos d2),
    'numeros', (select coalesce(jsonb_agg(jsonb_build_object('nome', n.nome, 'numero', n.numero, 'estado', n.estado, 'funcao', n.funcao, 'trava_ate', n.trava_ate,
                    'enviadas', (select count(*) from credito.disparo_contatos c where c.instancia = n.nome and c.enviado_em > now() - interval '24 hours')) order by n.nome), '[]')
                  from json_to_recordset(credito.wpp_numeros()) as n(nome text, numero text, estado text, funcao text, trava_ate timestamptz)),
    'contatos', case when v_id is null then '[]'::jsonb else (select coalesce(jsonb_agg(c order by c.ord, c.id desc), '[]') from (
        select dc.id, dc.nome, dc.telefone, dc.status, dc.instancia, dc.enviado_em, dc.erro, dc.lead_id,
               (select case when l.status_operacao = 'paid' then 'Pago' when coalesce(l.motivo_parada, '') like '%clicou em bloquear%' then 'Bloqueou'
                            when l.ofertas is not null then 'Recebeu proposta' when l.consult_id is not null then 'Simulou'
                            when l.instancia in (select nome from credito.wpp_chips where funcao = 'atendimento') then 'Chamou no atendimento'
                            when l.dt_respondeu is not null then 'Respondeu'
                            else coalesce((select case when cv.wpp_status in ('READ', 'PLAYED') then 'Lida' when cv.wpp_status = 'DELIVERY_ACK' then 'Entregue'
                                                       when cv.wpp_status = 'ERROR' or cv.erro_wpp is not null then 'Não entregue' when cv.enviado_wpp is null then 'Enviando' end
                                             from credito.conversas cv where cv.lead_id = l.id and cv.modo = 'campanha' order by cv.id desc limit 1), 'Enviada') end
                  from credito.leads l where l.id = dc.lead_id) situacao,
               case dc.status when 'enviado' then 0 when 'na_fila' then 1 else 2 end ord
          from credito.disparo_contatos dc where dc.disparo_id = v_id order by case dc.status when 'enviado' then 0 when 'na_fila' then 1 else 2 end, dc.id desc limit 400) c) end,
    'por_numero', case when v_id is null then '[]'::jsonb else (select coalesce(jsonb_agg(jsonb_build_object('nome', instancia, 'enviadas', env, 'responderam', resp, 'atendimento', atend, 'bloquearam', blq)), '[]') from (
        select dc.instancia, count(*) env, count(*) filter (where l.dt_respondeu is not null) resp,
               count(*) filter (where l.instancia in (select nome from credito.wpp_chips where funcao = 'atendimento')) atend,
               count(*) filter (where coalesce(l.motivo_parada, '') like '%clicou em bloquear%') blq
          from credito.disparo_contatos dc join credito.leads l on l.id = dc.lead_id where dc.disparo_id = v_id group by 1 order by 1) x) end,
    'testes', (select coalesce(jsonb_agg(t order by t.id desc), '[]') from (select id, instancia, criado_em, enviado_em, left(erro, 120) erro from credito.envios_teste order by id desc limit 3) t)))::json;
end $$;

-- versão que nunca derruba o ciclo de envio (erro no disparo não pode parar atendimento/avisos)
create or replace function credito.disparo_passo_seguro() returns int language plpgsql as $$
begin
  return credito.disparo_passo();
exception when others then
  raise warning 'disparo_passo: %', sqlerrm;
  return 0;
end $$;

-- liga o disparo no ciclo de envio e tira da campanha os números que estão num disparo ativo
create or replace function credito.mig053() returns void language plpgsql as $f$
begin
  if position('disparo_passo' in pg_get_functiondef('credito.wpp_pendentes2'::regproc)) = 0 then
    execute replace(pg_get_functiondef('credito.wpp_pendentes2'::regproc), 'perform credito.campanha_passo();', 'perform credito.campanha_passo(); perform credito.disparo_passo_seguro();');
  end if;
  if position('credito.disparos' in pg_get_functiondef('credito.campanha_instancias'::regproc)) = 0 then
    execute replace(pg_get_functiondef('credito.campanha_instancias'::regproc), 'where n.campanha and',
      'where n.campanha and not exists (select 1 from credito.disparos dd where dd.status = ''ativo'' and n.nome = any(dd.numeros)) and');
  end if;
end $f$;
select credito.mig053();
