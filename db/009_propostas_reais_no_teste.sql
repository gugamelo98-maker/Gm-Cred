-- Empresa virtual CLT — chat de teste cria propostas REAIS na V8 (com dados de contato e cadastro de mentirinha)
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-09. Idempotente.
-- Regras:
--  * cliente do chat de teste com CPF real e margem  -> proposta real na V8 com dados de teste (e-mail/telefone falsos,
--    nome da mãe e documento de mentirinha), para o link não chegar à pessoa. Deve ser cancelada depois do teste.
--  * CPF de demonstração (111.444.777-35)             -> continua tudo simulado (nada vai para a V8).
--  * cliente real (WhatsApp)                         -> só cria proposta com formalizacao_real = true e os dados obrigatórios.

insert into credito.configuracoes (chave, valor) values
 ('dados_teste_operacao', '{"email":"teste.integracao@gmcred.com.br","area_code":"48","phone":"900000000","mother_name":"MAE TESTE GMCRED","birth_date":"1990-01-01","document_identification_number":"000000","document_identification_date":"2015-01-01","marital_status":"single","gender":"male"}')
on conflict (chave) do update set valor = excluded.valor, atualizado_em = now();

create or replace function credito.dados_operacao(p_lead int) returns json language plpgsql as $$
declare l credito.leads%rowtype; e jsonb := credito.config('endereco_padrao'); d jsonb := credito.config('dados_padrao_operacao');
        t jsonb := credito.config('dados_teste_operacao'); v_demo boolean; v_fone text;
begin
  select * into l from credito.leads where id = p_lead;
  if l.oferta is null then return json_build_object('ok', false, 'texto', 'Nenhuma oferta escolhida ainda.'); end if;
  if l.pix is null then return json_build_object('ok', false, 'texto', 'Falta registrar a chave PIX (registrar_pix).'); end if;
  if l.operation_id is not null and coalesce(l.status_operacao, '') not in ('canceled', 'refunded') then
    return json_build_object('ok', false, 'ja_existe', true, 'texto', 'A proposta já foi criada. Link: ' || coalesce(l.formalization_url, ''));
  end if;
  v_demo := coalesce(l.consult_id, '') = 'demo';
  if not v_demo and not l.teste then
    if coalesce(credito.config('formalizacao_real')::text, 'false') <> 'true' or d->>'mother_name' is null then
      return json_build_object('ok', false, 'texto', 'Faltam dados obrigatórios para a proposta na V8. Use pedir_humano.');
    end if;
  end if;
  v_fone := regexp_replace(coalesce(l.dados_v8->>'telefone', l.telefone, ''), '\D', '', 'g');
  return json_build_object('ok', true, 'demo', v_demo, 'teste', l.teste, 'payload', json_build_object(
    'simulation_id', l.oferta->>'sim_id', 'provider', 'QI',
    'borrower', json_build_object(
      'name', upper(coalesce(l.dados_v8->>'nome', l.nome)),
      'email', case when l.teste then t->>'email' else coalesce(nullif(l.dados_v8->>'email', ''), 'sem@email.com') end,
      'phone', case when l.teste then json_build_object('country_code', '55', 'area_code', t->>'area_code', 'number', t->>'phone')
                    else json_build_object('country_code', '55', 'area_code', left(v_fone, 2), 'number', substr(v_fone, 3)) end,
      'political_exposition', false,
      'address', json_build_object('city', e->>'cidade', 'state', e->>'uf', 'number', e->>'numero', 'street', e->>'logradouro',
                                   'complement', '', 'postal_code', e->>'cep', 'neighborhood', e->>'bairro'),
      'birth_date', coalesce(nullif(l.dados_v8->>'nascimento', ''), case when l.teste then t->>'birth_date' end),
      'mother_name', case when l.teste then t->>'mother_name' else d->>'mother_name' end,
      'nationality', coalesce(d->>'nationality', 'brasileira'), 'document_issuer', coalesce(d->>'document_issuer', 'SSP'),
      'gender', case when l.teste then t->>'gender' else coalesce(l.dados_v8->>'genero', 'male') end, 'person_type', 'natural',
      'marital_status', case when l.teste then t->>'marital_status' else coalesce(d->>'marital_status', 'single') end,
      'individual_document_number', l.cpf_informado,
      'document_identification_date', case when l.teste then t->>'document_identification_date' else d->>'document_identification_date' end,
      'document_identification_type', coalesce(d->>'document_identification_type', 'rg'),
      'document_identification_number', case when l.teste then t->>'document_identification_number' else coalesce(d->>'document_identification_number', '000000') end,
      'bank', json_build_object('transfer_method', 'pix', 'pix_key', l.pix->>'chave', 'pix_key_type', l.pix->>'tipo'))));
end $$;

-- proposta de teste não entra no painel de comissão (só cliente real gera contrato)
create or replace function credito.acao(p_lead int, p_acao text, p_dados jsonb default '{}'::jsonb) returns json language plpgsql as $$
declare r json; v_status text; v_oferta jsonb; v_teste boolean;
begin
  select status, oferta, teste into v_status, v_oferta, v_teste from credito.leads where id = p_lead;
  if p_acao = 'registrar_pix' and v_oferta is null then
    return json_build_object('ok', false, 'texto', 'A oferta ainda não foi registrada. Primeiro chame escolher_oferta com o número que o cliente escolheu.',
                             'setor', (select setor_id from credito.leads where id = p_lead));
  end if;
  if p_acao = 'registrar_operacao' and v_teste then p_dados := coalesce(p_dados, '{}'::jsonb) || '{"demo":true}'::jsonb; end if;
  r := credito.acao_agente(p_lead, p_acao, coalesce(p_dados, '{}'::jsonb));
  if p_acao = 'salvar_ofertas' and v_status in ('negociando') then update credito.leads set status = v_status where id = p_lead; end if;
  return (r::jsonb || jsonb_build_object('setor', (select setor_id from credito.leads where id = p_lead)))::json;
end $$;

-- eventos do chat: simular assinatura/pagamento só em proposta de demonstração; "cancelar" cancela a proposta real na V8
create or replace function credito.evento_teste(p_telefone text, p_evento text) returns json language plpgsql as $$
declare l credito.leads%rowtype;
begin
  select * into l from credito.leads where telefone = p_telefone and teste order by criado_em desc limit 1;
  if l.id is null or l.operation_id is null then return json_build_object('ok', false, 'texto', 'Esse cliente ainda não tem proposta.'); end if;
  if p_evento = 'cancelar' then
    if l.operation_id like 'demo-%' then return json_build_object('ok', false, 'texto', 'Essa proposta é de demonstração, não existe na V8.'); end if;
    return json_build_object('ok', true, 'cancelar', true, 'lead_id', l.id);
  end if;
  if l.operation_id not like 'demo-%' then
    return json_build_object('ok', false, 'texto', 'Essa proposta é real: a situação vem da própria V8 (o acompanhamento verifica a cada 2 minutos).');
  end if;
  return (credito.acao_agente(l.id, 'atualizar_operacao', jsonb_build_object('status', case p_evento when 'assinou' then 'analysis' when 'pagou' then 'paid' else p_evento end))::jsonb
         || jsonb_build_object('lead_id', l.id))::json;
end $$;

-- o chat precisa saber se a proposta é real (para mostrar o botão de cancelar)
create or replace function credito.mensagens_novas(p_telefone text, p_depois bigint) returns json language sql stable as $$
  select json_build_object(
    'mensagens', coalesce((select json_agg(json_build_object('id', c.id, 'texto', c.conteudo, 'agente', a.nome, 'versao', c.agente_versao,
                                   'setor', c.setor_id, 'modo', c.modo, 'em', c.criado_em) order by c.id)
                  from credito.conversas c left join credito.agentes a on a.id = c.agente_id
                  join credito.leads l on l.id = c.lead_id
                 where l.telefone = p_telefone and c.direcao = 'saida' and c.id > p_depois), '[]'::json),
    'lead', (select json_build_object('id', l.id, 'setor', l.setor_id, 'status', l.status, 'aguardando', l.aguardando, 'operacao', l.status_operacao,
                    'operacao_real', l.operation_id is not null and l.operation_id not like 'demo-%',
                    'agente', (select json_build_object('nome', a.nome, 'versao', a.versao, 'abordagem', a.abordagem) from credito.agentes a where a.id = l.agente_id),
                    'jornada', (select json_agg(json_build_object('setor', t.setor_id, 'agente', a.nome, 'versao', a.versao) order by t.inicio)
                                  from credito.atribuicoes t join credito.agentes a on a.id = t.agente_id where t.lead_id = l.id))
               from credito.leads l where l.telefone = p_telefone order by l.criado_em desc limit 1)) $$;
