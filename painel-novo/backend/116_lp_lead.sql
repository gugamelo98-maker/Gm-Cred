-- 116 · Lead da landing page (gmcredconsignado.com.br) via webhook n8n lp/lead (workflow "[LP] 📝 Lead da landing page").
-- Origem 'trafego_lp' (aparece como Tráfego no painel/BI). produto 'clt' (3+ meses de carteira) ou 'fgts' (menos de 3 meses).
-- Devolve o link do WhatsApp do número conectado (atendimento primeiro) com nome e CPF na mensagem.
-- Função credito.lp_lead(p jsonb) aplicada no banco (ver sessão).

-- Lead do tráfego fica só com o admin por enquanto:
--  * lp_lead cria o lead com painel_responsavel = primeiro admin ativo;
--  * painel_dados_api (estado): atendente com escopo 'todos' não vê clientes de origem 'trafego_lp',
--    só os que forem dele (painel_responsavel = u.id).
