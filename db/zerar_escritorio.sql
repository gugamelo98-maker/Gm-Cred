-- ZERAR O ESCRITÓRIO VIRTUAL (rodar só quando o dono pedir, antes de ligar os números de WhatsApp)
-- NÃO roda sozinho. Antes de rodar:
--   1. cancelar na V8 toda proposta real ainda aberta (select id, nome, operation_id from credito.leads
--      where operation_id is not null and operation_id not like 'demo-%' and coalesce(status_operacao,'') not in ('canceled','refunded'));
--   2. conferir as contagens abaixo.
-- Apaga: leads, conversas, atribuições (placar A/B/C), simulações, eventos, alertas e contratos.
-- Mantém: agentes, setores, prompts, configurações, respostas prontas, acessos, token V8, metas, comissões
--         e as tabelas do Pipeline CLT (clientes, extracoes) — essas não são do escritório.
begin;
select (select count(*) from credito.leads) leads, (select count(*) from credito.conversas) conversas,
       (select count(*) from credito.atribuicoes) atribuicoes, (select count(*) from credito.contratos) contratos;
delete from credito.eventos;
delete from credito.simulacoes;
delete from credito.conversas;
delete from credito.alertas;
delete from credito.atribuicoes;
delete from credito.contratos;
delete from credito.leads;
commit;
