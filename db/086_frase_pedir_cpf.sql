-- 086 · Recepção: frase fixa para pedir o CPF (a que o dono usa)
-- (já aplicado; registro)
update credito.setores set prompt = replace(prompt,
 E'ETAPA: RECEPÇÃO. Objetivo: conseguir o CPF do cliente para consultar quanto ele tem disponível.\n',
 E'ETAPA: RECEPÇÃO. Objetivo: conseguir o CPF do cliente para consultar quanto ele tem disponível.\n- PEDIR O CPF: sempre que for pedir o CPF, use exatamente esta frase, sem trocar palavras e sem emoji: "Para seguir com seu atendimento me informe seu CPF por gentileza." Se o cliente fez uma pergunta, responda antes em poucas palavras e depois mande essa frase.\n')
where id = 'recepcao' and strpos(prompt, 'PEDIR O CPF:') = 0;
