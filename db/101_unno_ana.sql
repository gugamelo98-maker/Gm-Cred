-- 101 · Ana vende CLT pela Unno (fluxo real da doc docs.unnotech.com.br)
-- n8n: "GM Cred · Unno Ana" (sub-workflow chamado pelas ferramentas unno_* da Ana)
--   abrir  -> POST /applications (+ POST /authorization se faltar o link); o CLIENTE assina o termo
--   status -> GET /status; autorizado em AWAITING_SIMULATION => GET /margin + POST /simulations
--   ofertas-> GET /applications/{id}; escolhe por MAIOR COMISSÃO; padrão 36x e 24x,
--             prazos maiores só quando o cliente quer mais dinheiro (mais_dinheiro)
--   aceitar-> POST /kyc + POST /offers/{id}/accept (202)
-- Ativação: credito.configuracoes 'unno'.ativo (false por padrão; leads teste=true já usam).
-- Ana: ferramentas unno_abrir_termo / unno_status / unno_ofertas / unno_aceitar + regra no system prompt
-- (Contexto devolve 'unno' = credito.unno_ana_ativa). Só o cliente assina o termo (consent_url).
-- Obs.: leads.banco_escolhido só aceita hubcredito/v8digital, por isso a Unno fica em contratos.banco ('unno:<banco>').

create or replace function credito.unno_ana_ativa(p_lead int) returns boolean
language sql stable as $$
  select coalesce((select (valor->>'ativo')::boolean from credito.configuracoes where chave = 'unno'), false)
      or coalesce((select teste from credito.leads where id = p_lead), false) $$;

create or replace function credito.unno_pct(p_source text, p_common text, p_table text, p_seguro boolean, p_parcelas int)
returns numeric language sql stable as $$
  select coalesce(
    credito.comissao_clt('unno:' || lower(coalesce(p_source, '')), coalesce(p_common, ''), p_seguro, p_parcelas),
    credito.comissao_clt('unno:' || lower(coalesce(p_source, '')), coalesce(p_table, ''), p_seguro, p_parcelas)) $$;

create or replace function credito.unno_ana_preparar(p_lead int, p_acao text, p jsonb default '{}'::jsonb)
returns jsonb language plpgsql as $$
declare
  cfg jsonb; l credito.leads%rowtype; u jsonb; pr jsonb; o jsonb; kyc jsonb; ex jsonb;
  fone text; parc text; pixk text; pixt text;
begin
  p := coalesce(p, '{}'::jsonb);
  select valor into cfg from credito.configuracoes where chave = 'unno';
  select * into l from credito.leads where id = p_lead;
  if not found then
    return jsonb_build_object('etapa', 'texto', 'ok', false, 'texto', 'Lead não encontrado. Use pedir_humano.');
  end if;
  if not (coalesce((cfg->>'ativo')::boolean, false) or coalesce(l.teste, false)) then
    return jsonb_build_object('etapa', 'texto', 'ok', false, 'indisponivel', true,
      'texto', 'O caminho Unno não está disponível agora. Siga pelo fluxo da V8 (consultar_cpf).');
  end if;
  u := coalesce(l.unno, '{}'::jsonb);

  if p_acao = 'abrir' then
    pr := credito.unno_preparar(p_lead, 'abrir', jsonb_build_object('cpf', coalesce(p->>'cpf', ''), 'email', coalesce(p->>'email', '')));
    return pr || jsonb_build_object('acao', 'abrir', 'application_id', u->>'application_id');
  end if;

  if u->>'application_id' is null then
    return jsonb_build_object('etapa', 'texto', 'ok', false,
      'texto', 'Ainda não há consulta aberta na Unno para este cliente. Use unno_abrir_termo com o CPF.');
  end if;

  if p_acao in ('status', 'ofertas') then
    parc := nullif(regexp_replace(coalesce(p->>'parcela', ''), '[^0-9,.]', '', 'g'), '');
    if parc is not null then
      if position(',' in parc) > 0 then parc := replace(replace(parc, '.', ''), ',', '.'); end if;
    end if;
    return jsonb_build_object('etapa', p_acao, 'ok', true, 'acao', p_acao, 'base', cfg->>'base',
      'application_id', u->>'application_id', 'consent_url', u->>'consent_url',
      'parcela', case when parc ~ '^[0-9]+(\.[0-9]+)?$' then parc::numeric end,
      'mais_dinheiro', lower(coalesce(p->>'mais_dinheiro', '')) in ('sim', 'true', 's', '1'));
  end if;

  if p_acao = 'aceitar' then
    o := l.oferta;
    if o is null or o->>'offer_id' is null or coalesce(o->>'provider', '') <> 'unno' then
      return jsonb_build_object('etapa', 'texto', 'ok', false,
        'texto', 'Nenhuma oferta da Unno escolhida. Primeiro chame escolher_oferta com o número que o cliente escolheu.');
    end if;
    if l.pix is null or coalesce(l.pix->>'chave', '') = '' then
      return jsonb_build_object('etapa', 'texto', 'ok', false,
        'texto', 'Falta a chave PIX do cliente. Peça a chave (CPF, celular, e-mail ou aleatória) e use registrar_pix.');
    end if;
    begin ex := coalesce(nullif(p->>'dados', '')::jsonb, '{}'::jsonb); exception when others then ex := '{}'::jsonb; end;
    fone := regexp_replace(coalesce(l.telefone, ''), '[^0-9]', '', 'g');
    if length(fone) > 11 and left(fone, 2) = '55' then fone := substr(fone, 3); end if;
    pixk := l.pix->>'chave';
    pixt := case lower(coalesce(l.pix->>'tipo', ''))
      when 'cpf' then 'CPF' when 'email' then 'EMAIL' when 'e-mail' then 'EMAIL'
      when 'phone' then 'PHONE' when 'telefone' then 'PHONE' when 'celular' then 'PHONE'
      else 'RANDOM' end;
    kyc := jsonb_strip_nulls(jsonb_build_object(
      'name', coalesce(nullif(l.dados_v8->>'nome', ''), l.nome),
      'birth_date', nullif(l.dados_v8->>'nascimento', ''),
      'phone', nullif(fone, ''),
      'email', coalesce(u->>'email', nullif(l.dados_v8->>'email', '')),
      'mothers_name', coalesce(nullif(l.fgts->>'mae', ''), nullif(l.dados_v8->>'mae', '')),
      'bank', jsonb_build_object('disbursement_method', 'PIX', 'pix_key', pixk, 'pix_type', pixt)));
    -- campos extras informados pelo cliente (nomes da API); endereço vai agrupado
    kyc := kyc || (ex - 'zip_code' - 'uf' - 'city' - 'district' - 'street' - 'number' - 'complement')
      || case when ex ?| array['zip_code', 'uf', 'city', 'district', 'street', 'number', 'complement']
              then jsonb_build_object('address', jsonb_strip_nulls(jsonb_build_object(
                'zip_code', ex->>'zip_code', 'uf', ex->>'uf', 'city', ex->>'city', 'district', ex->>'district',
                'street', ex->>'street', 'number', ex->>'number', 'complement', ex->>'complement')))
              else '{}'::jsonb end;
    return jsonb_build_object('etapa', 'aceitar', 'ok', true, 'acao', 'aceitar', 'base', cfg->>'base',
      'application_id', u->>'application_id', 'offer_id', o->>'offer_id', 'kyc', kyc);
  end if;

  return jsonb_build_object('etapa', 'texto', 'ok', false, 'texto', 'Ação Unno desconhecida.');
end $$;

create or replace function credito.unno_ana_gravar(p_lead int, p_acao text, r jsonb)
returns jsonb language plpgsql as $$
declare
  l credito.leads%rowtype; u jsonb; g jsonb; st text; url text; msg text; setor0 text;
  arr jsonb := '[]'::jsonb; res jsonb; sel record; prazos int[]; alvo int; usado int[] := '{}'; escolhido int;
  campos text; aut boolean; offs jsonb; n int := 0; mais boolean; margem numeric; pcom numeric;
  info text; st2 text; ofc jsonb;
begin
  r := coalesce(r, '{}'::jsonb);
  select * into l from credito.leads where id = p_lead;
  u := coalesce(l.unno, '{}'::jsonb);

  if r->>'erro' is not null then
    return jsonb_build_object('ok', false, 'erro', r->>'erro',
      'texto', 'Não consegui falar com a Unno agora (' || (r->>'erro') || '). Peça um instante ao cliente e tente de novo; se persistir use pedir_humano.');
  end if;

  if p_acao = 'abrir' then
    g := credito.unno_gravar(p_lead, 'abrir', r->'raw', jsonb_build_object('cpf', r->>'cpf', 'email', r->>'email'));
    if coalesce((g->>'ok')::boolean, false) is false then return g; end if;
    url := g->>'consent_url';
    if coalesce((g->>'autorizado')::boolean, false) = false and url is not null then
      g := g || jsonb_build_object('texto',
        '[Instrução interna] Para consultar o crédito é preciso o cliente assinar o termo de autorização (só ele pode assinar). Mande ao cliente este link, sem alterar, e peça para assinar e te avisar: '
        || url || E'\nQuando ele avisar que assinou, use unno_status.');
    end if;
    return g;
  end if;

  if p_acao = 'status' then
    g := credito.unno_gravar(p_lead, 'status', r->'status', '{}'::jsonb);
    st := r->'status'->>'status';
    url := coalesce(g->>'consent_url', u->>'consent_url');
    if coalesce((r->'status'->>'offers_count')::int, 0) > 0 then
      return g || jsonb_build_object('pronto', true, 'texto', 'As condições estão prontas. Chame unno_ofertas agora.');
    elsif r->>'sem_margem' = 'true' or st = 'NO_MARGIN' then
      return g || jsonb_build_object('texto', 'O cliente está sem margem consignável disponível no momento. Explique com jeito e ofereça avisar quando mudar.');
    elsif coalesce((g->>'autorizado')::boolean, false) = false and url is not null then
      return g || jsonb_build_object('texto', '[Instrução interna] O cliente ainda não assinou o termo. Peça com gentileza e reenvie o link: ' || url);
    elsif r->>'simulou' = 'true' then
      return g || jsonb_build_object('texto', 'O termo foi assinado e a simulação foi disparada. Em alguns segundos chame unno_ofertas.');
    end if;
    return g;
  end if;

  if p_acao = 'ofertas' then
    st := r->'status'->>'status';
    offs := coalesce(r->'offers', '[]'::jsonb);
    if st = 'NO_MARGIN' then
      return jsonb_build_object('ok', false, 'texto', 'O cliente está sem margem consignável disponível no momento. Explique com jeito e ofereça avisar quando mudar.');
    end if;
    if jsonb_array_length(offs) = 0 then
      if st = 'NO_OFFERS' then
        return jsonb_build_object('ok', false, 'texto', 'A Unno não liberou oferta para esse cliente agora. Explique com jeito e use pedir_humano.');
      end if;
      return jsonb_build_object('ok', false, 'aguardando', true,
        'texto', 'A cotação ainda está sendo calculada. Peça um instante ao cliente e chame unno_ofertas de novo em alguns segundos.');
    end if;

    mais := coalesce((r->>'mais_dinheiro')::boolean, false);
    create temp table if not exists _uo (n int, seg boolean, prazo int, parcela numeric, valor numeric, src text, tbl text, common text,
      offer_id text, table_id text, pct numeric, com numeric, expira text) on commit drop;
    delete from _uo;
    insert into _uo
    select 0, coalesce((x->>'insurance_included')::boolean, false), (x->>'installment_count')::int, (x->>'installment_amount')::numeric,
           (x->>'net_amount')::numeric, x->>'source', x->>'table_name', x->>'common_name', x->>'offer_id', x->>'table_id',
           credito.unno_pct(x->>'source', x->>'common_name', x->>'table_name', coalesce((x->>'insurance_included')::boolean, false), (x->>'installment_count')::int),
           null, x->>'expires_at'
      from jsonb_array_elements(offs) x
     where coalesce(x->>'status', 'AVAILABLE') = 'AVAILABLE' and coalesce((x->>'net_amount')::numeric, 0) > 0
       and (x->>'installment_count') is not null;
    update _uo set com = round(valor * pct / 100, 2) where pct is not null;
    if not exists (select 1 from _uo) then
      return jsonb_build_object('ok', false, 'texto', 'A Unno não liberou oferta para esse cliente agora. Explique com jeito e use pedir_humano.');
    end if;

    if mais then
      select array_agg(p order by p desc) into prazos from (select distinct prazo p from _uo order by prazo desc limit 2) s;
    else
      prazos := '{}';
      foreach alvo in array array[36, 24] loop
        select p into escolhido from (select distinct prazo p from _uo) s
         where p <> all (prazos) order by abs(p - alvo), p desc limit 1;
        if escolhido is not null then prazos := prazos || escolhido; end if;
      end loop;
      select array_agg(p order by p desc) into prazos from unnest(prazos) p;
    end if;

    n := 0;
    for sel in
      select * from (select distinct on (prazo) * from _uo where prazo = any (prazos)
                      order by prazo, com desc nulls last, valor desc) z order by prazo desc
    loop
      n := n + 1;
      arr := arr || jsonb_build_object('n', n, 'seguro', sel.seg, 'prazo', sel.prazo, 'parcela', sel.parcela, 'valor', sel.valor,
        'pedida', sel.parcela, 'provider', 'unno', 'banco', 'unno:' || lower(coalesce(sel.src, '')), 'offer_id', sel.offer_id,
        'table_id', sel.table_id, 'tabela', coalesce(sel.common, sel.tbl), 'percentual', sel.pct, 'comissao', sel.com, 'expira', sel.expira);
    end loop;

    msg := '✅ *Simulação pronta!*' || E'\n\n' || (
      select string_agg('📅 ' || (x->>'prazo') || 'x de ' || credito.brl((x->>'parcela')::numeric) || E'\n*APROVADO ' || credito.brl((x->>'valor')::numeric) || '*', E'\n\n' order by (x->>'n')::int)
        from jsonb_array_elements(arr) x)
      || E'\n\nQual prazo fica melhor pra você?';

    select setor_id into setor0 from credito.leads where id = p_lead;
    update credito.leads set sem_seguro_liberado = true,
           unno = coalesce(unno, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
             'sim_parcela', r->'simulacao'->>'installment_amount', 'margem', r->>'margem', 'ofertas_em', now()))
     where id = p_lead;
    res := credito.salvar_ofertas(p_lead, jsonb_build_object('ofertas', arr, 'mensagem', msg), '')::jsonb;
    if setor0 = 'recepcao' then
      res := res || jsonb_build_object('situacao', 'com_margem',
        'texto', 'Pronto! As ofertas já foram calculadas e vão aparecer na próxima mensagem. Diga só que já vai mostrar as opções (não diga valores).');
    end if;
    return res || jsonb_build_object('ok', coalesce((res->>'ok')::boolean, true));
  end if;

  if p_acao = 'aceitar' then
    if r->'kyc_erro' is not null and r->'kyc_erro' <> 'null'::jsonb then
      select string_agg(distinct coalesce(d->>'field', d->>'code'), ', ') into campos
        from jsonb_array_elements(coalesce(r->'kyc_erro'->'details', '[]'::jsonb)) d;
      return jsonb_build_object('ok', false, 'faltando', campos,
        'texto', 'O cadastro da Unno pediu mais dados' || coalesce(' (' || campos || ')', '') ||
          ': ' || coalesce(r->'kyc_erro'->>'message', '') ||
          '. Peça ao cliente, de forma natural, só o que falta e chame unno_aceitar de novo com o parâmetro dados em JSON usando os nomes da Unno (ex.: {"mothers_name":"...","gender":"MALE|FEMALE","civil_status":"SINGLE|MARRIED|...","zip_code":"...","number":"..."}).');
    end if;
    if r->'aceite_erro' is not null and r->'aceite_erro' <> 'null'::jsonb then
      st2 := r->'aceite_erro'->>'code';
      return jsonb_build_object('ok', false, 'erro', st2,
        'texto', case
          when st2 = 'OFFER_EXPIRED' then 'A oferta expirou. Chame unno_ofertas de novo para recalcular e apresente as novas condições.'
          when st2 = 'DISBURSEMENT_DATA_REQUIRED' then 'A Unno pediu os dados de recebimento: ' || coalesce(r->'aceite_erro'->>'message', '') || ' Confirme a chave PIX com o cliente (registrar_pix) e tente de novo.'
          else 'A Unno não aceitou a contratação agora (' || coalesce(st2, 'erro') || '). Diga que um especialista vai verificar e use pedir_humano.' end);
    end if;
    ofc := l.oferta;
    url := r->>'link';
    update credito.leads set
      unno = u || jsonb_strip_nulls(jsonb_build_object('proposal_uuid', r->>'proposal_uuid', 'aceito_em', now(), 'status', r->>'status', 'link_assinatura', url)),
      dt_proposta = coalesce(dt_proposta, now()),
      valor = (ofc->>'valor')::numeric, comissao = (ofc->>'comissao')::numeric,
      status = case when url is not null then 'link_env' else status end
     where id = p_lead;
    if r->>'proposal_uuid' is not null then
      insert into credito.contratos (lead_id, banco, produto, operation_id, tabela, com_seguro, parcelas, valor_liberado, valor_parcela,
                                     percentual_comissao, link_assinatura, status_v8)
      values (p_lead, ofc->>'banco', 'clt', r->>'proposal_uuid', ofc->>'tabela', (ofc->>'seguro')::boolean, (ofc->>'prazo')::int,
              (ofc->>'valor')::numeric, (ofc->>'parcela')::numeric, (ofc->>'percentual')::numeric, url, 'formalization')
      on conflict do nothing;
    end if;
    return jsonb_build_object('ok', true, 'status', r->>'status', 'proposal_uuid', r->>'proposal_uuid',
      'texto', '[Instrução interna] A contratação foi iniciada na Unno. ' ||
        case when url is not null then 'Mande ao cliente este link de assinatura, sem alterar: ' || url
             else 'Avise o cliente que a proposta foi enviada e que ele vai receber as instruções de assinatura; acompanhe com unno_status.' end);
  end if;

  return jsonb_build_object('ok', false, 'texto', 'Ação Unno desconhecida.');
end $$;
