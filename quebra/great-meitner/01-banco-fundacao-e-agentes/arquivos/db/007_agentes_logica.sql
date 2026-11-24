-- Empresa virtual CLT — lógica dos agentes: prompts, contexto, ações e máquina de estados do cliente
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-09. Idempotente.

-- 1. CAMPOS DO CLIENTE usados na jornada
alter table credito.leads
  add column if not exists margem numeric,
  add column if not exists status_v8 text,
  add column if not exists dados_v8 jsonb,
  add column if not exists ofertas jsonb,
  add column if not exists oferta jsonb,
  add column if not exists pix jsonb,
  add column if not exists operation_id text,
  add column if not exists formalization_url text,
  add column if not exists status_operacao text,
  add column if not exists recuperacoes int not null default 0,
  add column if not exists ultima_recuperacao timestamptz;
alter table credito.setores add column if not exists prompt text;
alter table credito.conversas add column if not exists modo text;   -- resposta | apresentar | recuperar | aviso

-- 2. CONFIGURAÇÕES dos agentes
insert into credito.configuracoes (chave, valor) values
 ('cpf_demo', '"11144477735"'),                       -- no chat de teste, este CPF simula um cliente com margem
 ('formalizacao_real', 'false'),                     -- false = proposta na V8 não é criada (link de demonstração)
 ('recuperacao', '{"minutos_teste":3,"minutos":120,"max_tentativas":3}'),
 ('dados_padrao_operacao', '{"mother_name":null,"nationality":"brasileira","document_issuer":"SSP","marital_status":"single","document_identification_type":"rg","document_identification_number":"000000","political_exposition":false}'),
 ('regras_gerais', to_jsonb($t$Você é a Ana, assistente virtual da GM Cred, correspondente que trabalha com o crédito consignado CLT (empréstimo para quem trabalha de carteira assinada, com desconto direto na folha) pela V8 Digital.
Fale como no WhatsApp: próxima, descontraída e educada.

REGRAS (sempre):
- No máximo 2 ou 3 frases curtas por resposta. Uma pergunta por vez.
- Nada de textos longos, listas grandes, títulos ou explicações técnicas. Se perguntarem algo, responda em uma frase simples (use as RESPOSTAS PRONTAS quando couber).
- Nunca invente valores, taxas, prazos ou regras: use só os DADOS DO CLIENTE e o resultado das ferramentas.
- Nunca peça pagamento antecipado, senha, cartão ou foto de documento.
- O seguro é sempre opcional: o cliente escolhe com ou sem.
- Se perguntarem se você é robô: você é a Ana, assistente virtual da GM Cred, e tem um especialista acompanhando o atendimento.
- Se o cliente pedir um atendente humano, ficar muito irritado ou fizer uma reclamação séria, use a ferramenta pedir_humano.
- Se o cliente disser claramente que não quer, agradeça com gentileza e use a ferramenta encerrar.
- No máximo 1 emoji por mensagem. Use *negrito* só para valores.
- Para o cliente você é sempre a Ana. Nunca fale de setores, versões, ferramentas, sistema ou outros agentes.$t$::text))
on conflict (chave) do update set valor = excluded.valor, atualizado_em = now();

-- 3. PROMPTS POR SETOR (o que fazer nesta etapa)
update credito.setores set prompt = $t$ETAPA: RECEPÇÃO. Objetivo: conseguir o CPF do cliente para consultar quanto ele tem disponível.
- Quando o cliente mandar um CPF, chame consultar_cpf com os 11 números.
- cpf_invalido: peça para conferir o CPF.
- com_margem: diga que deu tudo certo e que já vai mostrar os valores. Não diga valores agora.
- processando: diga que está consultando e que avisa em instantes.
- sem_margem: diga com gentileza que no momento não há margem disponível (motivo simples, se houver) e agradeça.
- nao_encontrado_v8: diga que não achou vínculo CLT ativo para esse CPF e pergunte se ele trabalha de carteira assinada.
- Não peça nenhum outro dado além do CPF.$t$ where id = 'recepcao';
update credito.setores set prompt = $t$ETAPA: SIMULAÇÃO. A consulta deu certo e as OFERTAS já foram calculadas.
- Apresente as ofertas do jeito do seu estilo, usando só os valores listados (valor que cai no PIX e parcela por mês).
- Diga em poucas palavras que o seguro é opcional.
- Termine com uma pergunta para o cliente escolher. Não use ferramentas.$t$ where id = 'simulacao';
update credito.setores set prompt = $t$ETAPA: VENDAS. O cliente já recebeu as OFERTAS. Ajude-o a escolher e fechar.
- Tire dúvidas em uma frase e contorne objeções com verdade, sem pressão falsa e sem prometer aprovação garantida.
- Se pedir outro prazo ou outra parcela, chame simular e mostre o resultado.
- Quando o cliente escolher, confirme valor, parcelas e se é com ou sem seguro, e chame escolher_oferta com o número da oferta.
- Depois de escolher, diga que agora só falta a chave PIX para receber.$t$ where id = 'vendas';
update credito.setores set prompt = $t$ETAPA: FORMALIZAÇÃO. A oferta já foi escolhida. A única informação que você pede é a chave PIX (tem que ser do próprio cliente).
- Peça a chave PIX. Identifique o tipo (cpf, email, phone ou random) e chame registrar_pix.
- Em seguida chame criar_proposta e envie o link de formalização que vier no resultado.
- Explique em 1 ou 2 frases: abrir o link, conferir os dados, fazer a selfie e assinar. Ajude passo a passo se ele tiver dificuldade.
- Para saber se ele já assinou, use status_proposta.$t$ where id = 'formalizacao';
update credito.setores set prompt = $t$ETAPA: PÓS-VENDA. O contrato já foi assinado.
- Para responder sobre andamento ou pagamento, use status_proposta.
- Se já foi pago, comemore e peça a indicação de amigos que trabalham de carteira assinada.
- Se houver pendência, explique em uma frase e, se for o PIX, peça uma nova chave e use registrar_pix.$t$ where id = 'posvenda';
update credito.setores set prompt = $t$ETAPA: RECUPERAÇÃO. O cliente parou de responder. Escreva UMA mensagem curta e natural para retomar a conversa de onde parou, no seu estilo. Não pressione e não use ferramentas.$t$ where id = 'gerente';

-- 4. ESTILO DE CADA VERSÃO (A/B/C)
update credito.agentes a set prompt = v.p from (values
 ('recepcao','Ana',  'ESTILO: direto. Na primeira mensagem já se apresente e peça o CPF para ver quanto ele tem liberado.'),
 ('recepcao','Bia',  'ESTILO: consultivo. Primeiro pergunte de leve o que ele precisa (valor ou objetivo). Só depois peça o CPF.'),
 ('recepcao','Caio', 'ESTILO: segurança. Antes de pedir o CPF, diga que a consulta é gratuita, sem cobrança antecipada e sem compromisso.'),
 ('simulacao','Bruno','ESTILO: valor máximo. Mostre primeiro o MAIOR valor disponível com a parcela, e diga que dá para ajustar.'),
 ('simulacao','Duda', 'ESTILO: parcela que cabe. Comece pela parcela mensal e quanto ele recebe, e pergunte se a parcela cabe no bolso.'),
 ('simulacao','Enzo', 'ESTILO: três opções. Mostre até 3 opções numeradas, uma linha cada (valor e parcela), e pergunte qual ele prefere.'),
 ('vendas','Carla',  'ESTILO: objetiva. Respostas diretas e conduza logo para a escolha.'),
 ('vendas','Fábio',  'ESTILO: empático. Valide a preocupação do cliente antes de responder a objeção.'),
 ('vendas','Gabi',   'ESTILO: urgência leve. Reforce vantagens reais (dinheiro rápido no PIX, desconto direto na folha), sem inventar prazos ou escassez.'),
 ('formalizacao','Diego','ESTILO: direto. Peça a chave PIX logo e mande o link com instruções curtas.'),
 ('formalizacao','Helô', 'ESTILO: passo a passo. Conduza uma etapa por vez e confirme se deu certo antes da próxima.'),
 ('formalizacao','Igor', 'ESTILO: guiado. Junto com o link, mande um mini-guia de 3 passos bem curtos.'),
 ('posvenda','Elisa',  'ESTILO: proativa. Avise o andamento sem esperar o cliente perguntar.'),
 ('posvenda','João',   'ESTILO: sob demanda. Seja breve e fale só do que o cliente perguntou.'),
 ('posvenda','Lara',   'ESTILO: relacionamento. Seja calorosa, comemore as conquistas e peça indicação com carinho.'),
 ('gerente','Fernando','ESTILO: lembrete simples. Lembre que o valor continua disponível.'),
 ('gerente','Marta',   'ESTILO: novo motivo. Volte com um ângulo novo (outro prazo ou parcela menor) para reabrir a conversa.'),
 ('gerente','Nico',    'ESTILO: pergunta aberta. Pergunte com leveza o que fez ele parar e se pode ajudar.')
) v(setor, nome, p) where a.setor_id = v.setor and a.nome = v.nome;

-- 5. UTILITÁRIOS
create or replace function credito.brl(v numeric) returns text language sql immutable as $$
  select 'R$ ' || replace(replace(replace(to_char(coalesce(v,0), 'FM999G999G990D00'), ',', '#'), '.', ','), '#', '.') $$;

create or replace function credito.config(k text) returns jsonb language sql stable as $$
  select valor from credito.configuracoes where chave = k $$;

-- ofertas de demonstração (cliente de teste com o CPF de demonstração), taxa 4,98% a.m.
create or replace function credito.ofertas_demo(p_margem numeric) returns jsonb language sql immutable as $$
  select jsonb_agg(jsonb_build_object('n', n, 'seguro', seg, 'prazo', prazo, 'parcela', p_margem,
           'valor', round(p_margem * (1 - power(1.0498, -prazo)) / 0.0498 * case when seg then 0.93 else 0.97 end, 2),
           'config_id', 'demo', 'sim_id', 'demo-' || n) order by n)
  from (values (1, false, 46), (2, false, 36), (3, false, 24), (4, true, 46)) o(n, seg, prazo) $$;

-- 6. CONTEXTO PARA O AGENTE: sorteia/recupera o agente do setor e monta o prompt completo
create or replace function credito.contexto_agente(p_lead int, p_modo text default 'resposta', p_instrucao text default null)
returns json language plpgsql as $$
declare l credito.leads%rowtype; v_setor text; v_ag int; a credito.agentes%rowtype; s credito.setores%rowtype;
        v_dados text; v_ofertas text; v_hist text; v_resp text; v_msg text;
begin
  select * into l from credito.leads where id = p_lead;
  if l.id is null then return null; end if;
  v_setor := case when p_modo = 'recuperar' then 'gerente' else l.setor_id end;
  v_ag := credito.atribuir_agente(l.id, v_setor);
  if p_modo = 'recuperar' then update credito.leads set agente_id = (select agente_id from credito.atribuicoes where lead_id = l.id and setor_id = l.setor_id) where id = l.id; end if;
  select * into a from credito.agentes where id = v_ag;
  select * into s from credito.setores where id = v_setor;

  select string_agg(format('%s) %s no PIX em %sx de %s (%s)', o->>'n', credito.brl((o->>'valor')::numeric), o->>'prazo',
                           credito.brl((o->>'parcela')::numeric), case when (o->>'seguro')::boolean then 'com seguro' else 'sem seguro' end), E'\n' order by (o->>'n')::int)
    into v_ofertas from jsonb_array_elements(coalesce(l.ofertas, '[]'::jsonb)) o;

  v_dados := concat_ws(E'\n',
    '- Nome: ' || coalesce(l.nome, 'ainda não sabemos'),
    '- CPF: ' || case when l.cpf_informado is null then 'ainda não informado' else 'informado (***.' || substr(l.cpf_informado, 4, 3) || '.***-' || right(l.cpf_informado, 2) || ')' end,
    case when l.status_v8 is not null then '- Consulta V8: ' || l.status_v8 || coalesce(' · margem por mês ' || credito.brl(l.margem), '') end,
    case when v_ofertas is not null then E'- OFERTAS:\n' || v_ofertas end,
    case when l.oferta is not null then '- Oferta escolhida: ' || (l.oferta->>'n') || ' (' || credito.brl((l.oferta->>'valor')::numeric) || ' em ' || (l.oferta->>'prazo') || 'x de ' || credito.brl((l.oferta->>'parcela')::numeric) || ')' end,
    case when l.pix is not null then '- Chave PIX registrada: ' || (l.pix->>'tipo') end,
    case when l.formalization_url is not null then '- Link de formalização: ' || l.formalization_url end,
    case when l.status_operacao is not null then '- Situação do contrato: ' || l.status_operacao end);

  select string_agg(case when h.direcao = 'entrada' then 'Cliente: ' else 'Ana: ' end || h.conteudo, E'\n' order by h.criado_em)
    into v_hist from (select direcao, conteudo, criado_em from credito.conversas where lead_id = l.id order by criado_em desc limit 24) h;
  select string_agg('- ' || pergunta || ' → ' || resposta, E'\n') into v_resp from credito.respostas_prontas where ativo;

  v_msg := case p_modo
    when 'apresentar' then '[Instrução interna] Apresente agora as ofertas ao cliente.'
    when 'recuperar' then '[Instrução interna] O cliente parou de responder há um tempo. Mande a mensagem de retomada.'
    when 'aviso' then '[Instrução interna] ' || coalesce(p_instrucao, 'Avise o cliente sobre a novidade.')
    else coalesce((select conteudo from credito.conversas where lead_id = l.id and direcao = 'entrada' order by criado_em desc limit 1), 'Oi') end;

  return json_build_object(
    'lead_id', l.id, 'agente_id', a.id, 'agente', a.nome, 'versao', a.versao, 'setor', v_setor, 'setor_cliente', l.setor_id,
    'modelo', coalesce(a.modelo, 'google/gemini-2.5-flash'), 'modo', p_modo, 'canal', l.canal, 'telefone', l.telefone, 'teste', l.teste,
    'mensagem', v_msg,
    'system', concat_ws(E'\n\n',
       credito.config('regras_gerais') #>> '{}',
       s.prompt,
       a.prompt,
       E'RESPOSTAS PRONTAS:\n' || coalesce(v_resp, ''),
       E'DADOS DO CLIENTE:\n' || v_dados,
       E'CONVERSA ATÉ AGORA (mais recente por último):\n' || coalesce(v_hist, '(início da conversa)')));
end $$;

-- 7. AÇÕES DOS AGENTES (máquina de estados do cliente). Devolve {ok, texto, ...} para o agente.
create or replace function credito.acao_agente(p_lead int, p_acao text, p_dados jsonb default '{}'::jsonb)
returns json language plpgsql as $$
declare l credito.leads%rowtype; v_sit text; o jsonb; v_n int; v_tipo text; v_chave text; v_st text; v_etapa text; v_seg text;
begin
  select * into l from credito.leads where id = p_lead;
  if l.id is null then return json_build_object('ok', false, 'texto', 'cliente não encontrado'); end if;

  if p_acao = 'aplicar_consulta' then
    v_sit := p_dados->>'situacao';
    if v_sit in ('cpf_invalido') then return json_build_object('ok', true, 'situacao', v_sit, 'texto', 'CPF inválido: os dígitos não conferem.'); end if;
    if v_sit = 'erro' then return json_build_object('ok', false, 'situacao', v_sit, 'texto', 'A consulta falhou agora. Peça um minutinho e tente de novo.'); end if;
    update credito.leads set cpf_informado = coalesce(p_dados->>'cpf', cpf_informado),
           nome = coalesce(nome, initcap(lower(p_dados->>'nome'))),
           consult_id = coalesce(p_dados->>'consult_id', consult_id),
           status_v8 = coalesce(p_dados->>'status_v8', upper(v_sit)),
           margem = coalesce((p_dados->>'margem')::numeric, margem),
           dados_v8 = coalesce(dados_v8, '{}'::jsonb) || coalesce(p_dados->'cliente', '{}'::jsonb),
           status = case when v_sit in ('com_margem', 'processando') then 'cpf_ok' else status end
     where id = l.id;
    if v_sit = 'sem_margem' then
      update credito.leads set status = 'parou', motivo_parada = left('sem margem: ' || coalesce(p_dados->>'descricao', ''), 200) where id = l.id;
      return json_build_object('ok', true, 'situacao', v_sit, 'texto', 'Sem margem disponível. Motivo da V8: ' || coalesce(p_dados->>'descricao', 'não informado'));
    end if;
    if v_sit = 'nao_encontrado_v8' then return json_build_object('ok', true, 'situacao', v_sit, 'texto', 'CPF sem vínculo CLT encontrado na V8.'); end if;
    if v_sit = 'processando' then return json_build_object('ok', true, 'situacao', v_sit, 'texto', 'Consulta em andamento na V8. Avise que responde em instantes.'); end if;
    return json_build_object('ok', true, 'situacao', v_sit, 'margem', p_dados->'margem', 'texto', 'Aprovado com margem. Os valores serão mostrados na sequência.');

  elsif p_acao = 'salvar_ofertas' then
    if jsonb_array_length(coalesce(p_dados->'ofertas', '[]'::jsonb)) = 0 then
      return json_build_object('ok', false, 'texto', 'A simulação não retornou ofertas.');
    end if;
    update credito.leads set ofertas = p_dados->'ofertas', status = 'simulado', dt_simulou = now(),
           setor_id = case when setor_id in ('recepcao') then 'simulacao' else setor_id end
     where id = l.id;
    insert into credito.simulacoes (lead_id, banco, produto, valor_liberado, parcela, prazo_meses, taxa_mensal, raw_response)
    select l.id, 'v8digital', 'clt', (x->>'valor')::numeric, (x->>'parcela')::numeric, (x->>'prazo')::int, 4.98, x
      from jsonb_array_elements(p_dados->'ofertas') x;
    select string_agg(format('%s) %s em %sx de %s%s', x->>'n', credito.brl((x->>'valor')::numeric), x->>'prazo', credito.brl((x->>'parcela')::numeric),
                             case when (x->>'seguro')::boolean then ' com seguro' else '' end), '; ') into v_seg
      from jsonb_array_elements(p_dados->'ofertas') x;
    return json_build_object('ok', true, 'texto', 'Ofertas: ' || v_seg);

  elsif p_acao = 'apresentou_ofertas' then
    update credito.leads set setor_id = 'vendas', status = 'negociando' where id = l.id and setor_id = 'simulacao';
    return json_build_object('ok', true);

  elsif p_acao = 'escolher_oferta' then
    v_n := nullif(regexp_replace(coalesce(p_dados->>'numero', ''), '\D', '', 'g'), '')::int;
    select x into o from jsonb_array_elements(coalesce(l.ofertas, '[]'::jsonb)) x where (x->>'n')::int = v_n;
    if o is null then return json_build_object('ok', false, 'texto', 'Número de oferta inválido. Ofertas disponíveis: 1 a ' || coalesce(jsonb_array_length(l.ofertas), 0)); end if;
    update credito.leads set oferta = o, valor = (o->>'valor')::numeric, status = 'fechou', dt_fechou = now(), setor_id = 'formalizacao' where id = l.id;
    return json_build_object('ok', true, 'texto', 'Oferta ' || v_n || ' registrada: ' || credito.brl((o->>'valor')::numeric) || ' em ' || (o->>'prazo') || 'x de ' || credito.brl((o->>'parcela')::numeric) || '. Agora peça a chave PIX.');

  elsif p_acao = 'registrar_pix' then
    v_chave := trim(coalesce(p_dados->>'chave', ''));
    v_tipo := lower(coalesce(p_dados->>'tipo', ''));
    v_tipo := case when v_tipo in ('telefone', 'celular', 'phone') then 'phone' when v_tipo in ('aleatoria', 'aleatória', 'random', 'evp') then 'random'
                   when v_tipo in ('email', 'e-mail') then 'email' when v_tipo = 'cpf' then 'cpf' else null end;
    if v_chave = '' or v_tipo is null then return json_build_object('ok', false, 'texto', 'Chave ou tipo inválido. Tipos: cpf, email, phone, random.'); end if;
    if v_tipo = 'cpf' then
      v_chave := regexp_replace(v_chave, '\D', '', 'g');
      if v_chave <> coalesce(l.cpf_informado, '') then return json_build_object('ok', false, 'texto', 'A chave PIX CPF precisa ser o CPF do próprio cliente.'); end if;
    elsif v_tipo = 'phone' then
      v_chave := regexp_replace(v_chave, '\D', '', 'g');
      v_chave := '+' || case when length(v_chave) <= 11 then '55' || v_chave else v_chave end;
    end if;
    update credito.leads set pix = jsonb_build_object('chave', v_chave, 'tipo', v_tipo) where id = l.id;
    return json_build_object('ok', true, 'texto', 'Chave PIX registrada (' || v_tipo || '). Agora chame criar_proposta.');

  elsif p_acao = 'registrar_operacao' then
    update credito.leads set operation_id = p_dados->>'id', formalization_url = p_dados->>'url', status_operacao = 'formalization',
           status = 'link_env', dt_proposta = now() where id = l.id;
    if coalesce((p_dados->>'demo')::boolean, false) = false then
      insert into credito.contratos (lead_id, banco, produto, operation_id, consult_id, tabela, com_seguro, parcelas, valor_liberado, valor_parcela, link_assinatura, status_v8)
      values (l.id, 'v8digital', 'clt', p_dados->>'id', l.consult_id, case when (l.oferta->>'seguro')::boolean then 'CLT Acelera - Seguro' else 'CLT Acelera' end,
              (l.oferta->>'seguro')::boolean, (l.oferta->>'prazo')::int, (l.oferta->>'valor')::numeric, (l.oferta->>'parcela')::numeric, p_dados->>'url', 'formalization');
    end if;
    return json_build_object('ok', true, 'texto', 'Proposta criada. Envie este link de formalização ao cliente: ' || (p_dados->>'url'));

  elsif p_acao = 'atualizar_operacao' then
    v_st := lower(coalesce(p_dados->>'status', ''));
    v_etapa := credito.etapa_contrato(v_st);
    update credito.contratos set status_v8 = v_st where lead_id = l.id and operation_id = l.operation_id and status_v8 is distinct from v_st;
    update credito.leads set status_operacao = v_st,
           status = case when v_etapa in ('formalizado', 'pago') then 'assinou' else status end,
           dt_assinou = case when v_etapa in ('formalizado', 'pago') then coalesce(dt_assinou, now()) else dt_assinou end,
           setor_id = case when v_etapa in ('formalizado', 'pago') then 'posvenda' else setor_id end
     where id = l.id;
    return json_build_object('ok', true, 'mudou', v_st is distinct from l.status_operacao, 'etapa', v_etapa,
      'texto', 'Situação do contrato: ' || case v_etapa when 'aguardando_formalizacao' then 'aguardando o cliente assinar pelo link'
        when 'formalizado' then 'assinado, em análise/processamento para pagamento' when 'pago' then 'PAGO, dinheiro enviado no PIX'
        when 'cancelado' then 'cancelado' else v_st end || ' (' || v_st || ')');

  elsif p_acao = 'pedir_humano' then
    update credito.leads set aguardando = 'humano' where id = l.id;
    insert into credito.alertas (tipo, prioridade, lead_id, titulo, detalhe)
    values ('humano', 1, l.id, coalesce(l.nome, 'Cliente') || ' pediu atendimento humano', left(coalesce(p_dados->>'motivo', ''), 300));
    return json_build_object('ok', true, 'texto', 'Um especialista foi chamado. Diga que um especialista vai continuar o atendimento em instantes.');

  elsif p_acao = 'encerrar' then
    update credito.leads set status = 'parou', motivo_parada = left(coalesce(p_dados->>'motivo', 'cliente não quis'), 200) where id = l.id;
    return json_build_object('ok', true, 'texto', 'Atendimento encerrado. Agradeça e se despeça com gentileza.');

  elsif p_acao = 'recuperou' then
    update credito.leads set recuperacoes = recuperacoes + 1, ultima_recuperacao = now() where id = l.id;
    return json_build_object('ok', true);
  end if;
  return json_build_object('ok', false, 'texto', 'ação desconhecida: ' || p_acao);
end $$;

-- 8. DADOS PARA CRIAR A PROPOSTA NA V8 (borrower) + se deve ser demonstração
create or replace function credito.dados_operacao(p_lead int) returns json language plpgsql as $$
declare l credito.leads%rowtype; e jsonb := credito.config('endereco_padrao'); d jsonb := credito.config('dados_padrao_operacao');
        v_demo boolean; v_fone text; v_falta text;
begin
  select * into l from credito.leads where id = p_lead;
  if l.oferta is null then return json_build_object('ok', false, 'texto', 'Nenhuma oferta escolhida ainda.'); end if;
  if l.pix is null then return json_build_object('ok', false, 'texto', 'Falta registrar a chave PIX (registrar_pix).'); end if;
  if l.operation_id is not null then return json_build_object('ok', false, 'ja_existe', true, 'texto', 'A proposta já foi criada. Link: ' || coalesce(l.formalization_url, '')); end if;
  v_demo := l.teste or coalesce((credito.config('formalizacao_real'))::text, 'false') <> 'true' or coalesce(l.consult_id, '') = 'demo';
  v_falta := case when d->>'mother_name' is null and not v_demo then 'nome da mãe' end;
  if v_falta is not null then return json_build_object('ok', false, 'texto', 'Faltam dados obrigatórios da V8 (' || v_falta || '). Use pedir_humano.'); end if;
  v_fone := regexp_replace(coalesce(l.dados_v8->>'telefone', l.telefone, ''), '\D', '', 'g');
  return json_build_object('ok', true, 'demo', v_demo, 'simulation_id', l.oferta->>'sim_id', 'payload', json_build_object(
    'simulation_id', l.oferta->>'sim_id',
    'borrower', json_build_object(
      'name', upper(coalesce(l.dados_v8->>'nome', l.nome)), 'email', coalesce(nullif(l.dados_v8->>'email', ''), 'sem@email.com'),
      'phone', json_build_object('country_code', '55', 'area_code', left(v_fone, 2), 'number', substr(v_fone, 3)),
      'political_exposition', coalesce((d->>'political_exposition')::boolean, false),
      'address', json_build_object('city', e->>'cidade', 'state', e->>'uf', 'number', e->>'numero', 'street', e->>'logradouro',
                                   'complement', '', 'postal_code', e->>'cep', 'neighborhood', e->>'bairro'),
      'birth_date', l.dados_v8->>'nascimento', 'mother_name', d->>'mother_name', 'nationality', d->>'nationality',
      'document_issuer', d->>'document_issuer', 'gender', coalesce(l.dados_v8->>'genero', 'male'), 'person_type', 'natural',
      'marital_status', d->>'marital_status', 'individual_document_number', l.cpf_informado,
      'document_identification_date', null, 'document_identification_type', d->>'document_identification_type',
      'document_identification_number', d->>'document_identification_number',
      'bank', json_build_object('transfer_method', 'pix', 'pix_key', l.pix->>'chave', 'pix_key_type', l.pix->>'tipo'))));
end $$;

-- 9. MENSAGENS NOVAS de um cliente (o chat de teste busca as mensagens que os agentes mandam sozinhos)
create or replace function credito.mensagens_novas(p_telefone text, p_depois bigint) returns json language sql stable as $$
  select json_build_object(
    'mensagens', coalesce((select json_agg(json_build_object('id', c.id, 'texto', c.conteudo, 'agente', a.nome, 'versao', c.agente_versao,
                                   'setor', c.setor_id, 'modo', c.modo, 'em', c.criado_em) order by c.id)
                  from credito.conversas c left join credito.agentes a on a.id = c.agente_id
                  join credito.leads l on l.id = c.lead_id
                 where l.telefone = p_telefone and c.direcao = 'saida' and c.id > p_depois), '[]'::json),
    'lead', (select json_build_object('id', l.id, 'setor', l.setor_id, 'status', l.status, 'aguardando', l.aguardando, 'operacao', l.status_operacao,
                    'agente', (select json_build_object('nome', a.nome, 'versao', a.versao, 'abordagem', a.abordagem) from credito.agentes a where a.id = l.agente_id),
                    'jornada', (select json_agg(json_build_object('setor', t.setor_id, 'agente', a.nome, 'versao', a.versao) order by t.inicio)
                                  from credito.atribuicoes t join credito.agentes a on a.id = t.agente_id where t.lead_id = l.id))
               from credito.leads l where l.telefone = p_telefone order by l.criado_em desc limit 1)) $$;

-- 10. registrar_resposta guarda também o modo (resposta / apresentar / recuperar / aviso)
create or replace function credito.registrar_resposta(p_lead int, p_agente int, p_baloes json, p_modo text)
returns json language plpgsql as $$
declare v_setor text; v_versao text; b text; v_ids bigint[] := '{}'; v_id bigint;
begin
  select setor_id into v_setor from credito.agentes where id = p_agente;
  select versao into v_versao from credito.agentes where id = p_agente;
  for b in select json_array_elements_text(p_baloes) loop
    insert into credito.conversas (lead_id, agente_id, direcao, conteudo, setor_id, agente_versao, modo)
    values (p_lead, p_agente, 'saida', b, v_setor, v_versao, p_modo) returning id into v_id;
    v_ids := v_ids || v_id;
  end loop;
  update credito.leads set aguardando = case when aguardando = 'humano' then 'humano' else 'cliente' end,
         ultima_interacao = case when p_modo = 'recuperar' then ultima_interacao else now() end where id = p_lead;
  update credito.agentes set status = 'livre', ultima_atividade = now() where id = p_agente;
  return json_build_object('ok', true, 'ids', v_ids, 'baloes', p_baloes);
end $$;
create or replace function credito.registrar_resposta(p_lead int, p_agente int, p_baloes json) returns json language sql as $$
  select credito.registrar_resposta(p_lead, p_agente, p_baloes, 'resposta') $$;

-- 11. FILA DO ACOMPANHAMENTO (consultas em andamento, contratos abertos e clientes para recuperar)
create or replace function credito.fila_acompanhamento() returns json language sql stable as $$
  with r as (select credito.config('recuperacao') c)
  select json_build_object(
    'consultas', coalesce((select json_agg(json_build_object('lead_id', id, 'cpf', cpf_informado)) from credito.leads
                   where status = 'cpf_ok' and status_v8 in ('PROCESSANDO', 'WAITING_CONSULT', 'WAITING_CREDIT_ANALYSIS', 'CONSENT_APPROVED', 'WAITING_CONSENT', 'PROCESSING', 'PENDING')
                     and coalesce(consult_id, '') <> 'demo' and cpf_informado is not null), '[]'::json),
    'operacoes', coalesce((select json_agg(json_build_object('lead_id', id, 'operation_id', operation_id)) from credito.leads
                   where operation_id is not null and operation_id not like 'demo-%' and coalesce(status_operacao, '') not in ('paid', 'canceled', 'refunded')), '[]'::json),
    'recuperar', coalesce((select json_agg(json_build_object('lead_id', l.id)) from credito.leads l, r
                   where l.aguardando = 'cliente' and l.status not in ('parou', 'assinou')
                     and l.recuperacoes < coalesce((r.c->>'max_tentativas')::int, 3)
                     and l.ultima_interacao < now() - make_interval(mins => case when l.teste then coalesce((r.c->>'minutos_teste')::int, 3) else coalesce((r.c->>'minutos')::int, 120) end)
                     and (l.ultima_recuperacao is null or l.ultima_recuperacao < now() - make_interval(mins => case when l.teste then coalesce((r.c->>'minutos_teste')::int, 3) else coalesce((r.c->>'minutos')::int, 120) end))), '[]'::json)) $$;

-- 12. ações de teste do chat: simular assinatura / pagamento de um contrato de demonstração
create or replace function credito.evento_teste(p_telefone text, p_evento text) returns json language plpgsql as $$
declare l credito.leads%rowtype;
begin
  select * into l from credito.leads where telefone = p_telefone and teste order by criado_em desc limit 1;
  if l.id is null or l.operation_id is null then return json_build_object('ok', false, 'texto', 'Esse cliente ainda não tem proposta.'); end if;
  return (credito.acao_agente(l.id, 'atualizar_operacao', jsonb_build_object('status', case p_evento when 'assinou' then 'analysis' when 'pagou' then 'paid' else p_evento end))::jsonb
         || jsonb_build_object('lead_id', l.id))::json;
end $$;

-- 13. atalho usado pelo n8n: executa a ação e devolve também o setor atual do cliente
create or replace function credito.acao(p_lead int, p_acao text, p_dados jsonb default '{}'::jsonb) returns json language plpgsql as $$
declare r json;
begin
  r := credito.acao_agente(p_lead, p_acao, coalesce(p_dados, '{}'::jsonb));
  return (r::jsonb || jsonb_build_object('setor', (select setor_id from credito.leads where id = p_lead)))::json;
end $$;
