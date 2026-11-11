-- Empresa virtual CLT — follow-up 1/3/7 dias para quem recebeu proposta + cola de objeções (material HUB Academy)
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-11.
--  * configuracoes.recuperacao.tempos_proposta = [20,180,1440,4320,10080] (minutos desde a última mensagem do cliente):
--    quem recebeu proposta (ofertas) ou link (operation_id) ganha mais 2 toques: dia 3 (traz algo novo, sem pressão)
--    e dia 7 (despedida educada, sem vender). Os demais continuam com tempos = [20,180,1440].
--  * fila_acompanhamento(): escolhe tempos_proposta ou tempos por lead (replace).
--  * contexto_agente(): instrução específica para o toque do 3º dia (recuperacoes = 3) e o último (>= 4).
--  * regras_gerais: "COLA DE OBJEÇÕES" — referência para a IA, não roteiro (ela responde com as próprias palavras).
update credito.configuracoes set valor = valor || '{"tempos_proposta":[20,180,1440,4320,10080]}'::jsonb where chave = 'recuperacao';

-- 11/11: leads.sem_followup — o dono pediu que os clientes da campanha de 10/11 (36, todos os leads até então)
-- não recebam follow-up/recuperação. fila_acompanhamento() ignora sem_followup = true.
-- Se o cliente mandar mensagem, a IA continua respondendo normalmente.
alter table credito.leads add column if not exists sem_followup boolean not null default false;
update credito.leads set sem_followup = true where not teste and (criado_em at time zone 'America/Sao_Paulo')::date <= date '2026-11-10';
-- Correção do dono: Juliana (104) e Liomar (88) receberam proposta e PODEM ter follow-up.
-- Quem nunca respondeu já não recebe follow-up pela regra (prospecção / dt_respondeu nulo).
update credito.leads set sem_followup = false where id in (88, 104);
