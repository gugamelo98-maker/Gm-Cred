import { workflow, node, trigger, ifElse } from '@n8n/workflow-sdk';

const webhook = trigger({"type":"n8n-nodes-base.webhook","version":2.1,"config":{"name":"Chat de teste","parameters":{"httpMethod":"POST","path":"gmcred/chat","responseMode":"responseNode","options":{"allowedOrigins":"*"}}}});

const receber = node({"type":"n8n-nodes-base.postgres","version":2.5,"config":{"name":"Receber mensagem","parameters":{"operation":"executeQuery","query":"select case when credito.validar_chave($1::text)\n  then credito.receber_mensagem($2::text, left($3::text, 2000), 'teste', null, $4::text) end as r","options":{"queryReplacement":"={{ [ $json.body.k || '', String($json.body.telefone || ''), String($json.body.mensagem || ''), String($json.body.nome || '') ] }}"}},"credentials":{"postgres":{"id":"aHfHyRjcbV1C5hHu","name":"postgres_cloudfy"}}}});

const autorizado = ifElse({"version":2.2,"config":{"name":"Autorizado?","parameters":{"conditions":{"options":{"caseSensitive":true,"leftValue":"","typeValidation":"loose"},"conditions":[{"leftValue":"={{ !!$json.r }}","operator":{"type":"boolean","operation":"true","singleValue":true}}],"combinator":"and"}}}});

const negado = node({"type":"n8n-nodes-base.respondToWebhook","version":1.1,"config":{"name":"Responder 401","parameters":{"respondWith":"json","responseBody":"={{ JSON.stringify({ erro: \"sessão inválida ou mensagem vazia\" }) }}","options":{"responseCode":401}}}});

const responde = ifElse({"version":2.2,"config":{"name":"Agente responde?","parameters":{"conditions":{"options":{"caseSensitive":true,"leftValue":"","typeValidation":"loose"},"conditions":[{"leftValue":"={{ $json.r.responder }}","operator":{"type":"boolean","operation":"true","singleValue":true}}],"combinator":"and"}}}});

const humano = node({"type":"n8n-nodes-base.respondToWebhook","version":1.1,"config":{"name":"Responder (com humano)","parameters":{"respondWith":"json","responseBody":"={{ JSON.stringify({ humano: true, lead_id: $('Receber mensagem').item.json.r.lead.id, setor: $('Receber mensagem').item.json.r.lead.setor, mensagens: [] }) }}","options":{}}}});

const provisorio = node({"type":"n8n-nodes-base.set","version":3.4,"config":{"name":"Agente (provisório)","parameters":{"mode":"raw","jsonOutput":"={{ JSON.stringify({ texto: 'Oi! Aqui é ' + $('Receber mensagem').item.json.r.agente.nome + ' 😊 (' + $('Receber mensagem').item.json.r.lead.setor + ', versão ' + $('Receber mensagem').item.json.r.agente.versao + '). Ainda estou em treinamento. Em breve respondo de verdade!' }) }}"}}});

const dividir = node({"type":"n8n-nodes-base.set","version":3.4,"config":{"name":"Dividir em balões","parameters":{"mode":"raw","jsonOutput":"={{ JSON.stringify((() => {\n  const t = String($json.texto || '').replace(/\\r/g, '').replace(/\\n{3,}/g, '\\n\\n').trim();\n  const frases = t.split(/\\n\\n+/).flatMap(p => p.split(/(?<=[.!?…])\\s+/)).map(s => s.trim()).filter(Boolean);\n  const b = []; let cur = '';\n  for (const s of frases) {\n    if (cur && (cur + ' ' + s).length > 220) { b.push(cur); cur = s; } else { cur = cur ? cur + ' ' + s : s; }\n  }\n  if (cur) b.push(cur);\n  return { baloes: b.slice(0, 3) };\n})()) }}"}}});

const registrar = node({"type":"n8n-nodes-base.postgres","version":2.5,"config":{"name":"Registrar resposta","parameters":{"operation":"executeQuery","query":"select credito.registrar_resposta($1::text::int, $2::text::int, $3::text::json) as r","options":{"queryReplacement":"={{ [ String($('Receber mensagem').item.json.r.lead.id), String($('Receber mensagem').item.json.r.agente.id), JSON.stringify($json.baloes) ] }}"}},"credentials":{"postgres":{"id":"aHfHyRjcbV1C5hHu","name":"postgres_cloudfy"}}}});

const ok = node({"type":"n8n-nodes-base.respondToWebhook","version":1.1,"config":{"name":"Responder ao chat","parameters":{"respondWith":"json","responseBody":"={{ JSON.stringify({ lead_id: $('Receber mensagem').item.json.r.lead.id, novo: $('Receber mensagem').item.json.r.novo, setor: $('Receber mensagem').item.json.r.lead.setor,\n  agente: { nome: $('Receber mensagem').item.json.r.agente.nome, versao: $('Receber mensagem').item.json.r.agente.versao, abordagem: $('Receber mensagem').item.json.r.agente.abordagem },\n  mensagens: $('Dividir em balões').item.json.baloes }) }}","options":{}}}});

export default workflow('gmcred-roteador', 'GM Cred · Roteador')
  .add(webhook)
  .to(receber)
  .to(autorizado
    .onFalse(negado)
    .onTrue(responde
      .onFalse(humano)
      .onTrue(provisorio.to(dividir).to(registrar).to(ok))));
