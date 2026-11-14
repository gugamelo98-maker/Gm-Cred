-- 051: função de cada número (atendimento / disparo / reserva), botão "Chamar no atendimento" (wa.me)
--      e origem do cliente: telefone batendo com a lista de enviados (principal) ou assinatura no texto (reserva)
alter table credito.wpp_chips add column if not exists funcao text not null default 'disparo';
alter table credito.leads add column if not exists origem text;
update credito.wpp_chips set funcao = 'atendimento', campanha = false where nome = 'gmcred-campanha';
update credito.wpp_chips set funcao = 'reserva' where nome = 'gmcred-6';
insert into credito.configuracoes (chave, valor) values ('disparo', '{"assinatura":"Oi! Quero *simular* meu crédito CLT 😊","marca":"*simular*"}')
  on conflict (chave) do nothing;

create or replace function credito.urlenc(t text) returns text language sql immutable as $$
  select string_agg(case when b between 48 and 57 or b between 65 and 90 or b between 97 and 122 or b in (45, 46, 95, 126) then chr(b) else '%' || upper(lpad(to_hex(b), 2, '0')) end, '' order by i)
    from (select get_byte(convert_to(coalesce(t, ''), 'UTF8'), i) b, i from generate_series(0, octet_length(convert_to(coalesce(t, ''), 'UTF8')) - 1) i) x $$;

create or replace function credito.link_atendimento() returns text language sql stable as $$
  select 'https://wa.me/' || split_part(i."ownerJid", '@', 1) || '?text=' || credito.urlenc(credito.config('disparo')->>'assinatura')
    from credito.wpp_chips c join credito.v_instancias i on i.name = c.nome
   where c.funcao = 'atendimento' and coalesce(i."ownerJid", '') <> '' order by c.nome limit 1 $$;

create or replace function credito.wpp_extra(x jsonb, p_botoes boolean) returns jsonb language plpgsql stable as $$
declare e jsonb := x->'extra'; v_links text; v_at text := credito.link_atendimento();
begin
  if e is null or jsonb_typeof(e) <> 'object' or coalesce(jsonb_array_length(e->'botoes'), 0) = 0 then return x - 'extra'; end if;
  if coalesce(p_botoes, false) then
    return (x - 'extra') || jsonb_build_object('interativo', jsonb_strip_nulls(jsonb_build_object(
      'headerImage', case when coalesce(e->>'imagem', '') <> '' then jsonb_build_object('mimetype', 'image/jpeg', 'filename', 'gmcred.jpg', 'url', e->>'imagem') end,
      'body', x->>'texto', 'footer', nullif(e->>'rodape', ''),
      'buttons', (select jsonb_agg(case when b->>'tipo' = 'link' then jsonb_build_object('type', 'url', 'text', b->>'texto', 'url', b->>'url')
                                        when b->>'tipo' = 'atendimento' then jsonb_build_object('type', 'url', 'text', b->>'texto', 'url', v_at)
                                        else jsonb_build_object('type', 'reply', 'id', 'b' || o, 'text', b->>'texto') end order by o)
                    from jsonb_array_elements(e->'botoes') with ordinality t(b, o) where b->>'tipo' <> 'atendimento' or v_at is not null))));
  end if;
  select string_agg('👉 ' || (b->>'texto') || ': ' || case when b->>'tipo' = 'atendimento' then split_part(v_at, '?', 1) else b->>'url' end, E'\n' order by o) into v_links
    from jsonb_array_elements(e->'botoes') with ordinality t(b, o) where b->>'tipo' = 'link' or (b->>'tipo' = 'atendimento' and v_at is not null);
  return (x - 'extra') || jsonb_build_object('texto', (x->>'texto') || coalesce(E'\n\n' || v_links, ''));
end $$;

-- origem do cliente quando ele escreve
create or replace function credito.marcar_origem(p_lead int, p_texto text, p_inst text) returns void language plpgsql as $$
declare v_cc record; v_marca text := nullif(credito.config('disparo')->>'marca', '');
begin
  if exists (select 1 from credito.leads where id = p_lead and origem is not null) then return; end if;
  select cc.instancia, cc.enviado_em into v_cc from credito.campanha_contatos cc
   where cc.status = 'enviado' and (cc.lead_id = p_lead or cc.telefone = (select regexp_replace(telefone, '\D', '', 'g') from credito.leads where id = p_lead))
   order by cc.enviado_em desc limit 1;
  update credito.leads set origem = case
      when v_cc.instancia is not null then 'disparo · ' || v_cc.instancia || case when v_cc.instancia = p_inst then ' (respondeu no disparo)' else '' end
      when v_marca is not null and position(v_marca in coalesce(p_texto, '')) > 0 then 'disparo · fora da lista'
      else 'chegou direto' end
   where id = p_lead;
end $$;

create or replace function credito.mig051() returns void language plpgsql as $f$
begin
  execute replace(pg_get_functiondef('credito.receber_wpp_v2'::regproc),
    'if p_eu <> ''true'' and v_lead is not null then perform credito.ind_detectar(v_lead, p_texto); end if;',
    'if p_eu <> ''true'' and v_lead is not null then perform credito.ind_detectar(v_lead, p_texto); perform credito.marcar_origem(v_lead, p_texto, p_inst); end if;');
  execute replace(pg_get_functiondef('credito.campanha_instancias'::regproc), 'where n.campanha and',
    'where n.campanha and coalesce((select c.funcao from credito.wpp_chips c where c.nome = n.nome), ''disparo'') = ''disparo'' and');
  execute replace(pg_get_functiondef('credito.numeros_api'::regproc),
    'mensagem = coalesce(nullif(left(p_dados->>''mensagem'', 400), ''''), mensagem) where nome = v_nome;',
    'mensagem = coalesce(nullif(left(p_dados->>''mensagem'', 400), ''''), mensagem) where nome = v_nome;
    if p_dados->>''funcao'' in (''atendimento'', ''disparo'', ''reserva'') then
      if p_dados->>''funcao'' = ''atendimento'' then update credito.wpp_chips set funcao = ''disparo'' where funcao = ''atendimento'' and nome <> v_nome; end if;
      update credito.wpp_chips set funcao = p_dados->>''funcao'', campanha = case when p_dados->>''funcao'' = ''disparo'' then campanha else false end where nome = v_nome;
    end if;');
  execute replace(pg_get_functiondef('credito.wpp_numeros'::regproc), '''aparelho'', ch.aparelho,', '''aparelho'', ch.aparelho, ''funcao'', coalesce(ch.funcao, ''disparo''),');
  execute replace(replace(pg_get_functiondef('credito.campanha_placar'::regproc), '''mensagem'', ch.mensagem,',
      '''mensagem'', ch.mensagem, ''funcao'', ch.funcao, ''atendimento'', coalesce(p.atend, 0),'),
    'count(*) filter (where l.dt_respondeu is not null) resp,',
    'count(*) filter (where l.dt_respondeu is not null) resp, count(*) filter (where l.instancia in (select nome from credito.wpp_chips where funcao = ''atendimento'') and l.instancia is distinct from c.instancia) atend,');
  execute replace(replace(pg_get_functiondef('credito.campanha_api'::regproc),
    'else jsonb_build_object(''tipo'', ''resposta'', ''texto'', left(trim(b->>''texto''), 20)) end order by o)',
    'when b->>''tipo'' = ''atendimento'' then jsonb_build_object(''tipo'', ''atendimento'', ''texto'', left(trim(b->>''texto''), 20))
                                   else jsonb_build_object(''tipo'', ''resposta'', ''texto'', left(trim(b->>''texto''), 20)) end order by o)'),
    'jsonb_build_object(''testes'',', 'jsonb_build_object(''atendimento'', jsonb_build_object(''numero'', (select split_part(i."ownerJid", ''@'', 1) from credito.wpp_chips c join credito.v_instancias i on i.name = c.nome where c.funcao = ''atendimento'' limit 1), ''link'', credito.link_atendimento(), ''assinatura'', credito.config(''disparo'')->>''assinatura''), ''testes'',');
end $f$;
select credito.mig051();
-- (aplicado depois) sem botão, o link do atendimento vai limpo: https://wa.me/<numero>
-- (aplicado depois) todos os números vão para o servidor novo: todos enviam botões
alter table credito.wpp_motor alter column botoes set default true;
update credito.wpp_motor set botoes = true where not botoes;
