-- Empresa virtual CLT — consulta quando a V8 não tem o cadastro do CPF
-- Aplicado em 2026-11-11 (banco + n8n). O Pipeline CLT (testeextrair) NÃO foi alterado.
--  * Antes: se /consult/client-data/basic/{cpf} desse 404, a consulta nem era criada e a Ana dizia "não achou vínculo CLT"
--    (rejeição que não aconteceu). Vínculo/margem de verdade vem da consulta (REJECTED + motivo) e já vira "sem margem".
--  * Agora: situação 'precisa_dados' -> a Ana pede NOME COMPLETO e DATA DE NASCIMENTO e chama consultar_cpf de novo;
--    o fluxo cria a consulta (autorização) com esses dados e ela roda normalmente na V8.
--  n8n:
--   - "GM Cred · Agente", ferramenta consultar_cpf: novos campos opcionais nome_completo (-> tipo) e nascimento (-> chave).
--   - "GM Cred · Ações", nó "V8: consultar CPF": dados = {nome, nascimento}.
--   - "GM Cred · V8 Ferramentas": "Achou na V8?" segue também quando vierem nome+nascimento; "Criar consulta" usa os dados
--     do cliente quando a V8 não tem (nascimento DD/MM/AAAA -> AAAA-MM-DD); "Não encontrado" devolve 'precisa_dados'.
--  banco: acao_agente(aplicar_consulta) trata 'precisa_dados'; prompts de setor sem "carteira assinada".
update credito.setores set prompt = replace(prompt, '- nao_encontrado_v8: diga que não achou vínculo CLT ativo para esse CPF e pergunte se ele trabalha de carteira assinada.', '- precisa_dados: a V8 não tem o cadastro do CPF; peça o nome completo e a data de nascimento e consulte de novo com esses dados.') where prompt like '%nao_encontrado_v8%';
update credito.setores set prompt = replace(prompt, 'peça a indicação de amigos que trabalham de carteira assinada.', 'peça a indicação de amigos que também são CLT.') where id = 'posvenda';
