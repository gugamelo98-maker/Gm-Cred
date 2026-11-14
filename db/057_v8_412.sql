-- 057: 412 da V8 ("Erro ao autorizarConsultaDadosTrabalhador: 412", ex.: fora do horário 5h–00h) não marca o cliente
-- como "sem margem". acao_agente(aplicar_consulta) põe status_v8 = 'REAUTORIZAR' e reconsultar_em (10 min, ou 05:05
-- se for madrugada); fila_acompanhamento reconsulta quando chega a hora (o fluxo V8 cria consulta nova quando a última
-- foi 412). Depois de 6 tentativas, encerra com "V8 não liberou a consulta (412)" — nunca "sem margem".
alter table credito.leads add column if not exists reconsultar_em timestamptz;
alter table credito.leads add column if not exists tentativas_412 int not null default 0;
-- funções alteradas no banco via credito.mig057(): acao_agente, fila_acompanhamento
-- n8n "GM Cred · V8 Ferramentas" › Analisar busca: última consulta REJECTED com 412 + consultar_cpf → criar consulta nova
-- (12/11 10h) DESFEITO no n8n: "Analisar busca" criar consulta nova quando a última era 412 fazia o Acompanhamento
-- gerar 1 consulta nova por minuto. Voltou ao original: 412 → sem_margem → acao_agente marca REAUTORIZAR (não "sem margem").
