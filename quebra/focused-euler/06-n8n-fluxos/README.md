# 06-n8n-fluxos — n8n · geradores e fluxos (Roteador, Agente, Ações, V8, Acompanhamento, Unno)

Fluxos do n8n (Cloudfy) escritos com o `@n8n/workflow-sdk`. Os `gerar_*.js` são os geradores: o SDK não aceita funções auxiliares, então eles "achatam" o código e geram os fluxos prontos (`roteador.js`, `agente.js`, `acoes.js`, `v8_ferramentas.js`, `acompanhamento.js`). Quase toda a regra de negócio fica em funções do Postgres (`credito.*`); o n8n chama essas funções, o modelo de IA (OpenRouter) e as APIs dos bancos.

| Arquivo | O que é |
|---|---|
| `n8n/acoes.js` | **Ações** do agente: consultar_cpf, simular, criar_proposta, status_proposta, escolher_oferta, registrar_pix, pedir_humano, encerrar… |
| `n8n/acompanhamento.js` | **Acompanhamento**: a cada 2 min lê `credito.fila_acompanhamento()` e reconsulta CPFs, acompanha propostas e dispara a recuperação |
| `n8n/agente.js` | **Agente**: monta o contexto (`credito.contexto_agente`), chama o modelo (OpenRouter) com as ferramentas e devolve as mensagens |
| `n8n/gerar_agentes.js` | Gerador dos fluxos V8 Ferramentas, Ações, Agente e Acompanhamento (`node gerar_agentes.js <qual> [ids]`) |
| `n8n/gerar_roteador.js` | Gerador do Roteador |
| `n8n/gerar_v8.js` | Gerador da ferramenta V8 |
| `n8n/roteador.js` | **Roteador**: webhook `POST gmcred/chat`, entrada única das mensagens → valida a chave → `credito.receber_mensagem` → setor → agente sorteado |
| `n8n/unno_ana_codigo.js` | Código do nó da Unno (margem e vínculo, simulação e proposta pela API da Unno) |
| `n8n/v8_ferramentas.js` | **V8 Ferramentas**: token em cache (`credito.v8_token`), login OAuth na V8, consulta de margem, simulação e operação |
