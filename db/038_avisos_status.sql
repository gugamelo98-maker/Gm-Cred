-- Empresa virtual CLT — avisos no celular do dono + status real dos números
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-11. Idempotente.
--  * Avisos (credito.avisos) mandados pelo WhatsApp para configuracoes.avisos.numero, pela instância avisos.instancia:
--      🙋 cliente pediu um atendente (a IA passou para humano)  |  ✍️ contrato assinado  |  ✅ contrato pago
--    Saem junto com as mensagens normais: credito.wpp_pendentes2() = wpp_pendentes() + avisos (id negativo);
--    credito.wpp_marcar() também marca os avisos (id negativo).
--  * wpp_numeros(): a Evolution às vezes mantém "open" no banco depois de cair. Código 401/402/403 nos últimos 3 dias
--    passa a contar como caído/restrito. (11/11: gmcred-2 levou 403 ao tentar criar um grupo — número novo criando grupo
--    é gatilho de restrição. Não criar grupos por número novo.)
create table if not exists credito.avisos (id bigserial primary key, texto text not null, criado_em timestamptz not null default now(),
  enviado_em timestamptz, erro text);
insert into credito.configuracoes (chave, valor) values ('avisos', '{"numero":"5548996077545","instancia":"gmcred-3","ativo":true}'::jsonb)
on conflict (chave) do nothing;

create or replace function credito.avisar(p_txt text) returns void language sql as $$
  insert into credito.avisos (texto) select p_txt where coalesce((credito.config('avisos')->>'ativo')::boolean, true) $$;

create or replace function credito.fn_avisos_lead() returns trigger language plpgsql as $function$
begin
  if coalesce(new.teste, false) then return new; end if;
  if new.aguardando = 'humano' and old.aguardando is distinct from 'humano' and new.humano_em is null then
    perform credito.avisar('🙋 Cliente quer falar com um atendente: ' || coalesce(new.nome, 'sem nome') || ' · ' || new.telefone
      || coalesce(' · ' || nullif(new.motivo_parada, ''), '') || E'\nAbra o painel na aba Conversas.');
  end if;
  if new.dt_assinou is not null and old.dt_assinou is null then
    perform credito.avisar('✍️ Contrato ASSINADO: ' || coalesce(new.nome, 'cliente') || ' · ' || new.telefone
      || coalesce(' · R$ ' || to_char(coalesce((new.oferta->>'valor')::numeric, new.valor), 'FM999G999D00'), ''));
  end if;
  return new;
end $function$;
create or replace trigger trg_avisos_lead after update of aguardando, dt_assinou on credito.leads for each row execute function credito.fn_avisos_lead();

create or replace function credito.fn_avisos_contrato() returns trigger language plpgsql as $function$
begin
  if new.etapa = 'pago' and (tg_op = 'INSERT' or old.etapa is distinct from 'pago') then
    perform credito.avisar('✅ Contrato PAGO: ' || coalesce((select nome from credito.leads where id = new.lead_id), 'cliente')
      || coalesce(' · liberado R$ ' || to_char(new.valor_liberado, 'FM999G999D00'), '') || coalesce(' · comissão R$ ' || to_char(new.comissao, 'FM999G999D00'), ''));
  end if;
  return new;
end $function$;
create or replace trigger trg_avisos_contrato after insert or update of etapa on credito.contratos for each row execute function credito.fn_avisos_contrato();

create or replace function credito.wpp_pendentes2() returns json language plpgsql as $function$
declare p jsonb := credito.wpp_pendentes()::jsonb; c jsonb := credito.config('avisos'); a jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id', -v.id, 'numero', c->>'numero', 'texto', v.texto, 'instancia', c->>'instancia',
           'apikey', (select i.token from public."Instance" i where i.name = c->>'instancia')) order by v.id), '[]'::jsonb)
    into a from (select * from credito.avisos where enviado_em is null and erro is null and criado_em > now() - interval '6 hours' order by id limit 5) v;
  return (p || jsonb_build_object('msgs', coalesce(p->'msgs', '[]'::jsonb) || a))::json;
end $function$;

create or replace function credito.wpp_marcar(p_id bigint) returns void language sql as $$
  update credito.conversas set enviado_wpp = now() where id = p_id;
  update credito.avisos set enviado_em = now() where id = -p_id $$;

create or replace function credito.patch_038() returns text language plpgsql as $f$
declare d text := pg_get_functiondef('credito.wpp_numeros()'::regprocedure); a text := $x$'situacao', case when i."connectionStatus" = 'open' then 'Conectado'$x$;
begin
  if position('interval ''3 days''' in d) > 0 then return 'ja'; end if;
  if position(a in d) = 0 then raise exception 'wpp_numeros: trecho não encontrado'; end if;
  d := replace(d, a, $x$'situacao', case when i."disconnectionReasonCode" in (403, 402) and i."disconnectionAt" > now() - interval '3 days' then 'Restringido / banido pelo WhatsApp'
                       when i."disconnectionReasonCode" = 401 and i."disconnectionAt" > now() - interval '3 days' then 'Desconectado no celular (ou banido)'
                       when i."connectionStatus" = 'open' then 'Conectado'$x$);
  d := replace(d, $x$'estado', i."connectionStatus"$x$, $x$'estado', case when i."disconnectionReasonCode" in (401, 402, 403) and i."disconnectionAt" > now() - interval '3 days' then 'close' else i."connectionStatus" end$x$);
  execute d;
  return 'ok';
end $f$;
select credito.patch_038();
