-- Empresa virtual CLT — consulta em andamento sem reconsultar e sem repetir mensagens
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-09. Idempotente.
-- (no n8n: Ações não chama a V8 de novo enquanto a consulta está em andamento, exceto pelo Acompanhamento,
--  que agora roda a cada 1 minuto)

update credito.setores set prompt = replace(prompt,
  '- processando: diga que está consultando e que avisa em instantes.',
  '- processando: diga que está consultando e que avisa assim que sair o resultado.
- Se nos DADOS DO CLIENTE a consulta já estiver em andamento (PROCESSANDO, WAITING_... ou CONSENT_APPROVED), NÃO chame consultar_cpf de novo: o sistema avisa sozinho quando sair. Se o cliente só confirmar, responda bem curto com outras palavras. Se ele perguntar se já saiu, diga que ainda está aguardando o retorno do banco e que manda assim que chegar.')
where id = 'recepcao' and prompt not like '%NÃO chame consultar_cpf de novo%';

update credito.setores set prompt = prompt || E'\n- Se o cliente perguntar se "já saiu" ou pelo resultado, diga que sim, os valores já estão aí em cima, e retome as ofertas em uma frase.'
where id = 'vendas' and prompt not like '%já saiu%';

update credito.configuracoes set valor = to_jsonb((valor #>> '{}') || E'\n- Nunca repita a mesma mensagem que você já mandou na conversa. Se o cliente só confirmar ("ok", "beleza", "tá"), responda curto e siga o próximo passo.'::text), atualizado_em = now()
where chave = 'regras_gerais' and (valor #>> '{}') not like '%Nunca repita a mesma mensagem%';

create or replace function credito.consulta_em_andamento(p_lead int) returns boolean language sql stable as $$
  select coalesce(status_v8 in ('PROCESSANDO', 'WAITING_CONSULT', 'WAITING_CREDIT_ANALYSIS', 'CONSENT_APPROVED', 'WAITING_CONSENT', 'PROCESSING', 'PENDING')
         and atualizado_em > now() - interval '10 minutes', false)
  from credito.leads where id = p_lead $$;

-- contexto_agente passa a mostrar a última mensagem da Ana com a ordem de não repetir
-- (versão completa aplicada no banco; igual à de 007 com o bloco "SUA ÚLTIMA MENSAGEM FOI" no fim do prompt)
