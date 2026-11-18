# Contrato do servidor de WhatsApp (GM Cred)

O sistema da GM Cred (n8n da Cloudfy + Postgres) hoje fala com o **WAHA**. Um servidor novo pode substituir o WAHA **sem mudar nada no sistema**, desde que implemente exatamente os endpoints e os eventos abaixo (subconjunto da API do WAHA), mais o endpoint de botões.

- Endereço público: o mesmo túnel ngrok (`https://<dominio>.ngrok-free.dev`). O sistema guarda a URL e a chave em `credito.configuracoes` (chave `waha`) e em `credito.wpp_motor` (por número) — basta atualizar lá se mudar.
- Autenticação: header `X-Api-Key: <chave>` em todas as chamadas. Responder **401** se faltar ou estiver errado.
- Cada número de WhatsApp é uma **sessão** com nome fixo: `gmcred-campanha`, `gmcred-2` … `gmcred-6` (novos: `gmcred-N`). O nome da sessão é a identidade do número no sistema — não mudar.
- IDs de conversa: `<numero>@c.us` (telefone), `<id>@lid` (LID) ou `<id>@g.us` (grupo). O sistema aceita os três; para cliente, ele normalmente usa o `chatId` devolvido pelo `check-exists`.
- IDs de mensagem: formato serializado `true_<chatId>_<id>` (enviada por nós) / `false_<chatId>_<id>` (recebida). O sistema guarda esse ID ao enviar e casa com os eventos de entrega. **O ID devolvido no envio tem que ser igual ao dos eventos `message.ack`.**

---

## 1. Endpoints que o sistema chama

### 1.1 Enviar texto
`POST /api/sendText`
```json
{ "session": "gmcred-4", "chatId": "170536088928339@lid", "text": "Oi Maria, tudo bem?\n\nSegunda linha" }
```
Resposta **201** com o ID da mensagem em um destes campos (o sistema tenta nesta ordem): `key.id`, `id` (string), `id._serialized`, `_data.id._serialized`.
```json
{ "id": { "_serialized": "true_170536088928339@lid_3EB09911023920F413DD77" }, "ack": 0 }
```
- Respeitar quebras de linha e `*negrito*`.
- Grupo: `chatId` = `120363412985164405@g.us`.
- Erro de conexão/servidor fora → o sistema tenta de novo depois (não marca o cliente como sem WhatsApp).

### 1.2 Conferir se o número tem WhatsApp (chamado antes de todo envio a cliente)
`GET /api/contacts/check-exists?session=gmcred-4&phone=5511991587044`
```json
{ "numberExists": true, "chatId": "170536088928339@lid" }
```
ou `{ "numberExists": false }`. **Só devolver `false` quando o WhatsApp confirmar que não existe** — se não souber (erro, timeout), devolver erro HTTP (5xx). `false` bloqueia o número para sempre.

### 1.3 Sessões (números)
- `GET /api/sessions` → lista (o sistema consulta **a cada minuto**):
```json
[{ "name": "gmcred-3", "status": "WORKING",
   "me": { "id": "554891938293@c.us", "pushName": "Ana Gm Cred",
           "reachoutTimelock": { "isActive": true, "timeEnforcementEnds": 1794428946 } } }]
```
  - `status`: `STARTING` | `SCAN_QR_CODE` | `WORKING` | `FAILED` | `STOPPED`.
  - `me.reachoutTimelock` (trava do WhatsApp para iniciar conversa): `isActive` + fim em segundos Unix. Se não houver, `null`. O sistema tira o número da campanha enquanto `isActive` for true.
- `GET /api/sessions?all=true` → igual, incluindo paradas.
- `GET /api/sessions/{nome}` → um objeto como acima.
- `POST /api/sessions` com `{ "name": "gmcred-8", "start": true }` → cria e liga (botão "+ Novo número" do painel).
- `POST /api/sessions/{nome}/start` · `/restart` · `/stop` → liga, reinicia, para.
- `DELETE /api/sessions/{nome}` → apaga (sessão e arquivos).

### 1.4 QR code (painel → Números → Conectar)
`GET /api/{nome}/auth/qr?format=image` com header `Accept: application/json`
```json
{ "mimetype": "image/png", "data": "<base64 da imagem>" }
```
Se a sessão já estiver `WORKING`, pode devolver erro — o painel trata como "já conectado". O painel pede um QR novo a cada ~15 s enquanto a janela estiver aberta.

### 1.5 Descobrir o telefone de um LID (toda mensagem recebida passa por aqui)
- `GET /api/{nome}/lids/{lid}` (ex.: `105540264935505@lid`) → `{ "lid": "105540264935505@lid", "pn": "554896077545@c.us" }`
- `GET /api/{nome}/lids/pn/{numero}@c.us` → mesmo formato.

### 1.6 Conferir entrega de uma mensagem (o aviso de entrega às vezes não chega)
`GET /api/{nome}/chats/{chatId}/messages/{messageId}?downloadMedia=false`
```json
{ "id": "true_170536088928339@lid_3EB0...", "ack": 2, "ackName": "DEVICE" }
```
`ack`: `-1` erro · `0` pendente · `1` saiu do servidor · `2` entregue · `3` lida · `4` ouvida.

### 1.7 Enquete (opcional, já testado)
`POST /api/sendPoll` `{ "session", "chatId", "poll": { "name": "...", "options": ["Sim", "Não"], "multipleAnswers": false } }`

### 1.8 NOVO — Botões (o WAHA não tem; o servidor novo deve ter)
Proposta de formato (o sistema vai chamar assim):
`POST /api/sendButtons`
```json
{ "session": "gmcred-6", "chatId": "105540264935505@lid",
  "body": "Seu CPF começa com 838 e termina com 134?",
  "footer": "GM Cred",
  "image": { "url": "https://..." },
  "buttons": [
    { "type": "reply", "id": "cpf_sim", "text": "Sim, é meu" },
    { "type": "reply", "id": "cpf_nao", "text": "Não é meu" },
    { "type": "url", "text": "Abrir site", "url": "https://..." }
  ] }
```
Resposta igual ao `sendText` (com o ID serializado). Pelo teste: mandar a mensagem interativa **direto, sem viewOnce**, com o bloco `biz → interactive → native_flow`. Botão de copiar e `buttonsMessage` antigo não funcionam — não usar.


### 1.9 NOVO — Foto e nome do perfil (para todo número novo já sair com a logo)
Mesmo formato do WAHA:
- `PUT /api/{nome}/profile/picture` com `{ "file": { "url": "https://escritorio-gm-cred.vercel.app/img/perfil-whatsapp.jpg" } }`
  (aceitar também `{ "file": { "mimetype": "image/jpeg", "data": "<base64>" } }`). No Baileys: `sock.updateProfilePicture(sock.user.id, buffer)`.
- `PUT /api/{nome}/profile/name` com `{ "name": "Ana Gm Cred" }`. No Baileys: `sock.updateProfileName(nome)`.
- Resposta `200 {"success": true}`; sessão que não está `WORKING` → `409`.
O sistema chama os dois uma vez, logo depois que um número novo conecta pelo QR.

---

## 2. Eventos que o servidor manda para o n8n

`POST https://rarelookingorca-n8n.cloudfy.live/webhook/gmcred/waha` (JSON). Formato do WAHA:
```json
{ "event": "message.any", "session": "gmcred-4",
  "me": { "id": "554892092780@c.us", "pushName": "Ana Gm Cred", "reachoutTimelock": null },
  "payload": { ... } }
```
O campo `me` vai em **todo** evento (o sistema usa para guardar o número, o nome e a trava).

### 2.1 `message.any` — toda mensagem (recebida E enviada)
```json
{ "id": "false_105540264935505@lid_3A4874DB4649201D60B1",
  "from": "105540264935505@lid", "to": "554899996775@c.us",
  "fromMe": false, "source": "app", "participant": null,
  "body": "Ok", "hasMedia": false,
  "_data": { "type": "chat", "notifyName": "Gustavo Luiz" } }
```
- `fromMe: true` + `source: "api"` → mensagem que o próprio sistema mandou (é ignorada).
- `fromMe: true` + `source: "app"` → **o atendente mandou pelo celular** (o sistema pausa a IA por 2 h). Precisa vir!
- Grupo: `from` = `...@g.us` e `participant` = quem escreveu (LID ou telefone).
- `_data.type`: `chat` (texto em `body`), `image` (legenda em `body`), `ptt`/`audio` (áudio), outros.
- **Toque em botão:** mandar como `message.any` comum com `_data.type: "chat"` e `body` = **texto do botão** (ex.: "Sim, é meu"); se possível, incluir também `_data.buttonId: "cpf_sim"`. Assim a Ana já entende sem mudar nada.
- **Voto em enquete:** idem, `body` = texto da opção escolhida.

### 2.2 `message.ack` — entrega/leitura
```json
{ "id": "true_170536088928339@lid_3EB09911023920F413DD77", "fromMe": true, "ack": 2, "ackName": "DEVICE" }
```

### 2.3 `session.status` — número caiu/voltou
```json
{ "status": "WORKING" }
```
`WORKING` = conectado; `SCAN_QR_CODE` = desconectado (precisa de QR); `FAILED`/`STOPPED` = caiu. `STARTING` é ignorado. Queda só vira aviso no grupo se durar mais de 3 min.

---

## 3. Recomendações
- Usar a sessão salva em disco (não pedir QR a cada reinício) e reiniciar sozinho.
- Ligar as sessões uma de cada vez (o WAHA travou em STARTING quando ligou várias juntas).
- Não responder nada sozinho: quem decide o que responder é o n8n.
- Rodar alguns dias **junto** com o WAHA (em um número de teste) antes de trocar os números da campanha. O defeito de 11/11 (mensagens voltando `ERROR` sem chegar) era do Baileys usado pela Evolution.
- Chave forte no `X-Api-Key` (o servidor fica exposto na internet pelo ngrok).
