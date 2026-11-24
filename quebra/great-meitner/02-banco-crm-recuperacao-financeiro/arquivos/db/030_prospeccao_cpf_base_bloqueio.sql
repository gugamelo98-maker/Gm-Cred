-- Empresa virtual CLT — Prospecção, CPF da base, número errado, atendente humano no WhatsApp e ajustes da recuperação
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-10. Idempotente.
--  * PROSPECÇÃO: o lead da campanha nasce no setor "prospeccao" (agente Duda). Quando o cliente responde, vai para a Recepção.
--    Quem nunca respondeu não conta em Atendendo, Parados, Entraram, Funil, Vendas nem Clientes, e não recebe recuperação.
--  * CPF DA BASE: o CPF importado fica em leads.cpf_base (não conta como "mandou CPF"). A Recepção confirma com o cliente
--    pelos 3 primeiros ou 3 últimos dígitos e só então consulta; se não for dele, pede o CPF.
--  * NÚMERO ERRADO: encerrar com motivo "número errado" (ou "não contatar") bloqueia o telefone em credito.numeros_bloqueados
--    (com a observação "não é o cliente"), tira da fila da campanha e a importação nunca mais traz esse número.
--  * ATENDENTE HUMANO: mensagem enviada pelo celular da campanha entra no histórico (modo "humano") e a IA pausa aquele
--    cliente por 2 h (configuracoes.atendente.pausa_min). Depois volta sabendo o que o atendente falou.
--  * RECUPERAÇÃO: não recupera motivo definitivo (já tem empréstimo, número errado, não é CLT...) e não fala de
--    valores/condições para quem ainda não recebeu proposta.

insert into credito.setores (id, nome, descricao, cor, ordem, sla_minutos, ativo, prompt)
values ('prospeccao', 'Prospecção', 'Chama os clientes da campanha; quando o cliente responde, ele vai para a Recepção', '#8a6fd1', 0, null, true,
        'ETAPA: PROSPECÇÃO. Primeira mensagem da campanha.')
on conflict (id) do nothing;
insert into credito.agentes (nome, setor_id, papel, avatar, status, modelo, prompt, versao, abordagem, peso, ativo)
select 'Duda', 'prospeccao', 'Prospectora', '{"pele":"#e0ac69","cabelo":"#5a3825"}', 'livre', 'google/gemini-2.5-flash',
       'Envia a primeira mensagem da campanha.', 'A', 'Primeira mensagem da campanha', 1, true
where not exists (select 1 from credito.agentes where setor_id = 'prospeccao');

alter table credito.leads add column if not exists cpf_base text;
alter table credito.leads add column if not exists humano_em timestamptz;
create table if not exists credito.numeros_bloqueados (
  telefone text primary key, motivo text, observacao text, lead_id int, criado_em timestamptz not null default now());
insert into credito.configuracoes (chave, valor) values ('atendente', '{"pausa_min":120}'::jsonb) on conflict (chave) do nothing;

create or replace function credito.motivo_definitivo(m text) returns boolean language sql immutable as $$
  select coalesce(m, '') ~* '(j[aá] (tenho|tem|fiz|fez|possui|peguei|pegou|contratei|contratou)|n[uú]mero errado|n[aã]o [eé] (o|a) (cliente|pessoa)|n[aã]o contatar|n[aã]o (trabalho|trabalha|sou|é) (de )?(clt|carteira)|aposentad|falec|definitivo)' $$;

-- bloqueio automático: não contatar / número errado
create or replace function credito.fn_bloquear_numero() returns trigger language plpgsql as $function$
begin
  if new.nao_contatar and not coalesce(old.nao_contatar, false) then
    insert into credito.numeros_bloqueados (telefone, motivo, observacao, lead_id)
    values (regexp_replace(new.telefone, '\D', '', 'g'), new.motivo_parada,
            case when coalesce(new.motivo_parada, '') ~* 'n[uú]mero errado' then 'não é o cliente ' || coalesce(new.nome, '') end, new.id)
    on conflict (telefone) do nothing;
    update credito.campanha_contatos set status = 'removido', erro = left(coalesce(new.motivo_parada, 'não contatar'), 200)
     where telefone = regexp_replace(new.telefone, '\D', '', 'g') and status = 'na_fila';
  end if;
  return new;
end $function$;
create or replace trigger trg_bloquear_numero after update of nao_contatar on credito.leads for each row execute function credito.fn_bloquear_numero();

-- mensagem que o atendente mandou pelo celular (fromMe). Eco do que o próprio sistema enviou é ignorado.
create or replace function credito.receber_humano_wpp(p_tel text, p_texto text) returns json language plpgsql as $function$
declare t text := credito.tel_lead(regexp_replace(coalesce(p_tel, ''), '\D', '', 'g')); v_lead credito.leads%rowtype;
begin
  if length(t) < 12 or coalesce(trim(p_texto), '') = '' then return null; end if;
  select * into v_lead from credito.leads where telefone = t order by criado_em desc limit 1;
  if v_lead.id is null then return null; end if;
  if exists (select 1 from credito.conversas where lead_id = v_lead.id and direcao = 'saida' and criado_em > now() - interval '30 minutes'
              and regexp_replace(conteudo, '\s', '', 'g') = regexp_replace(left(p_texto, 2000), '\s', '', 'g')) then
    return json_build_object('eco', true);
  end if;
  insert into credito.conversas (lead_id, agente_id, direcao, conteudo, setor_id, modo, enviado_wpp)
  values (v_lead.id, null, 'saida', left(p_texto, 2000), v_lead.setor_id, 'humano', now());
  update credito.leads set aguardando = 'humano', humano_em = now(), ultima_interacao = now(),
         setor_id = case when setor_id = 'prospeccao' then 'recepcao' else setor_id end where id = v_lead.id;
  return json_build_object('humano', true, 'lead', v_lead.id);
end $function$;

create or replace function credito.patch_030() returns void language plpgsql as $do$
declare d text; a text;
begin
  -- situação: prospecção que não respondeu é um grupo à parte
  d := pg_get_functiondef('credito.situacao_lead(credito.leads)'::regprocedure);
  if position('prospeccao' in d) = 0 then
    a := $x$select case
    when l.operation_id$x$;
    if position(a in d) = 0 then raise exception 'situacao: trecho não encontrado'; end if;
    execute replace(d, a, $x$select case
    when l.setor_id = 'prospeccao' then '{"t":"Prospecção · não respondeu","g":"prospeccao","e":0}'
    when l.operation_id$x$);
  end if;

  -- campanha: nasce na prospecção, CPF vai para cpf_base, pula bloqueados
  d := pg_get_functiondef('credito.wpp_pendentes()'::regprocedure);
  if position('cpf_base' in d) = 0 then
    foreach a in array array['teste, cpf_informado, aguardando', $x$'disparado', 'recepcao'$x$, $x$atribuir_agente(v_lead, 'recepcao')$x$, $x$'recepcao', 'campanha'$x$, $x$where status = 'na_fila' order by id$x$] loop
      if position(a in d) = 0 then raise exception 'wpp_pendentes: % não encontrado', a; end if;
    end loop;
    d := replace(d, 'teste, cpf_informado, aguardando', 'teste, cpf_base, aguardando');
    d := replace(d, $x$'disparado', 'recepcao'$x$, $x$'disparado', 'prospeccao'$x$);
    d := replace(d, $x$atribuir_agente(v_lead, 'recepcao')$x$, $x$atribuir_agente(v_lead, 'prospeccao')$x$);
    d := replace(d, $x$'recepcao', 'campanha'$x$, $x$'prospeccao', 'campanha'$x$);
    d := replace(d, $x$where status = 'na_fila' order by id$x$, $x$where status = 'na_fila' and not exists (select 1 from credito.numeros_bloqueados b where b.telefone = campanha_contatos.telefone) order by id$x$);
    execute d;
  end if;

  -- importação ignora números bloqueados
  d := pg_get_functiondef('credito.campanha_api'::regproc);
  if position('numeros_bloqueados' in d) = 0 then
    a := $x$or exists (select 1 from credito.leads where$x$;
    if position(a in d) = 0 then raise exception 'campanha_api: trecho não encontrado'; end if;
    execute replace(d, a, $x$or exists (select 1 from credito.numeros_bloqueados b where b.telefone in (v_tel, credito.tel_lead(v_tel))) $x$ || a);
  end if;

  -- cliente respondeu: sai da prospecção para a recepção; pausa do atendente humano vence
  d := pg_get_functiondef('credito.receber_mensagem(text,text,text,integer,text)'::regprocedure);
  if position('prospeccao' in d) = 0 then
    a := $x$    update credito.leads set ultima_interacao = now(),$x$;
    if position(a in d) = 0 then raise exception 'receber_mensagem: trecho não encontrado'; end if;
    execute replace(d, a, $x$    if v_lead.setor_id = 'prospeccao' then
      update credito.atribuicoes set resultado = 'avancou', fim = now() where lead_id = v_lead.id and setor_id = 'prospeccao' and fim is null;
      update credito.leads set setor_id = 'recepcao', entrou_setor_em = now() where id = v_lead.id;
    end if;
    if v_lead.aguardando = 'humano' and v_lead.humano_em is not null
       and v_lead.humano_em < now() - make_interval(mins => coalesce((credito.config('atendente')->>'pausa_min')::int, 120)) then
      update credito.leads set aguardando = 'agente', humano_em = null where id = v_lead.id;
      v_lead.aguardando := 'agente';
    end if;
$x$ || a);
  end if;

  -- encerrar: número errado também vira "não contatar" (e o gatilho bloqueia o telefone)
  d := pg_get_functiondef('credito.acao_agente'::regproc);
  if position('mero errado' in d) = 0 then
    a := $x$~* 'n[aã]o contatar' where id = l.id;$x$;
    if position(a in d) = 0 then raise exception 'encerrar: trecho não encontrado'; end if;
    execute replace(d, a, $x$~* '(n[aã]o contatar|n[uú]mero errado)' where id = l.id;$x$);
  end if;

  -- fila da recuperação: só quem respondeu, fora da prospecção, sem motivo definitivo
  d := pg_get_functiondef('credito.fila_acompanhamento()'::regprocedure);
  if position('motivo_definitivo' in d) = 0 then
    a := 'and not l.nao_contatar';
    if position(a in d) = 0 then raise exception 'fila: trecho não encontrado'; end if;
    execute replace(d, a, a || $x$ and l.setor_id <> 'prospeccao' and l.dt_respondeu is not null and not credito.motivo_definitivo(l.motivo_parada)$x$);
  end if;

  -- contexto do agente: CPF da base, atendente humano, recuperação sem inventar oferta
  d := pg_get_functiondef('credito.contexto_agente'::regproc);
  if position('cpf_base' in d) = 0 then
    a := $x$'- CPF: ' || case when l.cpf_informado is null then 'ainda não informado' else$x$;
    if position(a in d) = 0 then raise exception 'contexto cpf: trecho não encontrado'; end if;
    d := replace(d, a, $x$'- CPF: ' || case when l.cpf_informado is null and l.cpf_base is not null then
      'o cliente ainda NÃO confirmou. CPF que temos na nossa base: ' || l.cpf_base || ' (NUNCA escreva o número inteiro para o cliente). '
      || 'Peça para ele confirmar mostrando só o começo ou o fim, ex.: "Seu CPF começa com ' || left(l.cpf_base, 3) || ' e termina com ' || right(l.cpf_base, 3)
      || ', certo?". Se ele confirmar, chame consultar_cpf com esse CPF. Se disser que não é o dele, peça o CPF.'
      when l.cpf_informado is null then 'ainda não informado' else$x$);
    a := $x$'- Nome: ' || coalesce(l.nome, 'ainda não sabemos'),$x$;
    if position(a in d) = 0 then raise exception 'contexto nome: trecho não encontrado'; end if;
    d := replace(d, a, a || $x$
    case when l.humano_em is not null then '- ATENÇÃO: um atendente da equipe entrou nesta conversa pelo celular (as mensagens dele aparecem como suas). Continue de onde ele parou, respeite o que ele combinou e não repita perguntas que ele já fez.' end,$x$);
    a := $x$'[Instrução interna] O cliente parou de responder há um tempo. Mande a mensagem de retomada.'$x$;
    if position(a in d) = 0 then raise exception 'contexto retomada: trecho não encontrado'; end if;
    d := replace(d, a, a || $x$ || case when l.ofertas is null then ' Ele ainda NÃO recebeu nenhuma proposta: não fale de valores, ofertas, parcelas nem "condição melhor".' else '' end$x$);
    a := $x$'[Instrução interna] Ele disse que NÃO QUER. Em UMA mensagem curta: diga que respeita a decisão e pergunte$x$;
    if position(a in d) = 0 then raise exception 'contexto não quer: trecho não encontrado'; end if;
    d := replace(d, a, $x$case when l.ofertas is null then '[Instrução interna] Ele disse que NÃO QUER e ainda não viu proposta. Em UMA mensagem curta: diga que respeita e pergunte, com leveza, por que não tem interesse agora (já tem empréstimo, não precisa no momento, desconfiança...). NÃO fale de parcela, prazo, valores nem condições.' else $x$ || a);
    -- fecha o case aberto acima: a instrução original termina antes do "else '[Instrução interna] O cliente parou"
    a := $x$
      else '[Instrução interna] O cliente parou de responder há um tempo.$x$;
    if position(a in d) = 0 then raise exception 'contexto fecha case: trecho não encontrado'; end if;
    d := replace(d, a, ' end' || a);
    execute d;
  end if;
end $do$;
select credito.patch_030();


-- regras gerais: número errado
update credito.configuracoes set valor = to_jsonb((valor #>> '{}') || E'\n- NÚMERO ERRADO: se a pessoa disser que não é o cliente (ex.: "não sou o Sebastião", "número errado", "não conheço essa pessoa"), peça desculpas em uma frase, NÃO chame a pessoa pelo nome do cadastro e chame encerrar com o motivo começando por "número errado".'), atualizado_em = now()
where chave = 'regras_gerais' and (valor #>> '{}') not like '%- NÚMERO ERRADO:%';

-- dados que já existiam: CPF importado vira cpf_base; quem nunca respondeu volta para a prospecção
update credito.leads l set cpf_base = l.cpf_informado, cpf_informado = null,
       status = case when l.status = 'cpf_ok' then 'respondeu' else l.status end
  from credito.campanha_contatos c
 where c.lead_id = l.id and l.consult_id is null and l.cpf_informado is not null and l.cpf_base is null;
update credito.leads l set setor_id = 'prospeccao', aguardando = 'cliente'
  from credito.campanha_contatos c
 where c.lead_id = l.id and l.dt_respondeu is null and l.setor_id = 'recepcao' and l.status = 'disparado';

create or replace view credito.v_resumo_hoje as
 with d as (select (date_trunc('day', (now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo') as ini),
      l as (select * from credito.leads x where (credito.ver_teste() or not coalesce(x.teste, false)) and x.setor_id <> 'prospeccao')
 select (select count(*) from l, d where l.criado_em >= d.ini) as entraram_hoje,
        (select count(*) from credito.leads x where credito.no_escritorio(x)) as em_andamento,
        (select count(*) from l, d where l.dt_assinou >= d.ini) as fecharam_hoje,
        (select coalesce(sum(l.comissao), 0::numeric) from l, d where l.dt_assinou >= d.ini) as comissao_hoje,
        (select coalesce(sum(l.valor), 0::numeric) from l, d where l.dt_assinou >= d.ini) as volume_hoje,
        (select count(*) from credito.v_leads_parados) as parados,
        (select count(*) from l, d where l.status = 'parou' and l.atualizado_em >= d.ini) as perdidos_hoje;

create or replace view credito.v_funil_30d as
 with l as (select * from credito.leads x where x.criado_em >= now() - interval '30 days' and (credito.ver_teste() or not coalesce(x.teste, false)) and x.setor_id <> 'prospeccao')
 select (select count(*) from l) as entraram,
        (select count(*) from l where l.cpf_informado is not null or l.consult_id is not null) as enviaram_cpf,
        (select count(*) from l where l.dt_simulou is not null or l.ofertas is not null) as com_margem,
        (select count(*) from l where l.operation_id is not null or l.dt_proposta is not null) as receberam_proposta,
        (select count(*) from l where l.dt_assinou is not null and credito.etapa_contrato(l.status_operacao) <> 'cancelado') as assinaram,
        (select count(*) from l where l.operation_id is not null and credito.etapa_contrato(l.status_operacao) = 'pago') as pagos,
        coalesce((select json_agg(m.* order by m.total desc) from (
            select coalesce(nullif(trim(l.motivo_parada), ''), 'Sem motivo informado') as motivo, count(*) as total
              from l where l.status = 'parou' group by 1 order by count(*) desc limit 5) m), '[]'::json) as motivos_perda,
        (select count(*) from l where l.status = 'parou') as perdidos,
        (select count(*) from l where l.oferta is not null or l.operation_id is not null) as escolheram;

create or replace function credito.vendas_diarias() returns json language sql stable as $function$
 with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
 dias as (select generate_series((select d from hoje) - 61, (select d from hoje), interval '1 day')::date as dia),
 l as (select (criado_em at time zone 'America/Sao_Paulo')::date as dia, count(*) as n from credito.leads where (credito.ver_teste() or not coalesce(teste, false)) and setor_id <> 'prospeccao' group by 1),
 dg as (select (criado_em at time zone 'America/Sao_Paulo')::date as dia, count(*) as n from credito.contratos where coalesce(etapa,'')<>'cancelado' group by 1),
 pg as (select (dt_pagamento at time zone 'America/Sao_Paulo')::date as dia, count(*) as n, sum(valor_liberado) as v, sum(comissao) as c
          from credito.contratos where etapa='pago' and dt_pagamento is not null group by 1)
 select coalesce(json_agg(json_build_object(
          'dia', dias.dia, 'clientes', coalesce(l.n,0), 'digitados', coalesce(dg.n,0),
          'pagos', coalesce(pg.n,0), 'liberado', coalesce(pg.v,0), 'comissao', coalesce(pg.c,0)) order by dias.dia), '[]'::json)
 from dias left join l on l.dia=dias.dia left join dg on dg.dia=dias.dia left join pg on pg.dia=dias.dia
$function$;


-- Aplicado também: credito.crm_clientes() sem os leads da prospecção (mesmo replace do filtro de testes),
-- Karpov (lead 112) encerrado como "número errado" e bloqueado.
-- n8n "GM Cred · WhatsApp (entrada)": o nó Mensagem aceita fromMe (eu = true) e o nó Receber chama
-- credito.receber_humano_wpp quando a mensagem foi enviada pelo celular do atendente (responder fica falso).
