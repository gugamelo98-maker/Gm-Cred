-- Empresa virtual CLT — follow-up 1/3/7 dias para quem recebeu proposta + cola de objeções (material HUB Academy)
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-11.
--  * configuracoes.recuperacao.tempos_proposta = [20,180,1440,4320,10080] (minutos desde a última mensagem do cliente):
--    quem recebeu proposta (ofertas) ou link (operation_id) ganha mais 2 toques: dia 3 (traz algo novo, sem pressão)
--    e dia 7 (despedida educada, sem vender). Os demais continuam com tempos = [20,180,1440].
--  * fila_acompanhamento(): escolhe tempos_proposta ou tempos por lead (replace).
--  * contexto_agente(): instrução específica para o toque do 3º dia (recuperacoes = 3) e o último (>= 4).
--  * regras_gerais: "COLA DE OBJEÇÕES" — referência para a IA, não roteiro (ela responde com as próprias palavras).
update credito.configuracoes set valor = valor || '{"tempos_proposta":[20,180,1440,4320,10080]}'::jsonb where chave = 'recuperacao';
