-- 102 · leads.banco_escolhido aceita 'unno'
-- Aplicado no banco em 2026-11-18 (autorizado pelo dono). unno.ativo segue false.
alter table credito.leads drop constraint if exists leads_banco_escolhido_check;
alter table credito.leads add constraint leads_banco_escolhido_check
  check (banco_escolhido = any (array['hubcredito','v8digital','unno']));
