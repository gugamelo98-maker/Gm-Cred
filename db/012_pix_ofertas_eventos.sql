-- Empresa virtual CLT — ofertas só com valor/prazo/parcela, PIX "no nome do cliente", simular eventos na proposta real de teste
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-09. Idempotente.

-- 1. ofertas sem "no PIX"
do $$ declare f text; begin
  f := pg_get_functiondef('credito.contexto_agente(int,text,text)'::regprocedure);
  if position(' no PIX em ' in f) > 0 then execute replace(f, ' no PIX em ', ' em '); end if;
end $$;
update credito.setores set prompt = replace(prompt, 'usando só os valores listados (valor que cai no PIX e parcela por mês)', 'usando só os valores listados: valor, prazo e parcela (não fale de PIX aqui)') where id = 'simulacao';
update credito.configuracoes set valor = to_jsonb((valor #>> '{}') || E'\n- Ao falar de ofertas ou da oferta escolhida, informe só valor, prazo e parcela (ex.: "R$ 5.963,85 em 36x de R$ 449,47"). Não diga "no PIX" junto do valor.'::text), atualizado_em = now()
where chave = 'regras_gerais' and (valor #>> '{}') not like '%Não diga "no PIX"%';
update credito.configuracoes set valor = to_jsonb((valor #>> '{}') || E'\n- Não prometa prazo de liberação do dinheiro (nada de "na hora", "hoje" ou "em minutos").'::text), atualizado_em = now()
where chave = 'regras_gerais' and (valor #>> '{}') not like '%Não prometa prazo de liberação%';

-- 2. PIX: só avisar que precisa estar no nome do cliente; "é o meu CPF" usa o CPF já informado
update credito.setores set prompt = replace(prompt, '- Depois que a ferramenta confirmar, repita valor e parcelas em uma frase e peça a chave PIX para receber.',
  '- Depois que a ferramenta confirmar, repita valor, prazo e parcela em uma frase e peça a chave PIX dizendo só que ela precisa estar no nome do cliente (sem pedir confirmação de titularidade).')
where id = 'vendas';
update credito.setores set prompt = $t$ETAPA: FORMALIZAÇÃO. A oferta já foi escolhida. A única informação que você pede é a chave PIX.
- Ao pedir a chave PIX, diga só que ela precisa estar no nome do cliente. Não pergunte se a chave é dele nem peça confirmação.
- Identifique o tipo (cpf, email, phone ou random) e chame registrar_pix.
- Se o cliente disser que a chave é o CPF dele, chame registrar_pix com tipo cpf e o CPF que ele já informou (não peça o CPF de novo).
- Em seguida chame criar_proposta e envie o link de formalização que vier no resultado.
- Explique em 1 ou 2 frases: abrir o link, conferir os dados, fazer a selfie e assinar. Ajude passo a passo se ele tiver dificuldade.
- Para saber se ele já assinou, use status_proposta.$t$ where id = 'formalizacao';
-- (credito.acao: tipo cpf sem 11 dígitos -> usa o cpf_informado; versão completa aplicada no banco)

-- 3. simular assinatura/pagamento também na proposta real do chat de teste (muda só no nosso sistema)
alter table credito.leads add column if not exists evento_simulado boolean not null default false;
-- evento_teste marca evento_simulado; fila_acompanhamento ignora essas propostas; Ações trata como demonstração no status
