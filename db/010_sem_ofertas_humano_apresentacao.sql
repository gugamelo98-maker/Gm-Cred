-- Empresa virtual CLT — simulação sem ofertas chama um especialista de verdade; apresentação da Ana sem "assistente virtual"
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-09. Idempotente.

-- 1. sem nenhuma oferta aprovada na V8: abre alerta para um humano e a IA para de responder esse cliente
create or replace function credito.acao(p_lead int, p_acao text, p_dados jsonb default '{}'::jsonb) returns json language plpgsql as $$
declare r json; v_status text; v_oferta jsonb; v_teste boolean;
begin
  select status, oferta, teste into v_status, v_oferta, v_teste from credito.leads where id = p_lead;
  if p_acao = 'registrar_pix' and v_oferta is null then
    return json_build_object('ok', false, 'texto', 'A oferta ainda não foi registrada. Primeiro chame escolher_oferta com o número que o cliente escolheu.',
                             'setor', (select setor_id from credito.leads where id = p_lead));
  end if;
  if p_acao = 'salvar_ofertas' and jsonb_array_length(coalesce(p_dados->'ofertas', '[]'::jsonb)) = 0 then
    perform credito.acao_agente(p_lead, 'pedir_humano', jsonb_build_object('motivo',
      'A V8 aprovou a margem, mas não aceitou nenhuma simulação automática: ' ||
      coalesce((select string_agg(e, '; ') from jsonb_array_elements_text(coalesce(p_dados->'erros', '[]'::jsonb)) e), 'sem detalhes')));
    return json_build_object('ok', false, 'humano', true, 'setor', (select setor_id from credito.leads where id = p_lead),
      'texto', 'Um especialista foi chamado para montar a proposta manualmente. Diga que deu certo a consulta e que um especialista da equipe vai continuar o atendimento em instantes com os valores. Não diga valores.');
  end if;
  if p_acao = 'registrar_operacao' and v_teste then p_dados := coalesce(p_dados, '{}'::jsonb) || '{"demo":true}'::jsonb; end if;
  r := credito.acao_agente(p_lead, p_acao, coalesce(p_dados, '{}'::jsonb));
  if p_acao = 'salvar_ofertas' and v_status in ('negociando') then update credito.leads set status = v_status where id = p_lead; end if;
  return (r::jsonb || jsonb_build_object('setor', (select setor_id from credito.leads where id = p_lead)))::json;
end $$;

-- 2. a Ana se apresenta só como "Ana, da GM Cred" e nunca puxa o assunto de ser assistente virtual.
--    Se o cliente perguntar sinceramente se fala com robô/IA, ela não mente: confirma em uma frase e oferece um humano.
update credito.configuracoes set valor = to_jsonb(replace(valor #>> '{}',
  '- Se perguntarem se você é robô: você é a Ana, assistente virtual da GM Cred, e tem um especialista acompanhando o atendimento.',
  '- Apresente-se só como "Ana, da GM Cred". Converse de forma natural e humana; nunca diga por conta própria que é assistente virtual, robô ou IA.
- Só se o cliente perguntar diretamente se está falando com um robô ou uma IA, não minta: confirme em uma frase curta e ofereça chamar alguém da equipe (pedir_humano se ele quiser).')),
  atualizado_em = now()
where chave = 'regras_gerais';

update credito.respostas_prontas set pergunta = 'Você é robô? (só se o cliente perguntar)',
  resposta = 'Sou a Ana, assistente virtual da GM Cred 😊 Se preferir, chamo alguém da equipe pra falar com você.' where tema = 'robo';

-- 3. seguro só é "opcional" quando existem ofertas com e sem seguro; listas numeradas sem asterisco
update credito.configuracoes set valor = to_jsonb(replace(replace(valor #>> '{}',
  '- O seguro é sempre opcional: o cliente escolhe com ou sem.',
  '- Seguro: quando houver ofertas com e sem seguro, o cliente escolhe. Se todas as ofertas forem com seguro (regra da V8 para esse cliente), não diga que é opcional.'),
  '- No máximo 1 emoji por mensagem. Use *negrito* só para valores.',
  '- No máximo 1 emoji por mensagem. Use *negrito* só para valores. Em listas, numere as linhas assim: 1) ... 2) ... (nunca comece linha com *).')),
  atualizado_em = now()
where chave = 'regras_gerais';
update credito.setores set prompt = replace(prompt, '- Diga em poucas palavras que o seguro é opcional.',
  '- Se houver ofertas com e sem seguro, diga em poucas palavras que o seguro é opcional. Se todas forem com seguro, não fale disso.') where id = 'simulacao';

-- (no n8n: a simulação agora testa 46/36/24/12x com e sem seguro e mostra as que a V8 aceitar;
--  sem nenhuma aceita, o especialista é chamado de verdade)
