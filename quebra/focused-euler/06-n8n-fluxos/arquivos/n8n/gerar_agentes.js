// Gera o código SDK "achatado" dos fluxos dos agentes (o SDK do n8n não aceita funções auxiliares).
// Uso: node gerar_agentes.js <qual> [ids...]
//   v8            -> GM Cred · V8 Ferramentas
//   acoes <v8id>  -> GM Cred · Ações
//   agente <acoesId>             -> GM Cred · Agente
//   acompanhamento <acoesId> <agenteId> -> GM Cred · Acompanhamento
const fs = require('fs');
const PG = { postgres: { id: 'aHfHyRjcbV1C5hHu', name: 'postgres_cloudfy' } };
const OR = { openRouterApi: { id: 'gZterKSOOMwJS7Sd', name: 'openrouter_cloudfy' } };
const BASE = 'https://v2-bff-prod-front.yellowisland-b252a8a0.eastus.azurecontainerapps.io/private-consignment';
let nodes = [];
const add = (v, kind, spec) => { nodes.push([v, kind, spec]); return v; };
const pg = (v, name, query, repl, extra) => add(v, 'node', { type: 'n8n-nodes-base.postgres', version: 2.5, config: Object.assign({ name,
  parameters: { operation: 'executeQuery', query, options: repl ? { queryReplacement: repl } : {} }, credentials: PG }, extra || {}) });
const setRaw = (v, name, json) => add(v, 'node', { type: 'n8n-nodes-base.set', version: 3.4, config: { name, parameters: { mode: 'raw', jsonOutput: json } } });
const cond = (v, name, left, op) => add(v, 'ifElse', { version: 2.2, config: { name, parameters: { conditions: {
  options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [ Object.assign({ leftValue: left }, op) ], combinator: 'and' } } } });
const isTrue = { operator: { type: 'boolean', operation: 'true', singleValue: true } };
const sw = (v, name, expr, keys) => add(v, 'switchCase', { version: 3.2, config: { name, parameters: { rules: { values: keys.map(k => ({ outputKey: k, conditions: {
  options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
  conditions: [ { leftValue: expr, operator: { type: 'string', operation: 'equals' }, rightValue: k } ], combinator: 'and' } })) },
  options: { fallbackOutput: 'extra', renameFallbackOutput: 'outros' } } } });
const http = (v, name, method, url, body) => {
  const parameters = { method, url, sendHeaders: true, headerParameters: { parameters: [
    { name: 'Authorization', value: "={{ 'Bearer ' + $('Preparar').item.json.token }}" },
    { name: 'Origin', value: 'https://app.v8sistema.com' }, { name: 'Content-Type', value: 'application/json' } ] },
    options: { response: { response: { fullResponse: true, neverError: true, responseFormat: 'json' } }, timeout: 30000 } };
  if (body) Object.assign(parameters, { sendBody: true, specifyBody: 'json', jsonBody: body });
  return add(v, 'node', { type: 'n8n-nodes-base.httpRequest', version: 4.3, config: { name, parameters, retryOnFail: true, maxTries: 2, waitBetweenTries: 2000 } });
};
const schemaOf = (keys) => keys.map(k => ({ id: k, displayName: k, required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }));
const execWf = (v, name, wfId, values) => add(v, 'node', { type: 'n8n-nodes-base.executeWorkflow', version: 1.3, config: { name, parameters: {
  mode: 'each', source: 'database', workflowId: { __rl: true, mode: 'id', value: wfId },
  workflowInputs: { mappingMode: 'defineBelow', value: values, matchingColumns: [], schema: schemaOf(Object.keys(values)), attemptToConvertTypes: false, convertFieldsToString: true },
  options: {} } } });
const trig = (v, name, inputs) => add(v, 'trigger', { type: 'n8n-nodes-base.executeWorkflowTrigger', version: 1.2, config: { name, parameters: {
  inputSource: 'workflowInputs', workflowInputs: { values: inputs.map(n => ({ name: n, type: 'string' })) } } } });
const emit = (imports, flow, file, extra) => {
  let out = `import { ${imports} } from '@n8n/workflow-sdk';\n\n`;
  for (const [v, kind, spec] of nodes) out += `const ${v} = ${kind}(${JSON.stringify(spec)});\n\n`;
  out += (extra || '') + flow + '\n';
  fs.writeFileSync(__dirname + '/' + file, out); console.log(file, out.length);
};
const qual = process.argv[2];

// ───────────────────────────── V8 FERRAMENTAS ─────────────────────────────
if (qual === 'v8') {
  trig('entrada', 'Entrada', ['acao', 'cpf', 'dados']);
  pg('tokenCache', 'Token em cache', "select coalesce((select token from credito.v8_token where id = 1 and expira_em > now() + interval '15 minutes'), '') as token");
  cond('temToken', 'Tem token válido?', '={{ $json.token }}', { operator: { type: 'string', operation: 'notEmpty', singleValue: true } });
  add('loginV8', 'node', { type: 'n8n-nodes-base.httpRequest', version: 4.3, config: { name: 'Login V8', parameters: {
    method: 'POST', url: 'https://auth.v8sistema.com/oauth/token', authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth',
    sendHeaders: true, headerParameters: { parameters: [ { name: 'Content-Type', value: 'application/json' } ] }, sendBody: true, specifyBody: 'json', jsonBody: '{}', options: {} },
    credentials: { httpCustomAuth: { id: 'GlsKoeSEv3OjEvAj', name: 'V8 Login (GM Cred agentes)' } }, retryOnFail: true, maxTries: 3, waitBetweenTries: 2000 } });
  pg('salvarToken', 'Salvar token', "insert into credito.v8_token (id, token, expira_em, atualizado_em)\nvalues (1, $1::text, now() + make_interval(secs => ($2::text)::int), now())\non conflict (id) do update set token = excluded.token, expira_em = excluded.expira_em, atualizado_em = now()\nreturning token",
     "={{ [ $json.access_token, String($json.expires_in || 3600) ] }}");
  setRaw('preparar', 'Preparar', `={{ JSON.stringify((() => {
  const e = $('Entrada').first().json;
  const c = String(e.cpf || '').replace(/\\D/g, '');
  let ok = /^\\d{11}$/.test(c) && !/^(\\d)\\1{10}$/.test(c);
  for (const t of [9, 10]) {
    if (!ok) break;
    let s = 0;
    for (let i = 0; i < t; i++) s += Number(c[i]) * (t + 1 - i);
    if ((s * 10) % 11 % 10 !== Number(c[t])) ok = false;
  }
  let dados = {};
  try { dados = JSON.parse(e.dados || '{}') || {}; } catch (err) { dados = {}; }
  return { token: $json.token, cpf: c, cpf_valido: ok, acao: String(e.acao || 'consultar_cpf'), dados };
})()) }}`);
  sw('acaoV8', 'Ação V8', '={{ ["consultar_cpf","status"].includes($json.acao) ? "consulta" : $json.acao }}', ['consulta', 'simular', 'criar_operacao', 'status_operacao']);
  // consulta
  cond('cpfOk', 'CPF válido?', '={{ $json.cpf_valido }}', isTrue);
  setRaw('cpfInvalido', 'CPF inválido', "={{ JSON.stringify({ ok: true, situacao: 'cpf_invalido', cpf: $json.cpf }) }}");
  http('buscar', 'Buscar consultas', 'GET', `={{ '${BASE}/consult?search=' + $('Preparar').item.json.cpf + '&page=1&limit=20' }}`);
  setRaw('analisar', 'Analisar busca', `={{ JSON.stringify((() => {
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
  sw('proximo', 'Próximo passo', '={{ $json.proximo }}', ['responder', 'autorizar', 'criar']);
  add('responder', 'node', { type: 'n8n-nodes-base.noOp', version: 1, config: { name: 'Responder' } });
  const DISP = '{"operationalSystem":"Windows","deviceType":"desktop","deviceModel":"Windows","deviceName":"Chrome 156.0.0.0","deviceApp":"unknown"}';
  http('autorizarExistente', 'Autorizar consulta existente', 'POST', `={{ '${BASE}/consult/' + $('Analisar busca').item.json.consult_id + '/authorize' }}`, DISP);
  setRaw('autorizada', 'Autorizada', "={{ JSON.stringify(Object.assign({}, $('Analisar busca').item.json, $json.statusCode < 400 ? { situacao: 'processando' } : { ok: false, situacao: 'erro', erro: 'V8 autorizar ' + $json.statusCode })) }}");
  http('dadosBasicos', 'Dados básicos', 'GET', `={{ '${BASE}/consult/client-data/basic/' + $('Preparar').item.json.cpf }}`);
  cond('achou', 'Achou na V8?', '={{ $json.statusCode }}', { operator: { type: 'number', operation: 'lt' }, rightValue: 400 });
  setRaw('naoAchou', 'Não encontrado', "={{ JSON.stringify({ ok: $json.statusCode === 404, situacao: $json.statusCode === 404 ? 'nao_encontrado_v8' : 'erro', erro: $json.statusCode === 404 ? undefined : 'V8 dados ' + $json.statusCode, cpf: $('Preparar').item.json.cpf }) }}");
  http('criar', 'Criar consulta', 'POST', `${BASE}/consult`, `={{ JSON.stringify({
  borrowerDocumentNumber: $('Preparar').item.json.cpf,
  signerName: $json.body.name, birthDate: $json.body.birthDate, gender: $json.body.gender || 'male',
  signerEmail: $json.body.email || 'sem@email.com',
  signerPhone: { countryCode: '55', areaCode: $json.body.phoneRegionCode || '11', phoneNumber: $json.body.phoneNumber || '999999999' } }) }}`);
  cond('criou', 'Criou?', "={{ ($json.body && $json.body.id) || '' }}", { operator: { type: 'string', operation: 'notEmpty', singleValue: true } });
  setRaw('naoCriou', 'Não criou', "={{ JSON.stringify({ ok: true, situacao: 'sem_margem', cpf: $('Preparar').item.json.cpf, nome: $('Dados básicos').item.json.body.name || null, descricao: ($json.body && ($json.body.message || $json.body.description)) || ('V8 criar ' + $json.statusCode) }) }}");
  add('espera', 'node', { type: 'n8n-nodes-base.wait', version: 1.1, config: { name: 'Esperar 3s', parameters: { resume: 'timeInterval', amount: 3, unit: 'seconds' } } });
  http('abrirTermo', 'Abrir termo', 'GET', `={{ '${BASE}/consult/' + $('Criar consulta').item.json.body.id + '/unprotected/' + $('Preparar').item.json.cpf }}`);
  http('autorizarNova', 'Autorizar consulta nova', 'POST', `={{ '${BASE}/consult/' + $('Criar consulta').item.json.body.id + '/authorize' }}`, DISP);
  setRaw('criada', 'Consulta criada', `={{ JSON.stringify({
  ok: $json.statusCode < 400, situacao: $json.statusCode < 400 ? 'processando' : 'erro',
  erro: $json.statusCode < 400 ? undefined : 'V8 autorizar ' + $json.statusCode,
  cpf: $('Preparar').item.json.cpf, consult_id: $('Criar consulta').item.json.body.id,
  nome: $('Dados básicos').item.json.body.name || null, nascimento: $('Dados básicos').item.json.body.birthDate || null,
  email: $('Dados básicos').item.json.body.email || null,
  telefone: (($('Dados básicos').item.json.body.phoneRegionCode || '') + ($('Dados básicos').item.json.body.phoneNumber || '')) || null }) }}`);
  // simular
  http('configs', 'Tabelas (configs)', 'GET', `${BASE}/simulation/configs`);
  setRaw('montar', 'Montar simulações', `={{ JSON.stringify((() => {
  const d = $('Preparar').item.json.dados || {};
  const cfgs = ($json.body && $json.body.configs) || [];
  const sem = cfgs.find(c => !c.is_insured), com = cfgs.find(c => c.is_insured);
  const parcela = Math.floor(Number(d.parcela || d.margem || 0) * 100) / 100;
  const prazos = c => (c ? (c.number_of_installments || []).map(Number) : []);
  const perto = (c, p) => prazos(c).reduce((a, b) => Math.abs(b - p) < Math.abs(a - p) ? b : a, prazos(c)[0]);
  let reqs = [];
  if (d.prazo) {
    [sem, com].forEach(c => { if (c && prazos(c).length) reqs.push({ config_id: c.id, seguro: !!c.is_insured, prazo: perto(c, Number(d.prazo)) }); });
  } else {
    if (sem) [46, 36, 24].forEach(p => { if (prazos(sem).includes(p)) reqs.push({ config_id: sem.id, seguro: false, prazo: p }); });
    if (com && prazos(com).length) reqs.push({ config_id: com.id, seguro: true, prazo: Math.max(...prazos(com)) });
  }
  if (!parcela) reqs = [];
  return { reqs: reqs.map((r, i) => Object.assign(r, { n: i + 1, parcela, consult_id: d.consult_id })) };
})()) }}`);
  add('dividir', 'node', { type: 'n8n-nodes-base.splitOut', version: 1, config: { name: 'Separar simulações', parameters: { fieldToSplitOut: 'reqs', options: {} } } });
  http('simular', 'Simular', 'POST', `${BASE}/simulation`, "={{ JSON.stringify({ consult_id: $json.consult_id, config_id: $json.config_id, installment_face_value: $json.parcela, number_of_installments: $json.prazo, provider: 'QI' }) }}");
  setRaw('oferta', 'Oferta', `={{ JSON.stringify((() => {
  const b = $json.body || {}, r = $('Separar simulações').item.json, op = b.disbursement_option || {};
  const ok = $json.statusCode < 400 && !!b.id_simulation;
  return { n: r.n, seguro: r.seguro, prazo: Number(b.number_of_installments || r.prazo), parcela: Number(b.installment_value || r.parcela),
    valor: Number(op.final_disbursement_amount || b.disbursed_issue_amount || b.disbursement_amount || 0), sim_id: b.id_simulation || null,
    config_id: r.config_id, ok, erro: ok ? null : (b.detail || b.title || b.message || ('HTTP ' + $json.statusCode)) };
})()) }}`);
  add('juntar', 'node', { type: 'n8n-nodes-base.aggregate', version: 1, config: { name: 'Juntar ofertas', parameters: { aggregate: 'aggregateAllItemData', destinationFieldName: 'itens', options: {} } } });
  setRaw('resultadoSim', 'Resultado simulação', "={{ JSON.stringify((() => { const it = $json.itens || []; const ok = it.filter(o => o.ok && o.valor > 0); return { ok: ok.length > 0, ofertas: ok.map((o, i) => Object.assign({}, o, { n: i + 1 })), erros: it.filter(o => !o.ok).map(o => o.erro) }; })()) }}");
  // operação
  http('criarOp', 'Criar operação', 'POST', `${BASE}/operation`, "={{ JSON.stringify($('Preparar').item.json.dados) }}");
  setRaw('opCriada', 'Resultado operação', "={{ JSON.stringify({ ok: $json.statusCode < 400 && !!($json.body && $json.body.id), id: $json.body && $json.body.id, url: $json.body && $json.body.formalization_url, erro: $json.statusCode < 400 ? null : (($json.body && ($json.body.detail || $json.body.title || $json.body.message)) || ('HTTP ' + $json.statusCode)) }) }}");
  http('statusOp', 'Status operação', 'GET', `={{ '${BASE}/operation/' + $('Preparar').item.json.dados.operation_id }}`);
  setRaw('statusRes', 'Resultado status', "={{ JSON.stringify({ ok: $json.statusCode < 400, status: $json.body && $json.body.status, erro: $json.statusCode < 400 ? null : 'HTTP ' + $json.statusCode }) }}");
  emit('workflow, node, trigger, ifElse, switchCase', `export default workflow('gmcred-v8-ferramentas', 'GM Cred · V8 Ferramentas')
  .add(entrada)
  .to(tokenCache)
  .to(temToken.onTrue(preparar).onFalse(loginV8.to(salvarToken).to(preparar)))
  .add(preparar)
  .to(acaoV8
    .onCase(0, cpfOk
      .onFalse(cpfInvalido)
      .onTrue(buscar.to(analisar).to(proximo
        .onCase(0, responder)
        .onCase(1, autorizarExistente.to(autorizada))
        .onCase(2, dadosBasicos.to(achou
          .onFalse(naoAchou)
          .onTrue(criar.to(criou
            .onFalse(naoCriou)
            .onTrue(espera.to(abrirTermo).to(autorizarNova).to(criada)))))))))
    .onCase(1, configs.to(montar).to(dividir).to(simular).to(oferta).to(juntar).to(resultadoSim))
    .onCase(2, criarOp.to(opCriada))
    .onCase(3, statusOp.to(statusRes)));`, 'v8_ferramentas.js');
}

// ───────────────────────────── AÇÕES ─────────────────────────────
if (qual === 'acoes') {
  const V8 = process.argv[3];
  const E = "$('Entrada').first().json";
  trig('entrada', 'Entrada', ['lead_id', 'acao', 'cpf', 'numero', 'chave', 'tipo', 'motivo', 'prazo', 'parcela']);
  sw('rota', 'Ação', '={{ $json.acao }}', ['consultar_cpf', 'simular', 'criar_proposta', 'status_proposta']);
  // genéricas (escolher_oferta, registrar_pix, pedir_humano, encerrar, apresentou_ofertas, recuperou)
  pg('generica', 'Ação no banco', 'select credito.acao($1::text::int, $2::text, $3::text::jsonb) as r',
     `={{ [ ${E}.lead_id, ${E}.acao, JSON.stringify({ numero: ${E}.numero, chave: ${E}.chave, tipo: ${E}.tipo, motivo: ${E}.motivo }) ] }}`);
  setRaw('saidaGen', 'Resultado', '={{ JSON.stringify($json.r) }}');
  // consultar_cpf
  pg('leadConsulta', 'É demonstração?', "select coalesce(l.teste and regexp_replace($2::text, '\\D', '', 'g') = (credito.config('cpf_demo') #>> '{}'), false) as demo from credito.leads l where l.id = $1::text::int",
     `={{ [ ${E}.lead_id, ${E}.cpf || '' ] }}`);
  cond('demoCpf', 'CPF de demonstração?', '={{ $json.demo }}', isTrue);
  setRaw('consultaDemo', 'Consulta demo', `={{ JSON.stringify({ ok: true, situacao: 'com_margem', cpf: String(${E}.cpf).replace(/\\D/g, ''), nome: 'CLIENTE DEMONSTRACAO', consult_id: 'demo', status_v8: 'SUCCESS', margem: 400 }) }}`);
  execWf('v8Consulta', 'V8: consultar CPF', V8, { acao: 'consultar_cpf', cpf: `={{ ${E}.cpf }}`, dados: '' });
  pg('aplicar', 'Aplicar consulta', "select credito.acao($1::text::int, 'aplicar_consulta', $2::text::jsonb) as r",
     `={{ [ ${E}.lead_id, JSON.stringify(Object.assign({}, $json, { cliente: { nome: $json.nome || null, nascimento: $json.nascimento || null, telefone: $json.telefone || null, email: $json.email || null } })) ] }}`);
  cond('comMargem', 'Com margem?', "={{ $json.r.situacao === 'com_margem' }}", isTrue);
  setRaw('saidaConsulta', 'Resultado consulta', '={{ JSON.stringify($json.r) }}');
  // simular (também usado logo depois de uma consulta com margem)
  pg('leadSim', 'Lead para simular', "select consult_id, margem, consult_id = 'demo' as demo from credito.leads where id = $1::text::int", `={{ [ ${E}.lead_id ] }}`);
  cond('demoSim', 'Simulação demo?', '={{ $json.demo }}', isTrue);
  pg('salvarDemo', 'Salvar ofertas demo', "select credito.acao($1::text::int, 'salvar_ofertas', jsonb_build_object('ofertas', credito.ofertas_demo(coalesce(nullif($2::text, '')::numeric, (select margem from credito.leads where id = $1::text::int))))) as r",
     `={{ [ ${E}.lead_id, String(${E}.parcela || '').replace(',', '.').replace(/[^0-9.]/g, '') ] }}`);
  execWf('v8Sim', 'V8: simular', V8, { acao: 'simular', cpf: '', dados: `={{ JSON.stringify({ consult_id: $json.consult_id, margem: $json.margem, prazo: ${E}.prazo || null, parcela: String(${E}.parcela || '').replace(',', '.').replace(/[^0-9.]/g, '') || null }) }}` });
  pg('salvarSim', 'Salvar ofertas', "select credito.acao($1::text::int, 'salvar_ofertas', $2::text::jsonb) as r", `={{ [ ${E}.lead_id, JSON.stringify({ ofertas: $json.ofertas || [] }) ] }}`);
  setRaw('saidaSim', 'Resultado simulação', `={{ JSON.stringify(${E}.acao === 'consultar_cpf'
  ? ($json.r.ok ? { ok: true, situacao: 'com_margem', setor: $json.r.setor, texto: 'Aprovado! As ofertas já foram calculadas e vão aparecer na próxima mensagem. Diga só que deu certo e que já vai mostrar os valores (não diga valores).' }
                : { ok: false, situacao: 'com_margem', setor: $json.r.setor, texto: 'Aprovado, mas a simulação falhou agora. Diga que um especialista vai mandar os valores.' })
  : $json.r) }}`);
  // criar proposta
  pg('dadosOp', 'Dados da proposta', 'select credito.dados_operacao($1::text::int) as d', `={{ [ ${E}.lead_id ] }}`);
  cond('dadosOk', 'Dados ok?', '={{ $json.d.ok }}', isTrue);
  setRaw('semDados', 'Sem dados', '={{ JSON.stringify($json.d) }}');
  cond('opDemo', 'Proposta demo?', '={{ $json.d.demo }}', isTrue);
  setRaw('opFake', 'Proposta demo', `={{ JSON.stringify({ ok: true, demo: true, id: 'demo-' + ${E}.lead_id + '-' + Date.now(), url: 'https://escritorio-gm-cred.vercel.app/assinar-demo.html?p=' + ${E}.lead_id }) }}`);
  execWf('v8Op', 'V8: criar proposta', V8, { acao: 'criar_operacao', cpf: '', dados: '={{ JSON.stringify($json.d.payload) }}' });
  cond('opOk', 'Proposta criada?', '={{ $json.ok }}', isTrue);
  setRaw('opErro', 'Falha na proposta', "={{ JSON.stringify({ ok: false, texto: 'A V8 não aceitou a proposta agora (' + ($json.erro || 'erro') + '). Diga que um especialista vai verificar e use pedir_humano.' }) }}");
  pg('registrarOp', 'Registrar proposta', "select credito.acao($1::text::int, 'registrar_operacao', $2::text::jsonb) as r", `={{ [ ${E}.lead_id, JSON.stringify({ id: $json.id, url: $json.url, demo: !!$json.demo }) ] }}`);
  setRaw('saidaOp', 'Resultado proposta', '={{ JSON.stringify($json.r) }}');
  // status da proposta
  pg('leadOp', 'Proposta do cliente', "select operation_id, coalesce(status_operacao, '') as status, coalesce(operation_id like 'demo-%', false) as demo from credito.leads where id = $1::text::int", `={{ [ ${E}.lead_id ] }}`);
  cond('temOp', 'Tem proposta?', "={{ $json.operation_id || '' }}", { operator: { type: 'string', operation: 'notEmpty', singleValue: true } });
  setRaw('semOp', 'Sem proposta', "={{ JSON.stringify({ ok: false, texto: 'Ainda não existe proposta para esse cliente.' }) }}");
  cond('statusDemo', 'Status demo?', '={{ $json.demo }}', isTrue);
  setRaw('statusAtual', 'Status atual', '={{ JSON.stringify({ ok: true, status: $json.status }) }}');
  execWf('v8Status', 'V8: status da proposta', V8, { acao: 'status_operacao', cpf: '', dados: '={{ JSON.stringify({ operation_id: $json.operation_id }) }}' });
  pg('atualizar', 'Atualizar proposta', "select credito.acao($1::text::int, 'atualizar_operacao', $2::text::jsonb) as r", `={{ [ ${E}.lead_id, JSON.stringify({ status: $json.status || '' }) ] }}`);
  setRaw('saidaStatus', 'Resultado status', '={{ JSON.stringify($json.r) }}');
  emit('workflow, node, trigger, ifElse, switchCase', `export default workflow('gmcred-acoes', 'GM Cred · Ações')
  .add(entrada)
  .to(rota
    .onCase(0, leadConsulta.to(demoCpf
      .onTrue(consultaDemo.to(aplicar))
      .onFalse(v8Consulta.to(aplicar))))
    .onCase(1, leadSim)
    .onCase(2, dadosOp.to(dadosOk
      .onFalse(semDados)
      .onTrue(opDemo
        .onTrue(opFake.to(registrarOp))
        .onFalse(v8Op.to(opOk.onTrue(registrarOp).onFalse(opErro))))))
    .onCase(3, leadOp.to(temOp
      .onFalse(semOp)
      .onTrue(statusDemo
        .onTrue(statusAtual.to(atualizar))
        .onFalse(v8Status.to(atualizar)))))
    .onCase(4, generica.to(saidaGen)))
  .add(aplicar)
  .to(comMargem.onTrue(leadSim).onFalse(saidaConsulta))
  .add(leadSim)
  .to(demoSim
    .onTrue(salvarDemo.to(saidaSim))
    .onFalse(v8Sim.to(salvarSim).to(saidaSim)))
  .add(registrarOp)
  .to(saidaOp)
  .add(atualizar)
  .to(saidaStatus);`, 'acoes.js');
}

// ───────────────────────────── AGENTE ─────────────────────────────
if (qual === 'agente') {
  const ACOES = process.argv[3];
  const SELF_PLACEHOLDER = '__SELF__';
  trig('entrada', 'Entrada', ['lead_id', 'modo', 'instrucao']);
  pg('contexto', 'Contexto', 'select credito.contexto_agente($1::text::int, coalesce(nullif($2::text, \'\'), \'resposta\'), nullif($3::text, \'\')) as ctx',
     "={{ [ $json.lead_id, $json.modo || 'resposta', $json.instrucao || '' ] }}");
  cond('temCtx', 'Tem contexto?', '={{ !!$json.ctx }}', isTrue);
  add('modelo', 'languageModel', { type: '@n8n/n8n-nodes-langchain.lmChatOpenRouter', version: 1, config: { name: 'Modelo (OpenRouter)',
    parameters: { model: "={{ $('Contexto').item.json.ctx.modelo }}", options: { temperature: 0.5, maxTokens: 400, maxRetries: 2, timeout: 60000 } }, credentials: OR } });
  const L = "={{ $('Contexto').item.json.ctx.lead_id }}";
  const blank = { cpf: '', numero: '', chave: '', tipo: '', motivo: '', prazo: '', parcela: '' };
  const toolDefs = [
    ['tConsultar', 'consultar_cpf', 'Consulta na V8 quanto o cliente tem disponível no crédito CLT. Use quando o cliente mandar o CPF.', { cpf: "={{ $fromAI('cpf', 'CPF do cliente, só os 11 números', 'string') }}" }],
    ['tSimular', 'simular', 'Recalcula as ofertas com outro prazo (6 a 46 meses) e/ou uma parcela mensal menor. Use quando o cliente pedir para ajustar.', {
       prazo: "={{ $fromAI('prazo', 'Prazo desejado em meses (número). Vazio se não pediu.', 'string') }}",
       parcela: "={{ $fromAI('parcela', 'Valor de parcela mensal desejado em reais (número). Vazio se não pediu.', 'string') }}" }],
    ['tEscolher', 'escolher_oferta', 'Registra a oferta que o cliente escolheu.', { numero: "={{ $fromAI('numero', 'Número da oferta escolhida (1, 2, 3...)', 'string') }}" }],
    ['tPix', 'registrar_pix', 'Registra a chave PIX do cliente para receber o dinheiro.', {
       chave: "={{ $fromAI('chave', 'A chave PIX exatamente como o cliente mandou', 'string') }}",
       tipo: "={{ $fromAI('tipo', 'Tipo da chave: cpf, email, phone ou random', 'string') }}" }],
    ['tProposta', 'criar_proposta', 'Cria a proposta na V8 e devolve o link de formalização para enviar ao cliente. Use depois de registrar o PIX.', {}],
    ['tStatus', 'status_proposta', 'Consulta a situação atual do contrato do cliente (assinatura, análise, pagamento).', {}],
    ['tHumano', 'pedir_humano', 'Chama um especialista humano para assumir a conversa.', { motivo: "={{ $fromAI('motivo', 'Motivo em poucas palavras', 'string') }}" }],
    ['tEncerrar', 'encerrar', 'Encerra o atendimento quando o cliente diz claramente que não quer.', { motivo: "={{ $fromAI('motivo', 'Motivo em poucas palavras', 'string') }}" }],
  ];
  const toolActs = { consultar_cpf: 'consultar_cpf', simular: 'simular', escolher_oferta: 'escolher_oferta', registrar_pix: 'registrar_pix', criar_proposta: 'criar_proposta', status_proposta: 'status_proposta', pedir_humano: 'pedir_humano', encerrar: 'encerrar' };
  for (const [v, nome, desc, vals] of toolDefs) {
    const value = Object.assign({ lead_id: L, acao: toolActs[nome] }, blank, vals);
    add(v, 'tool', { type: '@n8n/n8n-nodes-langchain.toolWorkflow', version: 2.2, config: { name: nome, parameters: {
      description: desc, source: 'database', workflowId: { __rl: true, mode: 'id', value: ACOES },
      workflowInputs: { mappingMode: 'defineBelow', value, matchingColumns: [], schema: schemaOf(Object.keys(value)), attemptToConvertTypes: false, convertFieldsToString: true } } } });
  }
  // agente (as sub-conexões são referências, por isso vai à parte)
  const agenteSpec = { type: '@n8n/n8n-nodes-langchain.agent', version: 3.1, config: { name: 'Ana (agente)', parameters: {
    promptType: 'define', text: '={{ $json.ctx.mensagem }}', options: { systemMessage: '={{ $json.ctx.system }}', maxIterations: 6, enableStreaming: false } },
    onError: 'continueRegularOutput', retryOnFail: true, maxTries: 2, waitBetweenTries: 1500 } };
  setRaw('baloes', 'Dividir em balões', `={{ JSON.stringify((() => {
  const t = String($json.output || 'Desculpa, tive uma instabilidade aqui 😅 Pode me mandar de novo?').replace(/\\r/g, '').replace(/^#+\\s*/gm, '').replace(/\\n{3,}/g, '\\n\\n').trim();
  const frases = t.split(/\\n\\n+/).flatMap(p => p.split(/(?<=[.!?…])\\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9*])/)).map(s => s.trim()).filter(Boolean);
  const b = []; let cur = '';
  for (const s of frases) {
    if (cur && (cur + ' ' + s).length > 220) { b.push(cur); cur = s; } else { cur = cur ? cur + ' ' + s : s; }
  }
  if (cur) b.push(cur);
  return { baloes: (b.length ? b : ['Oi! 😊']).slice(0, 3) };
})()) }}`);
  pg('registrar', 'Registrar resposta', 'select credito.registrar_resposta($1::text::int, $2::text::int, $3::text::json, $4::text) as r',
     "={{ [ String($('Contexto').item.json.ctx.lead_id), String($('Contexto').item.json.ctx.agente_id), JSON.stringify($json.baloes), $('Contexto').item.json.ctx.modo ] }}");
  pg('depois', 'Depois da resposta', `select l.setor_id as setor, l.canal, l.telefone,
  case when $2::text = 'apresentar' then credito.acao(l.id, 'apresentou_ofertas') when $2::text = 'recuperar' then credito.acao(l.id, 'recuperou') end as passo
from credito.leads l where l.id = $1::text::int`, "={{ [ String($('Contexto').item.json.ctx.lead_id), $('Contexto').item.json.ctx.modo ] }}");
  cond('apresentar', 'Precisa apresentar ofertas?', "={{ $json.setor === 'simulacao' && $('Contexto').item.json.ctx.modo !== 'apresentar' }}", isTrue);
  execWf('apresentarOfertas', 'Apresentar ofertas', SELF_PLACEHOLDER, { lead_id: "={{ String($('Contexto').item.json.ctx.lead_id) }}", modo: 'apresentar', instrucao: '' });
  setRaw('fim', 'Fim', "={{ JSON.stringify({ ok: true, lead_id: $('Contexto').item.json.ctx.lead_id }) }}");
  const extra = `const agente = node(Object.assign(${JSON.stringify(agenteSpec)}, {}));\n\n`;
  // o SDK precisa das sub-conexões no config: reescrevemos com referências às variáveis
  const agenteCode = `const agente = node({"type":"@n8n/n8n-nodes-langchain.agent","version":3.1,"config":{"name":"Ana (agente)","parameters":${JSON.stringify(agenteSpec.config.parameters)},"onError":"continueRegularOutput","retryOnFail":true,"maxTries":2,"waitBetweenTries":1500,"subnodes":{"model":modelo,"tools":[tConsultar, tSimular, tEscolher, tPix, tProposta, tStatus, tHumano, tEncerrar]}}});\n\n`;
  emit('workflow, node, trigger, ifElse, languageModel, tool', `export default workflow('gmcred-agente', 'GM Cred · Agente')
  .add(entrada)
  .to(contexto)
  .to(temCtx.onTrue(agente))
  .add(agente)
  .to(baloes)
  .to(registrar)
  .to(depois)
  .to(apresentar.onTrue(apresentarOfertas.to(fim)).onFalse(fim));`, 'agente.js', agenteCode);
}

// ───────────────────────────── ACOMPANHAMENTO ─────────────────────────────
if (qual === 'acompanhamento') {
  const ACOES = process.argv[3], AGENTE = process.argv[4];
  add('relogio', 'trigger', { type: 'n8n-nodes-base.scheduleTrigger', version: 1.2, config: { name: 'A cada 2 minutos', parameters: { rule: { interval: [ { field: 'minutes', minutesInterval: 2 } ] } } } });
  pg('fila', 'Fila', 'select (credito.fila_acompanhamento()->\'consultas\') as consultas, (credito.fila_acompanhamento()->\'operacoes\') as operacoes, (credito.fila_acompanhamento()->\'recuperar\') as recuperar');
  add('sepConsultas', 'node', { type: 'n8n-nodes-base.splitOut', version: 1, config: { name: 'Consultas em andamento', parameters: { fieldToSplitOut: 'consultas', options: {} } } });
  execWf('reconsultar', 'Reconsultar CPF', ACOES, { lead_id: '={{ String($json.lead_id) }}', acao: 'consultar_cpf', cpf: '={{ $json.cpf }}', numero: '', chave: '', tipo: '', motivo: '', prazo: '', parcela: '' });
  cond('virouOferta', 'Ofertas prontas?', "={{ $json.setor === 'simulacao' }}", isTrue);
  execWf('apresentar', 'Apresentar ofertas', AGENTE, { lead_id: "={{ String($('Consultas em andamento').item.json.lead_id) }}", modo: 'apresentar', instrucao: '' });
  add('sepOps', 'node', { type: 'n8n-nodes-base.splitOut', version: 1, config: { name: 'Propostas abertas', parameters: { fieldToSplitOut: 'operacoes', options: {} } } });
  execWf('statusOp', 'Status da proposta', ACOES, { lead_id: '={{ String($json.lead_id) }}', acao: 'status_proposta', cpf: '', numero: '', chave: '', tipo: '', motivo: '', prazo: '', parcela: '' });
  cond('mudou', 'Mudou?', '={{ $json.mudou === true }}', isTrue);
  execWf('avisar', 'Avisar cliente', AGENTE, { lead_id: "={{ String($('Propostas abertas').item.json.lead_id) }}", modo: 'aviso', instrucao: "={{ 'O contrato mudou de situação. ' + ($json.texto || '') + ' Avise o cliente em uma frase.' }}" });
  add('sepRec', 'node', { type: 'n8n-nodes-base.splitOut', version: 1, config: { name: 'Clientes parados', parameters: { fieldToSplitOut: 'recuperar', options: {} } } });
  execWf('recuperar', 'Recuperar cliente', AGENTE, { lead_id: '={{ String($json.lead_id) }}', modo: 'recuperar', instrucao: '' });
  emit('workflow, node, trigger, ifElse', `export default workflow('gmcred-acompanhamento', 'GM Cred · Acompanhamento')
  .add(relogio)
  .to(fila)
  .to(sepConsultas.to(reconsultar).to(virouOferta.onTrue(apresentar)))
  .add(fila)
  .to(sepOps.to(statusOp).to(mudou.onTrue(avisar)))
  .add(fila)
  .to(sepRec.to(recuperar));`, 'acompanhamento.js');
}
