-- 110 · Leads do dia: saem de public.meus_leads (higienizados em lote no testeextrair), por cota de cada colaborador.
-- O celular vem do fluxo 'consulta telefone' (/webhook/consulta-cpf, mesmo do site telefones) na hora da extração (fluxo n8n "[Painel] 🧲 Leads do dia").

alter table public.meus_leads add column if not exists telefone text;
alter table public.meus_leads add column if not exists painel_usuario bigint;
alter table public.meus_leads add column if not exists painel_extraido_em timestamptz;
alter table public.meus_leads add column if not exists painel_chamado_em timestamptz;
alter table public.meus_leads add column if not exists painel_lead_id int;

create or replace function credito.leads_dia_json(m public.meus_leads) returns jsonb language sql stable as $$
  select jsonb_build_object('id', m.cpf, 'nome', coalesce(nullif(m.nome, ''), 'Sem nome'), 'telefone', coalesce(m.telefone, ''), 'cpf', m.cpf,
    'margem', m.margem, 'produto', 'CLT', 'extraidoPor', m.painel_usuario::text, 'extraidoEm', m.painel_extraido_em, 'chamadoEm', m.painel_chamado_em,
    'clienteId', m.painel_lead_id::text)
$$;

create or replace function credito.leads_dia_api(p_acao text, k text, p jsonb) returns jsonb language plpgsql as $$
declare u credito.painel_usuarios; hoje date := (now() at time zone 'America/Sao_Paulo')::date; ja int; falta int; m public.meus_leads;
  v_lead int; v_inst text; r json;
begin
  p := coalesce(p, '{}');
  u := credito.painel_sessao(k);
  if u.id is null then return jsonb_build_object('ok', false, 'codigo', 401, 'erro', 'Sessão expirada. Entre de novo.'); end if;
  select count(*) into ja from public.meus_leads where painel_usuario = u.id and (painel_extraido_em at time zone 'America/Sao_Paulo')::date = hoje;

  if p_acao = 'separar' then
    falta := greatest(0, u.leads_por_dia - ja);
    if u.leads_por_dia = 0 then return jsonb_build_object('ok', false, 'codigo', 400, 'erro', 'O administrador ainda não liberou leads para você hoje.'); end if;
    if falta = 0 then return jsonb_build_object('ok', false, 'codigo', 400, 'erro', 'Você já extraiu todos os leads liberados para hoje.'); end if;
    update public.meus_leads x set painel_usuario = u.id, painel_extraido_em = now()
     where x.cpf in (select cpf from public.meus_leads where painel_extraido_em is null and coalesce(margem, 0) > 0
                      order by random() limit falta for update skip locked);
    -- telefone que já existe na base de clientes
    update public.meus_leads x set telefone = l.telefone from credito.leads l
     where x.painel_usuario = u.id and x.telefone is null and regexp_replace(coalesce(l.cpf_informado, l.cpf_base, ''), '\D', '', 'g') = x.cpf and coalesce(l.telefone, '') <> '';
    return jsonb_build_object('ok', true);
  elsif p_acao = 'telefone' then
    update public.meus_leads set telefone = nullif(regexp_replace(coalesce(p->>'telefone', ''), '\D', '', 'g'), '') where cpf = p->>'cpf' and painel_usuario = u.id;
    return jsonb_build_object('ok', true);
  elsif p_acao = 'listar' then
    return jsonb_build_object('ok', true, 'cota', u.leads_por_dia, 'hoje', ja,
      'disponiveis', (select count(*) from public.meus_leads where painel_extraido_em is null and coalesce(margem, 0) > 0),
      'leads', (select coalesce(jsonb_agg(credito.leads_dia_json(x) order by x.painel_extraido_em desc, x.margem desc), '[]') from public.meus_leads x
                where (x.painel_usuario = u.id or u.papel = 'admin') and x.painel_extraido_em >= now() - interval '7 days'));
  elsif p_acao = 'chamar' then
    select * into m from public.meus_leads where cpf = p->>'cpf' and (painel_usuario = u.id or u.papel = 'admin');
    if m.cpf is null then return jsonb_build_object('ok', false, 'codigo', 404, 'erro', 'Lead não encontrado.'); end if;
    if coalesce(m.telefone, '') = '' then return jsonb_build_object('ok', false, 'codigo', 400, 'erro', 'Esse lead está sem celular.'); end if;
    select nome into v_inst from credito.wpp_chips where painel_dono = u.id and not coalesce(oculto, false) order by (estado = 'open') desc limit 1;
    if v_inst is null then select nome into v_inst from credito.wpp_chips where funcao = 'atendimento' and not coalesce(oculto, false) limit 1; end if;
    v_lead := m.painel_lead_id;
    if v_lead is null then
      insert into credito.leads (nome, telefone, cpf_informado, margem, produto, status, origem, canal, aguardando, instancia, painel_responsavel, setor_id, criado_em, atualizado_em)
      values (m.nome, case when m.telefone like '55%' then m.telefone else '55' || m.telefone end, m.cpf, m.margem, 'clt', 'cpf_ok', 'leads_dia', 'whatsapp', 'humano', v_inst, u.id, 'recepcao', now(), now())
      returning id into v_lead;
      update public.meus_leads set painel_lead_id = v_lead where cpf = m.cpf;
    end if;
    r := credito.atendimento_api(k, 'enviar', jsonb_build_object('id', v_lead, 'texto', p->>'texto'));
    update public.meus_leads set painel_chamado_em = now() where cpf = m.cpf returning * into m;
    return jsonb_build_object('ok', true, 'lead', credito.leads_dia_json(m), 'clienteId', v_lead::text, 'envio', r);
  end if;
  return jsonb_build_object('ok', false, 'codigo', 400, 'erro', 'Ação inválida.');
end $$;

-- CPFs do usuário que ainda estão sem celular (o n8n consulta no fluxo de telefones)
create or replace function credito.leads_dia_sem_tel(k text) returns jsonb language sql as $$
  select jsonb_build_object('cpfs', coalesce(jsonb_agg(m.cpf), '[]'))
    from public.meus_leads m where m.painel_usuario = (credito.painel_sessao(k)).id and m.telefone is null
     and m.painel_extraido_em > now() - interval '1 day'
$$;

-- grava os telefones que o fluxo de telefones devolveu: [{cpf, telefone, encontrado}]
create or replace function credito.leads_dia_telefones(k text, res jsonb) returns int language sql as $$
  with t as (select lpad(regexp_replace(x->>'cpf', '\D', '', 'g'), 11, '0') cpf, regexp_replace(coalesce(x->>'telefone', ''), '\D', '', 'g') tel
               from jsonb_array_elements(case when jsonb_typeof(res) = 'array' then res else coalesce(res->'resultados', '[]') end) x)
  , u as (update public.meus_leads m set telefone = t.tel from t
   where m.cpf = t.cpf and length(t.tel) >= 10 and m.painel_usuario = (credito.painel_sessao(k)).id and m.telefone is null
  returning 1)
  select count(*)::int from u
$$;
