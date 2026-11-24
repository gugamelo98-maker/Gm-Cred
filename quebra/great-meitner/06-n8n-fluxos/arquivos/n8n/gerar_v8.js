// Gera o código SDK "achatado" da ferramenta V8 (o SDK do n8n não aceita funções auxiliares)
const PG = { postgres: { id: 'aHfHyRjcbV1C5hHu', name: 'postgres_cloudfy' } };
const BASE = 'https://v2-bff-prod-front.yellowisland-b252a8a0.eastus.azurecontainerapps.io/private-consignment';
const HEADERS = { parameters: [
  { name: 'Authorization', value: "={{ 'Bearer ' + $('Preparar').item.json.token }}" },
  { name: 'Origin', value: 'https://app.v8sistema.com' },
  { name: 'Content-Type', value: 'application/json' } ] };
const SEM_ERRO = { response: { response: { fullResponse: true, neverError: true, responseFormat: 'json' } }, timeout: 30000 };
const DISPOSITIVO = '{"operationalSystem":"Windows","deviceType":"desktop","deviceModel":"Windows","deviceName":"Chrome 156.0.0.0","deviceApp":"unknown"}';
const nodes = []; // [varName, kind, spec]
const J = (o) => JSON.stringify(o);
function add(v, kind, spec) { nodes.push([v, kind, spec]); }
function http(v, name, method, url, body) {
  const parameters = { method, url, sendHeaders: true, headerParameters: HEADERS, options: SEM_ERRO };
  if (body) Object.assign(parameters, { sendBody: true, specifyBody: 'json', jsonBody: body });
  add(v, 'node', { type: 'n8n-nodes-base.httpRequest', version: 4.3, config: { name, parameters, retryOnFail: true, maxTries: 2, waitBetweenTries: 2000 } });
}
function saida(v, name, json) { add(v, 'node', { type: 'n8n-nodes-base.set', version: 3.4, config: { name, parameters: { mode: 'raw', jsonOutput: json } } }); }
function cond(v, name, left, op) {
  add(v, 'ifElse', { version: 2.2, config: { name, parameters: { conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
    conditions: [ Object.assign({ leftValue: left }, op) ], combinator: 'and' } } } });
}

add('entrada', 'trigger', { type: 'n8n-nodes-base.executeWorkflowTrigger', version: 1.2, config: { name: 'Entrada', parameters: { inputSource: 'workflowInputs',
  workflowInputs: { values: [ { name: 'acao', type: 'string' }, { name: 'cpf', type: 'string' } ] } } } });
add('tokenCache', 'node', { type: 'n8n-nodes-base.postgres', version: 2.5, config: { name: 'Token em cache', parameters: { operation: 'executeQuery',
  query: "select coalesce((select token from credito.v8_token where id = 1 and expira_em > now() + interval '15 minutes'), '') as token", options: {} }, credentials: PG } });
cond('temToken', 'Tem token válido?', '={{ $json.token }}', { operator: { type: 'string', operation: 'notEmpty', singleValue: true } });
add('loginV8', 'node', { type: 'n8n-nodes-base.httpRequest', version: 4.3, config: { name: 'Login V8', parameters: {
  method: 'POST', url: 'https://auth.v8sistema.com/oauth/token', authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth',
  sendHeaders: true, headerParameters: { parameters: [ { name: 'Content-Type', value: 'application/json' } ] },
  sendBody: true, specifyBody: 'json', jsonBody: '{}', options: {} },
  credentials: { httpCustomAuth: { id: 'GlsKoeSEv3OjEvAj', name: 'V8 Login (GM Cred agentes)' } }, retryOnFail: true, maxTries: 3, waitBetweenTries: 2000 } });
add('salvarToken', 'node', { type: 'n8n-nodes-base.postgres', version: 2.5, config: { name: 'Salvar token', parameters: { operation: 'executeQuery',
  query: "insert into credito.v8_token (id, token, expira_em, atualizado_em)\nvalues (1, $1::text, now() + make_interval(secs => ($2::text)::int), now())\non conflict (id) do update set token = excluded.token, expira_em = excluded.expira_em, atualizado_em = now()\nreturning token",
  options: { queryReplacement: "={{ [ $json.access_token, String($json.expires_in || 3600) ] }}" } }, credentials: PG } });

saida('preparar', 'Preparar', `={{ JSON.stringify((() => {
  const c = String($('Entrada').first().json.cpf || '').replace(/\\D/g, '');
  let ok = /^\\d{11}$/.test(c) && !/^(\\d)\\1{10}$/.test(c);
  for (const t of [9, 10]) {
    if (!ok) break;
    let s = 0;
    for (let i = 0; i < t; i++) s += Number(c[i]) * (t + 1 - i);
    if ((s * 10) % 11 % 10 !== Number(c[t])) ok = false;
  }
  return { token: $json.token, cpf: c, cpf_valido: ok, acao: String($('Entrada').first().json.acao || 'consultar_cpf') };
})()) }}`);
cond('cpfOk', 'CPF válido?', '={{ $json.cpf_valido }}', { operator: { type: 'boolean', operation: 'true', singleValue: true } });
saida('cpfInvalido', 'CPF inválido', "={{ JSON.stringify({ ok: true, situacao: 'cpf_invalido', cpf: $json.cpf }) }}");
http('buscar', 'Buscar consultas', 'GET', `={{ '${BASE}/consult?search=' + $('Preparar').item.json.cpf + '&page=1&limit=20' }}`);
saida('analisar', 'Analisar busca', `={{ JSON.stringify((() => {
  const st = $json.statusCode, body = $json.body || {};
  const cpf = $('Preparar').item.json.cpf, acao = $('Preparar').item.json.acao;
  if (st === 401) return { proximo: 'responder', ok: false, situacao: 'erro', erro: 'token V8 recusado', cpf };
  if (st >= 400) return { proximo: 'responder', ok: false, situacao: 'erro', erro: 'V8 busca ' + st, cpf };
  const recs = body.data || [];
  const out = (r, sit) => ({ proximo: 'responder', ok: true, situacao: sit, cpf, consult_id: r.id || null, status_v8: r.status || null,
    margem: (r.availableMarginValue === undefined ? null : r.availableMarginValue), nome: r.name || null, descricao: r.description || null });
  const suc = recs.find(r => r.status === 'SUCCESS' && r.availableMarginValue !== null && r.availableMarginValue !== undefined);
  if (suc) return out(suc, 'com_margem');
  const u = recs[0];
  if (u) {
    if (u.status === 'WAITING_CONSENT' && acao === 'consultar_cpf') return Object.assign(out(u, 'processando'), { proximo: 'autorizar' });
    if (u.status === 'REJECTED') return out(u, 'sem_margem');
    return out(u, 'processando');
  }
  if (acao !== 'consultar_cpf') return { proximo: 'responder', ok: true, situacao: 'sem_consulta', cpf };
  return { proximo: 'criar', ok: true, situacao: 'criando', cpf };
})()) }}`);
const rota = (key) => ({ outputKey: key, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
  conditions: [ { leftValue: '={{ $json.proximo }}', operator: { type: 'string', operation: 'equals' }, rightValue: key } ], combinator: 'and' } });
add('proximo', 'switchCase', { version: 3.2, config: { name: 'Próximo passo', parameters: { rules: { values: [ rota('responder'), rota('autorizar'), rota('criar') ] }, options: {} } } });
add('responder', 'node', { type: 'n8n-nodes-base.noOp', version: 1, config: { name: 'Responder' } });
http('autorizarExistente', 'Autorizar consulta existente', 'POST', `={{ '${BASE}/consult/' + $('Analisar busca').item.json.consult_id + '/authorize' }}`, DISPOSITIVO);
saida('autorizada', 'Autorizada', `={{ JSON.stringify(Object.assign({}, $('Analisar busca').item.json, $json.statusCode < 400 ? { situacao: 'processando' } : { ok: false, situacao: 'erro', erro: 'V8 autorizar ' + $json.statusCode })) }}`);
http('dadosBasicos', 'Dados básicos', 'GET', `={{ '${BASE}/consult/client-data/basic/' + $('Preparar').item.json.cpf }}`);
cond('achou', 'Achou na V8?', '={{ $json.statusCode }}', { operator: { type: 'number', operation: 'lt' }, rightValue: 400 });
saida('naoAchou', 'Não encontrado', `={{ JSON.stringify({ ok: $json.statusCode === 404, situacao: $json.statusCode === 404 ? 'nao_encontrado_v8' : 'erro', erro: $json.statusCode === 404 ? undefined : 'V8 dados ' + $json.statusCode, cpf: $('Preparar').item.json.cpf }) }}`);
http('criar', 'Criar consulta', 'POST', `${BASE}/consult`, `={{ JSON.stringify({
  borrowerDocumentNumber: $('Preparar').item.json.cpf,
  signerName: $json.body.name, birthDate: $json.body.birthDate, gender: $json.body.gender || 'male',
  signerEmail: $json.body.email || 'sem@email.com',
  signerPhone: { countryCode: '55', areaCode: $json.body.phoneRegionCode || '11', phoneNumber: $json.body.phoneNumber || '999999999' } }) }}`);
cond('criou', 'Criou?', "={{ ($json.body && $json.body.id) || '' }}", { operator: { type: 'string', operation: 'notEmpty', singleValue: true } });
saida('naoCriou', 'Não criou', `={{ JSON.stringify({ ok: true, situacao: 'sem_margem', cpf: $('Preparar').item.json.cpf, nome: $('Dados básicos').item.json.body.name || null, descricao: ($json.body && ($json.body.message || $json.body.description)) || ('V8 criar ' + $json.statusCode) }) }}`);
add('espera', 'node', { type: 'n8n-nodes-base.wait', version: 1.1, config: { name: 'Esperar 3s', parameters: { resume: 'timeInterval', amount: 3, unit: 'seconds' } } });
http('abrirTermo', 'Abrir termo', 'GET', `={{ '${BASE}/consult/' + $('Criar consulta').item.json.body.id + '/unprotected/' + $('Preparar').item.json.cpf }}`);
http('autorizarNova', 'Autorizar consulta nova', 'POST', `={{ '${BASE}/consult/' + $('Criar consulta').item.json.body.id + '/authorize' }}`, DISPOSITIVO);
saida('criada', 'Consulta criada', `={{ JSON.stringify({
  ok: $json.statusCode < 400, situacao: $json.statusCode < 400 ? 'processando' : 'erro',
  erro: $json.statusCode < 400 ? undefined : 'V8 autorizar ' + $json.statusCode,
  cpf: $('Preparar').item.json.cpf, consult_id: $('Criar consulta').item.json.body.id,
  nome: $('Dados básicos').item.json.body.name || null, nascimento: $('Dados básicos').item.json.body.birthDate || null,
  telefone: (($('Dados básicos').item.json.body.phoneRegionCode || '') + ($('Dados básicos').item.json.body.phoneNumber || '')) || null }) }}`);

let out = "import { workflow, node, trigger, ifElse, switchCase } from '@n8n/workflow-sdk';\n\n";
for (const [v, kind, spec] of nodes) out += `const ${v} = ${kind}(${J(spec)});\n\n`;
out += `export default workflow('gmcred-v8-ferramentas', 'GM Cred · V8 Ferramentas')
  .add(entrada)
  .to(tokenCache)
  .to(temToken.onTrue(preparar).onFalse(loginV8.to(salvarToken).to(preparar)))
  .add(preparar)
  .to(cpfOk
    .onFalse(cpfInvalido)
    .onTrue(buscar.to(analisar).to(proximo
      .onCase(0, responder)
      .onCase(1, autorizarExistente.to(autorizada))
      .onCase(2, dadosBasicos.to(achou
        .onFalse(naoAchou)
        .onTrue(criar.to(criou
          .onFalse(naoCriou)
          .onTrue(espera.to(abrirTermo).to(autorizarNova).to(criada)))))))));\n`;
require('fs').writeFileSync(__dirname + '/v8_ferramentas.js', out);
console.log(out.length);
