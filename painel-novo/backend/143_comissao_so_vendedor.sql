-- 143 · Comissões ('meu'): o vendedor vê só a comissão dele, nunca a da empresa.
-- credito.comissoes_api, ação 'meu': tira comissao_empresa do mês e dos contratos e manda
-- 'comissao' = comissao_empresa × % da faixa (CLT) ou % FGTS. Removidas também as 'regras'.
-- A tela mostra a coluna "Sua comissão" para atendentes e "Comissão GM" só para admin.

-- Admin: 'equipe' devolve em cada contrato 'comissao' = parte do vendedor (0 se o contrato é do admin);
-- a tela mostra Comissão total / Vendedor / GM (líquido) e o KPI "Comissão GM no mês (líquida)".
-- Nova ação admin 'equipe_periodo' {ini, fim}: soma da parte da equipe nos contratos pagos no período.
-- Financeiro: Lucro = receita − comissão da equipe − gastos.
