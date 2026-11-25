-- 115 · Ao vivo: presença da equipe (ping do painel a cada 45s) + produção do dia por pessoa.
-- painel_dados_api: acoes 'ping' (qualquer usuário) e 'ao_vivo' (admin/gestor) -> credito.painel_ao_vivo(u, p_acao, p)
-- Mensagens humanas são atribuídas ao responsável do cliente (credito.conversas não guarda o autor).
alter table credito.painel_usuarios add column if not exists visto_em timestamptz;
alter table credito.painel_usuarios add column if not exists visto_aba text;
-- função credito.painel_ao_vivo aplicada no banco (ver histórico da sessão); status: online < 2 min, ausente < 15 min, offline.
