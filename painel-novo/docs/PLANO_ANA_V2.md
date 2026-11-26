# Plano · Ana v2 (sistema + IA) — atendimento automático CLT

Combinado com o Gustavo em 26/11/2026. **Nada construído ainda.** Primeiro produto: **CLT**. FGTS fica para depois.

## Princípio

- **O código decide e executa; a IA só conversa.** A Ana antiga fazia tudo (entender, consultar, calcular, decidir, escrever) e delirava.
- A IA recebe só: **o momento do cliente**, **as ofertas reais** e **as últimas mensagens**. Devolve: **o texto** + **uma decisão estruturada** (ex.: `escolheu_oferta`, `parcela_menor {valor}`, `dados {mae, pix|conta}`, `transferir`).
- **Máximo no banco (Postgres), mínimo de Code node no n8n** (a fila de código do n8n já estoura — "Task request timed out").
- Roda **24h**, sozinho, sem o Gustavo presente.

## Regras combinadas

### 1. Entrada (sistema)
- Só nos números com função **atendimento**. **Número de vendedor/colaborador nunca tem IA.**
- CPF: o do sistema (disparo = o CPF que subimos na lista; tráfego/LP = o CPF que veio na conversa/formulário). **Sem CPF → a IA pede o CPF.**
- Produto pela mensagem do cliente: disparo e tráfego sempre trazem "CLT" ou "FGTS" (regra de texto, sem IA).

### 2. Simulação e proposta (sistema)
- **Espera o retorno de todos os bancos** antes de montar a proposta.
- Bancos no CLT: **V8 e Unno**. **HUB sai da simulação CLT e do Motor.**
- Escolhe a oferta de **maior comissão**.
- Manda **36x e 24x** da tabela vencedora (nunca o prazo máximo). Se não vierem esses prazos, **2 prazos da mesma tabela**.
- Mensagem padrão, sem citar outros bancos.

### 3. Negociação (IA)
- Comporta-se como pessoa; **nunca diz que é robô nem que vai chamar alguém**.
- Taxa = "padrão de todos os bancos"; **não oferece outro banco**.
- **Parcela menor:** só se identificar que o cliente quer e **qual valor**; pede ao sistema re-simular **no mesmo banco** da oferta.
- Quando o cliente escolhe, devolve a decisão para o sistema.

### 4. Dados para digitar (IA pede, sistema valida)
- Pedir só: **nome da mãe** e **chave PIX ou dados bancários**.
- **Unno CLT: PIX só do tipo CPF.** **V8: qualquer chave.**
- **CEP padrão 88049-335**; demais campos com o padrão atual da digitação.

### 5. Digitação e formalização
- Sistema digita (digitação do Motor) e pega o **link de formalização** — **obrigatório mandar ao cliente** (a IA manda e explica como assinar).
- **Termo de autorização ≠ link de formalização.** O termo da Unno já é assinado automaticamente pelo n8n (nada muda).

### 6. Acompanhamento (sistema, a cada 5 min, só propostas em aberto)
- Status por banco: formalizado / em análise / pendência / pago / cancelado.
- Mudou algo → a IA avisa o cliente. Pago → tabulação "Pago" (coleta BI que já existe).

### 7. Transferência silenciosa
- Se a IA não souber algo: **transfere sem avisar o cliente**.
- Clientes da automação/IA vão **sempre para o Gustavo** (responsável = Gustavo, atendimento humano, aparece não lido no painel).

### 8. FGTS (depois do CLT)
- Sem autorização: manda o pedido (BMP e Giro), **aguarda confirmação**; sem retorno em **30 min**, cobra de novo; confirmou → re-simula.
- Formato da proposta FGTS: a definir.

### Nome: **Ana**.

## Fases de construção (aprovar antes de cada uma)

1. **Base (banco):** máquina de estados do cliente no automático
   (`entrada → produto → simulando → proposta_enviada → negociando → coletando_dados → digitando → link_enviado → em_formalizacao → pago | pendencia | cancelado | transferido`),
   filtro "só número de atendimento", leitura de produto e CPF.
2. **Proposta CLT automática:** esperar todos os bancos (V8 + Unno), maior comissão, 36x/24x (ou 2 prazos da tabela), mensagem padrão. Tirar HUB do CLT (simulação + Motor).
3. **IA conversadora:** prompt curto + contrato de saída (texto + decisão). Re-simular parcela no mesmo banco. Transferência silenciosa para o Gustavo.
4. **Coleta de dados + digitação automática:** nome da mãe, PIX/conta (regra Unno = PIX CPF), CEP padrão; digitar; enviar link de formalização.
5. **Acompanhamento 5 min:** status V8/Unno das propostas em aberto; avisos ao cliente; pago → tabulação.
6. **Teste controlado:** um número de atendimento, poucos clientes reais, revisar conversas, depois liberar.
7. **FGTS** (fluxo próprio, com autorização e cobrança em 30 min).

## O que já existe e será reaproveitado
- Pré-atendimento/simulação automática (`credito.lp_auto*`, n8n "[LP] 🤖 Simulação automática").
- Motor (`[Motor] 🧮 Motor de Crédito`), digitação (`[Motor] ✍️ Digitação`, inclui V8 CLT/FGTS e Unno CLT).
- Envio/entrada WhatsApp (`GM Cred · WhatsApp (envio|entrada)`), tabulação automática, coleta BI de pagos.
- Backup da Ana antiga: `credito.backup_ana_agentes`, `credito.backup_ana_funcoes`, `credito.backup_ana_config`.
