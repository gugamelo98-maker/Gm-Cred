-- 054: disparo com várias mensagens (teste A/B). disparos.mensagens = [{texto, variacoes[]}] (até 5);
-- cada envio vai para a mensagem que menos saiu no disparo e sorteia uma variação dela.
-- disparo_contatos.msg guarda qual mensagem o cliente recebeu; disparo_api devolve por_mensagem.
-- Aplicado no banco via credito.disparo_escolher() + credito.mig054() (patch de disparo_passo e disparo_api).
alter table credito.disparos add column if not exists mensagens jsonb not null default '[]';
alter table credito.disparo_contatos add column if not exists msg int;
