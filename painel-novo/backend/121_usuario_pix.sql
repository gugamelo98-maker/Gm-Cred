-- 121 · Chave PIX do usuário (para pagar comissão). painel_usuarios.pix; painel_json devolve 'pix';
-- painel_api acao 'pix' {id, pix} (só admin). O painel salva o usuário e depois a chave.
alter table credito.painel_usuarios add column if not exists pix text;
