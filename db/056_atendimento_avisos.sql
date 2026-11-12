-- 056: 6775 (gmcred-campanha, atendimento) passa a mandar os avisos do grupo e a receber as conversas
-- de números que caírem; 1361 (gmcred-6) vira número de disparo.
update credito.configuracoes set valor = valor || '{"instancia":"gmcred-campanha","reserva":["gmcred-6","gmcred-4","gmcred-5","gmcred-3","gmcred-2"]}'::jsonb where chave = 'avisos';
update credito.configuracoes set valor = valor || '{"reserva":"gmcred-campanha"}'::jsonb where chave = 'atendente';
update credito.wpp_chips set funcao = 'disparo' where nome = 'gmcred-6';
update credito.configuracoes set valor = valor || '{"numero":"554899996775","instancia":"gmcred-campanha"}'::jsonb where chave = 'indicacao';
