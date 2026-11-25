-- 117 · Motor: quem consultou cada CPF.
-- motor_consultas.usuario_id = (credito.painel_sessao(k)).id na ação 'consultar' de credito.motor_api.
-- painel_dados_api acao 'motor_historico' (admin/gestor) -> credito.painel_motor_historico(u, {dias, usuario}).
alter table credito.motor_consultas add column if not exists usuario_id bigint;
create index if not exists motor_consultas_criado_idx on credito.motor_consultas (criado_em desc);
