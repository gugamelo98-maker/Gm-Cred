// Gera o código SDK "achatado" do Roteador (entrada única de mensagens -> setor -> agente sorteado)
const PG = { postgres: { id: 'aHfHyRjcbV1C5hHu', name: 'postgres_cloudfy' } };
const nodes = [];
const add = (v, kind, spec) => nodes.push([v, kind, spec]);
const R = "$('Receber mensagem').item.json.r";

add('webhook', 'trigger', { type: 'n8n-nodes-base.webhook', version: 2.1, config: { name: 'Chat de teste',
  parameters: { httpMethod: 'POST', path: 'gmcred/chat', responseMode: 'responseNode', options: { allowedOrigins: '*' } } } });

add('receber', 'node', { type: 'n8n-nodes-base.postgres', version: 2.5, config: { name: 'Receber mensagem', parameters: { operation: 'executeQuery',
  query: "select case when credito.validar_chave($1::text)\n  then credito.receber_mensagem($2::text, left($3::text, 2000), 'teste', null, $4::text) end as r",
  options: { queryReplacement: "={{ [ $json.body.k || '', String($json.body.telefone || ''), String($json.body.mensagem || ''), String($json.body.nome || '') ] }}" } },
  credentials: PG } });

add('autorizado', 'ifElse', { version: 2.2, config: { name: 'Autorizado?', parameters: { conditions: {
  options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
  conditions: [ { leftValue: '={{ !!$json.r }}', operator: { type: 'boolean', operation: 'true', singleValue: true } } ], combinator: 'and' } } } });

add('negado', 'node', { type: 'n8n-nodes-base.respondToWebhook', version: 1.1, config: { name: 'Responder 401', parameters: {
  respondWith: 'json', responseBody: '={{ JSON.stringify({ erro: "sessão inválida ou mensagem vazia" }) }}', options: { responseCode: 401 } } } });

add('responde', 'ifElse', { version: 2.2, config: { name: 'Agente responde?', parameters: { conditions: {
  options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
  conditions: [ { leftValue: '={{ $json.r.responder }}', operator: { type: 'boolean', operation: 'true', singleValue: true } } ], combinator: 'and' } } } });

add('humano', 'node', { type: 'n8n-nodes-base.respondToWebhook', version: 1.1, config: { name: 'Responder (com humano)', parameters: {
  respondWith: 'json', responseBody: `={{ JSON.stringify({ humano: true, lead_id: ${R}.lead.id, setor: ${R}.lead.setor, mensagens: [] }) }}`, options: {} } } });

// lugar onde cada setor vai chamar o seu agente (passo 3 em diante); por enquanto resposta provisória
add('provisorio', 'node', { type: 'n8n-nodes-base.set', version: 3.4, config: { name: 'Agente (provisório)', parameters: { mode: 'raw',
  jsonOutput: `={{ JSON.stringify({ texto: 'Oi! Aqui é ' + ${R}.agente.nome + ' 😊 (' + ${R}.lead.setor + ', versão ' + ${R}.agente.versao + '). Ainda estou em treinamento. Em breve respondo de verdade!' }) }}` } } });

add('dividir', 'node', { type: 'n8n-nodes-base.set', version: 3.4, config: { name: 'Dividir em balões', parameters: { mode: 'raw',
  jsonOutput: `={{ JSON.stringify((() => {
  const t = String($json.texto || '').replace(/\\r/g, '').replace(/\\n{3,}/g, '\\n\\n').trim();
  const frases = t.split(/\\n\\n+/).flatMap(p => p.split(/(?<=[.!?…])\\s+/)).map(s => s.trim()).filter(Boolean);
  const b = []; let cur = '';
  for (const s of frases) {
    if (cur && (cur + ' ' + s).length > 220) { b.push(cur); cur = s; } else { cur = cur ? cur + ' ' + s : s; }
  }
  if (cur) b.push(cur);
  return { baloes: b.slice(0, 3) };
})()) }}` } } });

add('registrar', 'node', { type: 'n8n-nodes-base.postgres', version: 2.5, config: { name: 'Registrar resposta', parameters: { operation: 'executeQuery',
  query: 'select credito.registrar_resposta($1::text::int, $2::text::int, $3::text::json) as r',
  options: { queryReplacement: `={{ [ String(${R}.lead.id), String(${R}.agente.id), JSON.stringify($json.baloes) ] }}` } },
  credentials: PG } });

add('ok', 'node', { type: 'n8n-nodes-base.respondToWebhook', version: 1.1, config: { name: 'Responder ao chat', parameters: {
  respondWith: 'json',
  responseBody: `={{ JSON.stringify({ lead_id: ${R}.lead.id, novo: ${R}.novo, setor: ${R}.lead.setor,
  agente: { nome: ${R}.agente.nome, versao: ${R}.agente.versao, abordagem: ${R}.agente.abordagem },
  mensagens: $('Dividir em balões').item.json.baloes }) }}`, options: {} } } });

let out = "import { workflow, node, trigger, ifElse } from '@n8n/workflow-sdk';\n\n";
for (const [v, kind, spec] of nodes) out += `const ${v} = ${kind}(${JSON.stringify(spec)});\n\n`;
out += `export default workflow('gmcred-roteador', 'GM Cred · Roteador')
  .add(webhook)
  .to(receber)
  .to(autorizado
    .onFalse(negado)
    .onTrue(responde
      .onFalse(humano)
      .onTrue(provisorio.to(dividir).to(registrar).to(ok))));\n`;
require('fs').writeFileSync(__dirname + '/roteador.js', out);
console.log(out);
