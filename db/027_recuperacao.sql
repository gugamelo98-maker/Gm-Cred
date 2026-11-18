-- Empresa virtual CLT — recuperação (gerentes): tempos, horário, "não quero", "não contatar" e medição
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-10. Idempotente.
--
-- Regras:
--  * tentativas aos 20 min, 3 h e no dia seguinte (24 h) de silêncio; só entre 8h e 21h (horário de Brasília);
--  * a "condição melhor" (sem seguro) só é liberada na ÚLTIMA tentativa (dia seguinte);
--  * quem está com a consulta de CPF em andamento não recebe cobrança (quem deve resposta somos nós);
--  * quem disse "não quero" (encerrar) também entra: o gerente volta em 3 h perguntando o que pesou e,
--    no dia seguinte, oferece a condição melhor. Vale por até 3 dias. Sem margem não entra;
--  * quem pediu para não receber mensagens (encerrar com motivo "não contatar...") nunca mais é chamado;
--  * resultado do gerente: "respondeu" quando o cliente volta a falar; "recuperou" só quando ele avança uma etapa.

alter table credito.leads add column if not exists nao_contatar boolean not null default false;

update credito.configuracoes set valor = '{"tempos":[20,180,1440],"hora_inicio":8,"hora_fim":21}'::jsonb, atualizado_em = now() where chave = 'recuperacao';

do $do$
declare d text; a text; b text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='credito' and p.proname='fila_acompanhamento';
  if position('nao_contatar' in d) = 0 then
    a := $x$l.status not in ('parou', 'assinou') and not l.reprocessar$x$;
    if position(a in d) = 0 then raise exception 'fila: trecho não encontrado'; end if;
    b := $x$(l.status not in ('parou', 'assinou')
                          or (l.status = 'parou' and coalesce(l.motivo_parada, '') not ilike 'sem margem%' and l.ultima_interacao > now() - interval '3 days'))
                     and not l.nao_contatar and not l.reprocessar
                     and not (l.status = 'cpf_ok' and l.status_v8 in ('PROCESSANDO', 'WAITING_CONSULT', 'WAITING_CREDIT_ANALYSIS', 'CONSENT_APPROVED', 'WAITING_CONSENT', 'PROCESSING', 'PENDING'))
                     and extract(hour from now() at time zone 'America/Sao_Paulo') >= coalesce((credito.config('recuperacao')->>'hora_inicio')::int, 8)
                     and extract(hour from now() at time zone 'America/Sao_Paulo') < coalesce((credito.config('recuperacao')->>'hora_fim')::int, 21)$x$;
    execute replace(d, a, b);
  end if;
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='credito' and p.proname='acao_agente';
  if position('nao_contatar' in d) = 0 then
    a := $x$update credito.leads set status = 'parou', motivo_parada = left(coalesce(p_dados->>'motivo', 'cliente não quis'), 200) where id = l.id;$x$;
    if position(a in d) = 0 then raise exception 'encerrar: trecho não encontrado'; end if;
    b := $x$update credito.leads set status = 'parou', motivo_parada = left(coalesce(p_dados->>'motivo', 'cliente não quis'), 200),
           recuperacoes = 1, nao_contatar = nao_contatar or coalesce(p_dados->>'motivo', '') ~* 'n[aã]o contatar' where id = l.id;$x$;
    execute replace(d, a, b);
  end if;
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='credito' and p.proname='contexto_agente';
  if position('DISSE QUE NÃO QUER' in d) = 0 then
    a := $x$'- Nome: ' || coalesce(l.nome, 'ainda não sabemos'),$x$;
    if position(a in d) = 0 then raise exception 'contexto: trecho não encontrado'; end if;
    d := replace(d, a, a || $x$
    case when l.status = 'parou' then '- ATENÇÃO: o cliente DISSE QUE NÃO QUER continuar' || coalesce(' (motivo anotado: ' || l.motivo_parada || ')', '') || '.' end,$x$);
  end if;
  if position('Ele disse que NÃO QUER' in d) = 0 then
    a := $x$'[Instrução interna] O cliente parou de responder há um tempo. Mande a mensagem de retomada.'$x$;
    if position(a in d) = 0 then raise exception 'instrução de retomada não encontrada'; end if;
    d := replace(d, a, $x$(case when l.status = 'parou'
      then case when l.sem_seguro_liberado and v_sem is not null
        then '[Instrução interna] Ele disse que NÃO QUER. Esta é a última tentativa: em UMA mensagem curta e sem pressão, diga que conseguiu uma condição melhor para ele (use os valores de CONDIÇÃO MELHOR, sem falar em seguro) e pergunte se quer dar uma olhada.'
        else '[Instrução interna] Ele disse que NÃO QUER. Em UMA mensagem curta: diga que respeita a decisão e pergunte, com leveza, o que pesou (o valor da parcela, o prazo, o valor liberado, alguma desconfiança ou só o momento), dizendo que talvez consiga ajustar. Não repita a oferta, não diga que você sumiu e não pergunte se pode ajudar em mais alguma coisa.' end
      else '[Instrução interna] O cliente parou de responder há um tempo. Mande a mensagem de retomada.' end)$x$);
  end if;
  execute d;
end $do$;

create or replace function credito.fn_marcar_recuperacao() returns trigger language plpgsql as $function$
begin
  if new.direcao = 'entrada' then
    update credito.atribuicoes set resultado = 'respondeu', fim = now()
     where lead_id = new.lead_id and setor_id = 'gerente' and resultado is null
       and (select modo from credito.conversas c where c.lead_id = new.lead_id and c.direcao = 'saida' and c.id < new.id order by c.id desc limit 1) = 'recuperar';
    update credito.leads set recuperacoes = 0 where id = new.lead_id and recuperacoes > 0;
  end if;
  return new;
end $function$;

create or replace function credito.fn_atribuicoes_resultado() returns trigger language plpgsql as $function$
begin
  if new.setor_id is distinct from old.setor_id then
    update credito.atribuicoes set resultado = 'avancou', fim = now()
     where lead_id = new.id and setor_id = old.setor_id and resultado is null;
  end if;
  if new.status = 'parou' and old.status is distinct from 'parou' then
    update credito.atribuicoes set resultado = 'perdeu', fim = now()
     where lead_id = new.id and setor_id = new.setor_id and resultado is null;
  end if;
  if new.status <> 'parou' and ((new.setor_id is distinct from old.setor_id)
      or (old.cpf_informado is null and new.cpf_informado is not null) or (old.ofertas is null and new.ofertas is not null)
      or (old.oferta is null and new.oferta is not null) or (old.pix is null and new.pix is not null)
      or (old.operation_id is null and new.operation_id is not null) or (old.dt_assinou is null and new.dt_assinou is not null)) then
    update credito.atribuicoes set resultado = 'recuperou', fim = now()
     where lead_id = new.id and setor_id = 'gerente' and resultado = 'respondeu';
  end if;
  return new;
end $function$;

update credito.setores set prompt = prompt || E'\n- Se nos DADOS DO CLIENTE aparecer que ele DISSE QUE NÃO QUER: não repita a oferta e não insista. Diga em uma frase que respeita a decisão e pergunte, com leveza, o que pesou (o valor da parcela, o prazo, o valor liberado, alguma desconfiança ou só o momento), dizendo que talvez consiga ajustar. Uma pergunta só, sem pressão.'
where id = 'gerente' and prompt not like '%DISSE QUE NÃO QUER%';

update credito.configuracoes set valor = to_jsonb((valor #>> '{}') || E'\n- NÃO CONTATAR: se o cliente pedir para não receber mais mensagens (ex.: "para de me mandar mensagem", "me tira da lista", "não me chama mais"), peça desculpas em uma frase e chame encerrar com o motivo começando por "não contatar". Ele não receberá mais nenhuma mensagem.'::text), atualizado_em = now()
where chave = 'regras_gerais' and (valor #>> '{}') not like '%- NÃO CONTATAR:%';

-- (no n8n, GM Cred · Agente: a trava que barra "condição melhor" sem liberação agora pega variações
--  como "condição um pouco melhor" e não repete a pergunta do motivo se ela já foi feita)
