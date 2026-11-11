-- Empresa virtual CLT — 1ª mensagem da campanha: uma por número, com variações e placar
-- Aplicado no Postgres da Cloudfy, schema "credito", em 2026-11-11.
--  * wpp_chips.mensagem: mensagem-base de cada número (aprovadas pelo dono em 11/11):
--      gmcred-2 (9116-5233): Oi {nome}, tudo bem? Aqui é a Ana, da GM Cred. Posso consultar se tem crédito CLT disponível pra você?
--      gmcred-3 (9221-9003): Olá {nome}! Sou a Ana, da GM Cred. Quer que eu veja rapidinho se existe uma opção de crédito CLT pra você?
--      gmcred-4 (9209-2780): Oi {nome}! Ana aqui, da GM Cred. Estou verificando crédito CLT pra alguns clientes. Quer que eu veja o seu?
--      gmcred-5 (9164-9463): Opa {nome}, tudo certo? Aqui é a Ana, da GM Cred. Posso dar uma olhada na disponibilidade de crédito CLT pra você?
--      gmcred-campanha (9999-6775): {nome}, tudo bem? É a Ana, da GM Cred. Quer que eu consulte se tem crédito CLT disponível pra você?
--  * credito.variar_msg(texto, nome): troca saudação pelo horário, "tudo bem/tudo certo/como vai", "Aqui é/Sou/É a Ana",
--    emoji opcional; sem nome, tira o {nome} sem deixar vírgula sobrando.
--  * campanha_contatos.instancia: por qual número saiu; credito.campanha_placar(): enviadas/responderam/CPF/proposta/link
--    por número (a partir de 11/11). campanha_api(ver) devolve 'placar'; numeros_api(salvar) aceita 'mensagem'.
--  * campanha_passo(): usa a mensagem do número (ou a padrão) passada por variar_msg.
alter table credito.wpp_chips add column if not exists mensagem text;
alter table credito.campanha_contatos add column if not exists instancia text;

-- 11/11 (v2): lista fria — o número pode não ser de quem está no cadastro. Por isso:
--  * as 5 mensagens ficaram SEM {nome} (quem não é a pessoa também pode responder e virar um CPF novo);
--  * regra "NÚMERO DE OUTRA PESSOA" (substitui "NÚMERO ERRADO"): não usar o nome do cadastro antes de confirmar o CPF;
--    se a pessoa não for a do cadastro, oferecer a consulta para ELA e pedir o CPF dela; só encerrar como
--    "número errado" se ela não tiver interesse;
--  * acao_agente(aplicar_consulta): se o CPF consultado for diferente do cpf_base, o nome do lead passa a ser o da V8.
