-- Empresa virtual CLT — números sem WhatsApp na campanha
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-11. Idempotente.
--  * Antes de entrar na vez, cada contato da fila é conferido na Evolution (/chat/whatsappNumbers, até 50 por minuto).
--    Sem WhatsApp -> status "erro" ("Número sem WhatsApp") e o número vai para numeros_bloqueados. A campanha só
--    manda para quem foi conferido, então não perde a vaga de 5 min com número sem WhatsApp.
--  * Se mesmo assim o envio falhar com "exists:false", credito.wpp_falhou() faz o mesmo e encerra o lead
--    (Finalizado · Sem WhatsApp). Outras falhas ficam anotadas em conversas.erro_wpp.
alter table credito.campanha_contatos add column if not exists wpp_verificado timestamptz;
alter table credito.conversas add column if not exists erro_wpp text;
update credito.campanha_contatos set wpp_verificado = coalesce(enviado_em, now()) where status = 'enviado' and wpp_verificado is null;

create or replace function credito.wpp_a_verificar() returns json language sql stable as $$
  select json_build_object('url', 'https://rarelookingorca-evolution.cloudfy.live', 'instancia', c->>'instancia',
    'apikey', (select i.token from public."Instance" i where i.name = c->>'instancia'),
    'numeros', coalesce((select json_agg(telefone) from (select telefone from credito.campanha_contatos
        where status = 'na_fila' and wpp_verificado is null order by id limit 50) x), '[]'::json))
  from (select credito.config('campanha') c) y $$;

create or replace function credito.sem_whatsapp(p_tel text) returns void language plpgsql as $function$
declare t text := regexp_replace(coalesce(p_tel, ''), '\D', '', 'g');
begin
  update credito.campanha_contatos set status = 'erro', erro = 'Número sem WhatsApp', wpp_verificado = now()
   where telefone = t and status in ('na_fila', 'enviado');
  insert into credito.numeros_bloqueados (telefone, motivo, observacao) values (t, 'sem whatsapp', 'número não tem WhatsApp')
  on conflict (telefone) do nothing;
  update credito.leads set status = 'parou', motivo_parada = 'sem whatsapp: número não tem WhatsApp', aguardando = 'cliente'
   where regexp_replace(telefone, '\D', '', 'g') = t and dt_respondeu is null and status <> 'parou';
end $function$;

create or replace function credito.wpp_verificados(p jsonb) returns int language plpgsql as $function$
declare x jsonb; n int := 0;
begin
  for x in select * from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) loop
    if (x->>'exists')::boolean is false then
      perform credito.sem_whatsapp(x->>'number'); n := n + 1;
    elsif (x->>'exists')::boolean then
      update credito.campanha_contatos set wpp_verificado = now() where telefone = regexp_replace(x->>'number', '\D', '', 'g') and wpp_verificado is null;
    end if;
  end loop;
  return n;
end $function$;

create or replace function credito.wpp_falhou(p_id bigint, p_resp text) returns void language plpgsql as $function$
declare v_tel text;
begin
  select l.telefone into v_tel from credito.conversas c join credito.leads l on l.id = c.lead_id where c.id = p_id;
  if coalesce(p_resp, '') ~* '"exists"\s*:\s*false' then
    update credito.conversas set erro_wpp = 'sem whatsapp' where lead_id = (select lead_id from credito.conversas where id = p_id) and enviado_wpp is null;
    perform credito.sem_whatsapp(v_tel);
  else
    update credito.conversas set erro_wpp = left(coalesce(p_resp, 'falha'), 300) where id = p_id and erro_wpp is null;
  end if;
end $function$;

-- etiqueta "Sem WhatsApp"
create or replace function credito.etiqueta_de(m text) returns text language sql immutable as $$
  select case
    when coalesce(m, '') ~* '^sem margem' then 'Sem margem'
    when coalesce(m, '') ~* '^sem whatsapp' then 'Sem WhatsApp'
    when coalesce(m, '') ~* 'n[uú]mero errado|n[aã]o [eé] (o|a) (cliente|pessoa)' then 'Número errado'
    when coalesce(m, '') ~* 'n[aã]o contatar' then 'Não contatar'
    when coalesce(m, '') ~* '(j[aá] (tenho|tem|fiz|fez|possui|peguei|pegou|consegui|conseguiu|contratei|contratou|estou pagando))|empr[eé]stimo ativo|estou pagando' then 'Já tem empréstimo'
    else 'Sem interesse' end $$;

create or replace function credito.patch_034() returns text language plpgsql as $f$
declare d text := pg_get_functiondef('credito.wpp_pendentes()'::regprocedure); a text;
begin
  if position('wpp_verificado' in d) > 0 then return 'ja'; end if;
  a := $x$where status = 'na_fila' and not exists$x$;
  if position(a in d) = 0 then raise exception 'wpp_pendentes: fila não encontrada'; end if;
  d := replace(d, a, $x$where status = 'na_fila' and wpp_verificado is not null and not exists$x$);
  a := $x$where direcao = 'saida' and enviado_wpp is null and criado_em$x$;
  if position(a in d) = 0 then raise exception 'wpp_pendentes: msgs não encontrado'; end if;
  d := replace(d, a, $x$where direcao = 'saida' and enviado_wpp is null and coalesce(erro_wpp, '') <> 'sem whatsapp' and criado_em$x$);
  execute d;
  return 'ok';
end $f$;
select credito.patch_034();

-- Osmar e Geraldo (conferidos em 11/11: sem WhatsApp)
select credito.sem_whatsapp('5569999653030'), credito.sem_whatsapp('5547997043428');
update credito.conversas set erro_wpp = 'sem whatsapp' where enviado_wpp is null and erro_wpp is null
   and lead_id in (select id from credito.leads where telefone in ('5569999653030', '5547997043428'));

-- 11/11 (ajuste de segurança contra banimento): credito.wpp_a_verificar() passou a conferir só o PRÓXIMO da fila,
-- só com a campanha ligada e dentro do horário, e só quando não há nenhum já conferido esperando a vez
-- (= no máximo 1 consulta a cada envio, no mesmo ritmo de 5 min). Antes eram até 50 por minuto.
