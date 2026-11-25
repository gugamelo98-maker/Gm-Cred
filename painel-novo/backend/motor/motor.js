// Motor de crédito (separado da Ana). Avança cada banco+produto um passo por chamada.
const H = this.helpers;
const ctx = $('Contexto').first().json.c;
const N8N = 'https://rarelookingorca-n8n.cloudfy.live/webhook';
const V8_DADOS = 'https://v2-bff-prod-front.yellowisland-b252a8a0.eastus.azurecontainerapps.io/private-consignment/consult/client-data/basic/';
const HUB = 'https://api.hubcredito.com.br/api';
const V8F = 'https://bff.v8sistema.com';
const cpf = ctx.cpf, tk = ctx.tokens || {}, cfg = ctx.cfg || {};
const partes = JSON.parse(JSON.stringify(ctx.partes || {}));
const cliente = Object.assign({}, ctx.cliente || {});
const TERMINAL = ['ofertas', 'sem_ofertas', 'sem_margem', 'sem_saldo', 'sem_autorizacao', 'sem_adesao', 'erro'];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const num = (v) => Number(v) || 0;
const agora = () => new Date().toISOString();
const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });

// o Code node do n8n morre em 60s: cada chamada do motor trabalha no máximo ~42s e o resto fica para o próximo "atualizar"
const FIM = Date.now() + 42000;
const resta = () => FIM - Date.now();
class Tempo extends Error { constructor() { super('tempo'); this.tempo = true; } }
const http = async (method, url, opt) => {
  opt = opt || {};
  if (resta() < 3000) throw new Tempo();
  const lim = Math.min(opt.timeout || 25000, resta() - 1500);
  try {
    const o = { method, url, headers: Object.assign({}, opt.headers || {}), json: true, timeout: lim, returnFullResponse: true, ignoreHttpStatusErrors: true };
    if (opt.body !== undefined) o.body = opt.body;
    const r = await H.httpRequest(o);
    let b = r.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { /* texto */ } }
    return { s: Number(r.statusCode) || 0, b };
  } catch (e) {
    if (resta() < 2500) throw new Tempo();
    return { s: 0, b: null, err: String(e.message || e).slice(0, 200) };
  }
};
const erroDe = (r) => {
  const b = (r && r.b) || {};
  const e = b.error || {};
  const msg = (Array.isArray(b.errors) && b.errors.length ? b.errors.join(' · ') : '') || e.message || b.message || b.error_description || (typeof b === 'string' ? b : '') || (r && r.err) || ('HTTP ' + (r && r.s));
  return String(msg).slice(0, 300);
};

// ---------- dados do cliente (V8) + sexo pelo nome e cidade padrão (a HUB exige) ----------
const sexoDoNome = (nome) => {
  const p = String(nome || '').trim().split(/\s+/)[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!p) return 'M';
  const homem = ['luca', 'lucca', 'joshua', 'jonata', 'mica', 'costa', 'sacha', 'nikita', 'gianluca', 'elias', 'tobias', 'matias', 'jonas', 'lucas', 'tomas', 'andre', 'jose'];
  const mulher = ['isabel', 'raquel', 'rachel', 'beatriz', 'ester', 'esther', 'ruth', 'carmen', 'miriam', 'mirian', 'ingrid', 'iris', 'lis', 'liz', 'jaqueline', 'jacqueline', 'michele', 'michelle', 'aline', 'eliane', 'elaine', 'daiane', 'daniele', 'suelen', 'sueli', 'simone', 'solange', 'josiane', 'viviane', 'adriane', 'ariane', 'karine', 'karen', 'kelly', 'keli', 'kelli', 'cristiane', 'cristine', 'rosangela', 'rosane', 'rosemeire', 'rosimeire', 'marlene', 'marilene', 'irene', 'lourdes', 'nazare', 'neide', 'neuza', 'ines', 'valdete', 'dulce', 'cleide', 'claudete', 'edinete', 'ivone', 'yvone', 'denise', 'elisete', 'lucimar', 'tais', 'thais', 'ana', 'luz'];
  if (mulher.includes(p)) return 'F';
  if (homem.includes(p)) return 'M';
  if (/a$/.test(p)) return 'F';
  if (/(ane|ine|iane|eli|ely|elly|ele|ice|ete|ise|ize|ede|ilde|aine|ysse|eide|essa)$/.test(p)) return 'F';
  return 'M';
};
const garantirCliente = async () => {
  if (resta() > 30000 && !(cliente.nome && cliente.nascimento && cliente.telefone) && tk.v8_clt) {
    const r = await http('GET', V8_DADOS + cpf, { headers: { Authorization: 'Bearer ' + tk.v8_clt }, timeout: 15000 });
    const b = (r.s === 200 && r.b) || {};
    if (!cliente.nome && b.name) cliente.nome = String(b.name).trim();
    const nasc = String(b.birthDate || '');
    if (!cliente.nascimento && nasc) cliente.nascimento = /^\d{2}\/\d{2}\/\d{4}$/.test(nasc) ? nasc.split('/').reverse().join('-') : nasc.slice(0, 10);
    if (!cliente.telefone) { const f = String((b.phoneRegionCode || '') + (b.phoneNumber || '')).replace(/\D/g, ''); if (f) cliente.telefone = f; }
    if (!cliente.email && b.email) cliente.email = String(b.email).trim().toLowerCase();
  }
  if (!cliente.sexo && cliente.nome) cliente.sexo = sexoDoNome(cliente.nome);
  if (!cliente.cidade) cliente.cidade = 'Florianópolis';
};

// ---------- endpoints do painel (V8 e Unno CLT), chamados com o acesso interno do motor ----------
const painel = async (ep, acao, dados) => {
  let ult = 'sem resposta';
  for (let t = 0; t < 3; t++) {
    const r = await http('POST', N8N + '/escritorio/' + ep, { body: { k: cfg.sessao, acao, cpf, dados: JSON.stringify(dados || {}) }, timeout: 55000 });
    if (r.s === 401) return { ok: false, situacao: 'erro', erro: 'O motor está sem acesso ao painel' };
    if (r.s === 200 && r.b && typeof r.b === 'object') return r.b;
    ult = erroDe(r); if (resta() < 8000) throw new Tempo(); await sleep(1500);
  }
  return { ok: false, situacao: 'erro', erro: ult };
};

// ===================== CLT V8 =====================
const v8clt = async (p) => {
  if (!p.passo || p.passo === 'status') {
    const d = p.passo === 'status' ? await painel('v8', 'status', {}) : await painel('v8', 'consultar_cpf', {});
    if (d.situacao === 'processando' || d.situacao === 'sem_consulta') {
      p.passo = 'status'; p.situacao = 'processando'; p.mensagem = 'A V8 está processando a consulta';
      if (p.tentativas > 45) { p.situacao = 'erro'; p.mensagem = 'A V8 demorou demais. Consulte de novo.'; }
      return p;
    }
    if (d.situacao === 'com_margem') {
      p.margem = num(d.margem); p.consult_id = d.consult_id;
      if (!(p.margem > 0) || !p.consult_id) { p.situacao = 'sem_margem'; p.mensagem = 'Sem margem na V8'; return p; }
      p.passo = 'simular';
    } else if (d.situacao === 'sem_margem') { p.situacao = 'sem_margem'; p.mensagem = d.descricao || 'Sem margem na V8'; return p; }
    else { p.situacao = 'erro'; p.mensagem = d.situacao === 'precisa_dados' ? 'A V8 não achou os dados desse CPF' : (d.erro || 'A V8 respondeu com erro'); return p; }
  }
  if (p.passo === 'simular') {
    const base = { consult_id: p.consult_id, margem: p.margem, parcela: p.margem };
    const roda = (pz) => painel('v8', 'simular', Object.assign({}, base, { prazo: String(pz) }));
    const d0 = await roda('');
    let lista = (d0.ofertas || []).slice();
    const prazos = [...new Set([...String(d0.limites || '').matchAll(/(\d+)x/g)].map(m => +m[1]))].filter(x => !lista.some(o => num(o.prazo) === x)).slice(0, 6);
    (await Promise.all(prazos.map(roda))).forEach(d => (d.ofertas || []).forEach(o => lista.push(o)));
    const vis = {};
    lista = lista.filter(o => { const k = o.prazo + '|' + o.parcela + '|' + o.seguro; if (vis[k] || !(num(o.valor) > 0)) return false; vis[k] = 1; return true; });
    p.ofertas = lista.map(o => ({ tabela: 'CLT Acelera', banco: 'V8', seguro: o.seguro !== false, prazo: num(o.prazo), parcela: num(o.parcela), valor: num(o.valor) }));
    p.margem_texto = String(d0.limites || '');
    p.situacao = p.ofertas.length ? 'ofertas' : 'sem_ofertas'; p.passo = 'fim';
    p.mensagem = p.ofertas.length ? '' : ((d0.erros || [])[0] || d0.erro || 'A V8 não liberou oferta');
  }
  return p;
};

// ===================== CLT Unno (API direta; o endpoint do painel disputava o executor de código do n8n) =====================
const unnoC = (method, path, body, idem) => http(method, cfg.unno_base + '/api/v1/clt/applications' + path, { headers: Object.assign({ Authorization: 'Bearer ' + tk.unno, 'Content-Type': 'application/json' }, idem ? { 'Idempotency-Key': idem } : {}), body, timeout: 20000 });
const unnoAssina = async (consent) => {
  const partes = String(consent || '').split('?')[0].split('/'); const termo = partes[partes.length - 1];
  if (!termo || termo.length < 8) return false;
  const r = await http('PUT', cfg.unno_base.replace('/public', '') + '/auth/api/v1/terms/authorize/' + termo, { headers: { Authorization: 'Bearer ' + tk.unno, 'Content-Type': 'application/json' }, body: { customer_full_name: cliente.nome }, timeout: 15000 });
  return r.s >= 200 && r.s < 300;
};
const consentDe = (b) => (b && ((b.authorization && b.authorization.consent_url) || b.consent_url)) || '';
const unnoclt = async (p) => {
  if (!tk.unno || !cfg.unno_base) { p.situacao = 'erro'; p.passo = 'fim'; p.mensagem = 'Sem acesso à Unno no momento (renovando). Consulte de novo em 1 minuto.'; return p; }
  if (!p.passo) {
    let fone = String(cliente.telefone || '').replace(/\D/g, ''); if (fone.length > 11 && fone.startsWith('55')) fone = fone.slice(2);
    if (!cliente.nome || !/^\d{4}-\d{2}-\d{2}$/.test(String(cliente.nascimento || '')) || ![10, 11].includes(fone.length)) {
      if (p.tentativas < 4) { p.situacao = 'processando'; p.mensagem = 'Buscando os dados do cliente'; return p; }
      p.situacao = 'erro'; p.passo = 'fim'; p.mensagem = 'Faltam dados do cliente para a Unno (nome, nascimento ou celular)'; return p;
    }
    const r = await unnoC('POST', '', { customer: { cpf, phone: fone, email: cliente.email || 'cliente@gmail.com', name: cliente.nome, birth_date: cliente.nascimento }, user_uuid: cfg.unno_user_uuid }, 'motor-' + cpf + '-' + Date.now());
    const id = r.b && (r.b.application_id || r.b.id);
    if (!(r.s >= 200 && r.s < 300 && id)) { p.situacao = 'erro'; p.passo = 'fim'; p.mensagem = 'Unno: ' + erroDe(r); return p; }
    p.application_id = id; p.passo = 'status'; p.situacao = 'processando'; p.mensagem = 'A Unno está consultando';
    let url = consentDe(r.b);
    if (!url && String(r.b.authorization_status || (r.b.authorization && r.b.authorization.status) || '') !== 'AUTHORIZED') { const l = await unnoC('POST', '/' + id + '/authorization', null, 'motor-link-' + Date.now()); url = consentDe(l.b); }
    if (url) p.termo_assinado = await unnoAssina(url);
    return p;
  }
  const s = await unnoC('GET', '/' + p.application_id + '/status');
  if (s.s !== 200 || !s.b) { if (p.tentativas > 40) { p.situacao = 'erro'; p.passo = 'fim'; p.mensagem = 'Unno: ' + erroDe(s); } return p; }
  const st = String(s.b.status || ''); p.status_unno = st;
  if (st === 'NO_MARGIN') { p.situacao = 'sem_margem'; p.passo = 'fim'; p.mensagem = 'Sem margem na Unno'; return p; }
  if (st === 'NO_OFFERS') { p.situacao = 'sem_ofertas'; p.passo = 'fim'; p.mensagem = 'A Unno não liberou oferta para este CPF'; return p; }
  if (st === 'FAILED' || st === 'AUTHORIZATION_UNAVAILABLE' || st === 'EXPIRED') { p.situacao = 'erro'; p.passo = 'fim'; p.mensagem = 'A Unno não conseguiu consultar (' + st + ')'; return p; }
  if (st === 'AWAITING_AUTHORIZATION') {
    p.sem_termo = (p.sem_termo || 0) + 1; p.situacao = 'processando'; p.mensagem = 'Assinando o termo na Unno';
    const ap = await unnoC('GET', '/' + p.application_id); let url = consentDe(ap.b);
    if (!url) { const l = await unnoC('POST', '/' + p.application_id + '/authorization', null, 'motor-link-' + Date.now()); url = consentDe(l.b); }
    if (url) p.termo_assinado = await unnoAssina(url);
    if (p.sem_termo > 8) { p.situacao = 'erro'; p.passo = 'fim'; p.mensagem = 'A Unno não liberou a consulta (termo). Consulte de novo.'; }
    return p;
  }
  if (st === 'AWAITING_SIMULATION' && !(num(s.b.offers_count) > 0) && !p.simulou) {
    const m = await unnoC('GET', '/' + p.application_id + '/margin');
    const emps = ((m.b && m.b.employments) || []).filter(e => num(e.available_margin) > 0 && (!e.eligibility || e.eligibility === 'ELIGIBLE')).sort((x, y) => num(y.available_margin) - num(x.available_margin));
    if (m.s === 200 && !emps.length) { p.situacao = 'sem_margem'; p.passo = 'fim'; p.mensagem = 'Sem margem na Unno'; return p; }
    if (!emps.length) { p.situacao = 'processando'; p.mensagem = 'A Unno está consultando a margem'; return p; }
    p.margem = num(emps[0].available_margin);
    const sm = await unnoC('POST', '/' + p.application_id + '/simulations', { employment_id: emps[0].employment_id, basis: 'INSTALLMENT', installment_amount: p.margem }, 'motor-sim-' + p.application_id);
    if (sm.s >= 200 && sm.s < 300) p.simulou = true;
    p.situacao = 'simulando'; p.mensagem = 'Simulando na Unno'; return p;
  }
  const pronto = st === 'OFFERS_AVAILABLE' && num(s.b.quotes_pending) === 0 && num(s.b.offers_count) > 0;
  if (!pronto) {
    p.situacao = p.simulou ? 'simulando' : 'processando'; p.mensagem = p.simulou ? 'Simulando na Unno' : 'A Unno está consultando';
    if (p.tentativas > 80) { p.situacao = 'erro'; p.passo = 'fim'; p.mensagem = 'A Unno demorou demais.'; }
    return p;
  }
  const r = await unnoC('GET', '/' + p.application_id);
  p.ofertas = ((r.b && r.b.offers) || []).filter(o => (!o.status || o.status === 'AVAILABLE') && num(o.net_amount) > 0).map(o => ({ tabela: String(o.common_name || o.table_name || '').trim(), variante: String(o.table_name || '').trim(), banco: String(o.source || ''), seguro: o.insurance_included == null ? true : !!o.insurance_included, prazo: num(o.installment_count), parcela: num(o.installment_amount), valor: num(o.net_amount), offer_id: o.offer_id || '', tabela_id: o.table_id || '', expira: o.expires_at || '' }));
  p.passo = 'fim'; p.situacao = p.ofertas.length ? 'ofertas' : 'sem_ofertas'; p.mensagem = p.ofertas.length ? '' : 'A Unno não liberou oferta';
  return p;
};

// ===================== CLT HUB (API oficial) =====================
const hubCall = (method, path, body) => http(method, HUB + path, { headers: { Authorization: 'Bearer ' + tk.hub, 'Content-Type': 'application/json' }, body, timeout: 30000 });
const hubStatus = async (id) => {
  const r = await hubCall('GET', '/presimulacao/' + id);
  if (r.s !== 200 || !r.b || !r.b.value) return { situacao: 'erro', mensagem: 'HUB: ' + erroDe(r) };
  const v = r.b.value, st = Number(v.idStatus), msg = String(v.mensagemErro || '');
  const base = { bancarizador: v.nomeBancarizador || '', requerVinculo: v.requerVinculo === true };
  if (st === 6 || st === 12) return Object.assign(base, { situacao: 'pronto' });
  if ([0, 1, 4, 13].includes(st)) return Object.assign(base, { situacao: 'processando' });
  if (st === 11 || /PRAUTH|autoriza/i.test(msg)) return Object.assign(base, { situacao: 'aguardando_termo' });
  if (st === 3) {
    const vs = (v.vinculos || []).filter(x => x && x.elegivel !== false);
    return Object.assign(base, { situacao: 'pronto', requerVinculo: true, vinculos: vs.map(x => ({ idCotacao: x.vinculoId, matricula: x.matricula, tipoInscricao: x.tipoInscricao, numeroInscricao: x.numeroInscricao })) });
  }
  if (st === 5) return Object.assign(base, { situacao: 'sem_ofertas' });
  if (st === 2) return Object.assign(base, { situacao: 'sem_margem' });
  return Object.assign(base, { situacao: 'erro', mensagem: (v.statusDescricao || 'Erro') + (msg ? ' · ' + msg.slice(0, 160) : '') });
};
const hubclt = async (p) => {
  if (!tk.hub) { p.situacao = 'erro'; p.mensagem = 'Sem acesso à HUB no momento (renovando). Consulte de novo em 1 minuto.'; p.passo = 'fim'; return p; }
  if (!p.passo) {
    let fone = String(cliente.telefone || '').replace(/\D/g, ''); if (fone.length > 11 && fone.startsWith('55')) fone = fone.slice(2);
    const falta = [];
    if (!cliente.nome) falta.push('nome'); if (!/^\d{4}-\d{2}-\d{2}$/.test(String(cliente.nascimento || ''))) falta.push('nascimento'); if (![10, 11].includes(fone.length)) falta.push('celular');
    if (falta.length) {
      if (p.tentativas < 4) { p.situacao = 'processando'; p.mensagem = 'Buscando os dados do cliente'; return p; }
      p.situacao = 'erro'; p.passo = 'fim'; p.mensagem = 'Faltam dados do cliente para a HUB: ' + falta.join(', '); return p;
    }
    const r = await hubCall('POST', '/presimulacao', { cpf, lojaId: num(cfg.hub_loja) || 9562, numeroParcelas: 24, valor: 0, tipoOperacao: 27, nome: cliente.nome, email: cliente.email || 'cliente@gmail.com', telefone: fone, dataNascimento: cliente.nascimento + 'T00:00:00.000Z', sexo: cliente.sexo === 'F' ? 2 : 1, cidade: cliente.cidade || 'Florianópolis' });
    if (r.s === 200 && r.b && r.b.value && r.b.value.id) { p.presim_id = r.b.value.id; p.passo = 'status'; p.situacao = 'processando'; p.mensagem = 'A HUB está consultando'; return p; }
    p.situacao = 'erro'; p.passo = 'fim'; p.mensagem = 'HUB: ' + erroDe(r); return p;
  }
  if (p.passo === 'status') {
    const st = await hubStatus(p.presim_id);
    if (st.situacao === 'processando') { p.situacao = 'processando'; p.mensagem = 'A HUB está consultando'; if (p.tentativas > 60) { p.situacao = 'erro'; p.passo = 'fim'; p.mensagem = 'A HUB demorou demais.'; } return p; }
    if (st.situacao === 'aguardando_termo') { p.situacao = 'aguardando_termo'; p.link_termo = 'https://termo.hubcredito.com.br/?cpf=' + cpf; p.mensagem = 'O cliente precisa assinar o termo da HUB'; return p; }
    if (st.situacao !== 'pronto') { p.passo = 'fim'; p.situacao = st.situacao === 'sem_margem' ? 'sem_margem' : st.situacao === 'sem_ofertas' ? 'sem_ofertas' : 'erro'; p.mensagem = st.mensagem || (st.situacao === 'sem_margem' ? 'Sem vínculo CLT elegível na HUB' : 'A HUB não liberou oferta'); return p; }
    p.vinculo = (st.vinculos || [])[0] || null; p.requerVinculo = !!st.requerVinculo; p.bancarizador = st.bancarizador; p.passo = 'simular';
  }
  if (p.passo === 'simular') {
    const montar = (pz) => { const b = { cpf, lojaId: num(cfg.hub_loja) || 9562, numeroParcelas: pz, valor: 0, PreSimulacaoId: Number(p.presim_id) }; const v = p.vinculo; if (p.requerVinculo && v) { b.idCotacao = v.idCotacao; b.matricula = v.matricula; b.codigoInscricaoEmpregador = Number(v.tipoInscricao) || 1; b.numeroInscricaoEmpregador = String(v.numeroInscricao || '').replace(/\D/g, ''); } return b; };
    const res = await Promise.all([48, 36, 24, 18, 12].map(pz => hubCall('POST', '/Clt/simular', montar(pz))));
    let lista = [], erros = [];
    res.forEach(r => {
      if (r.s === 200 && r.b && r.b.hasSuccess !== false && Array.isArray(r.b.value)) r.b.value.forEach(x => { const o = x.opcaoProposta || {}, t = x.tabelaFinanciamento || {}; lista.push({ tabela: String(t.descricao || 'Tabela CLT').trim(), banco: p.bancarizador || 'HUB', seguro: o.comSeguro == null ? true : !!o.comSeguro, prazo: num(o.numeroParcelas), parcela: num(o.valorParcela), valor: num(o.valorDesembolsoTrabalhador) || num(o.valorDesembolsoTotal), taxa: num(o.taxaJuros) }); });
      else erros.push(erroDe(r));
    });
    const vis = {}; lista = lista.filter(o => { const k = o.tabela + '|' + o.prazo + '|' + o.parcela + '|' + o.seguro; if (vis[k] || !(o.valor > 0 && o.prazo > 0)) return false; vis[k] = 1; return true; });
    p.ofertas = lista; p.passo = 'fim'; p.situacao = lista.length ? 'ofertas' : 'sem_ofertas';
    p.mensagem = lista.length ? '' : ([...new Set(erros)].join(' · ').slice(0, 300) || 'A HUB não liberou oferta');
  }
  return p;
};

// ===================== FGTS HUB (BMP e J17) =====================
const classificaFgts = (txt) => /ades[aã]o|saque[- ]anivers/i.test(txt) ? 'sem_adesao' : /autoriza/i.test(txt) ? 'sem_autorizacao' : /saldo/i.test(txt) ? 'sem_saldo' : 'erro';
const hubfgts = async (p) => {
  if (!tk.hub) { p.situacao = 'erro'; p.mensagem = 'Sem acesso à HUB no momento (renovando). Consulte de novo em 1 minuto.'; p.passo = 'fim'; return p; }
  const bzs = ['BMP', 'J17'];
  const res = await Promise.all(bzs.map(bz => hubCall('POST', '/proposta/simulacaoFGTSBancarizador', { cpfCliente: cpf, lojaId: num(cfg.hub_loja) || 9562, bancarizador: bz })));
  let lista = [], erros = [];
  res.forEach((r, i) => {
    if (r.s === 200 && r.b && Array.isArray(r.b.value)) r.b.value.forEach(x => lista.push({ tabela: String(x.nomeTabela || '').trim(), tabela_cod: x.tabelaComercial, banco: bzs[i], prazo: num(x.quantidadeParcelas), valor: num(x.valorCliente), bruto: num(x.valorbruto) }));
    else erros.push(bzs[i] + ': ' + erroDe(r));
  });
  p.ofertas = lista.filter(o => o.valor > 0); p.passo = 'fim';
  if (p.ofertas.length) { p.situacao = 'ofertas'; p.mensagem = ''; }
  else { const txt = erros.join(' · '); p.situacao = classificaFgts(txt); p.mensagem = txt.slice(0, 300) || 'A HUB não liberou oferta'; }
  return p;
};

// ===================== FGTS V8 (saldo em BMS e Girotech, todas as tabelas) =====================
const v8fCall = (method, path, body) => http(method, V8F + path, { headers: { Authorization: 'Bearer ' + tk.v8_fgts, 'Content-Type': 'application/json' }, body, timeout: 30000 });
const BZ_V8 = { bms: 'BMP', girotech: 'GIRO' };
const v8fgts = async (p) => {
  if (!tk.v8_fgts) { p.situacao = 'erro'; p.mensagem = 'Sem acesso à V8 FGTS no momento (renovando). Consulte de novo em 1 minuto.'; p.passo = 'fim'; return p; }
  if (!p.passo) {
    const rs = await Promise.all(['bms', 'girotech'].map(pv => v8fCall('POST', '/fgts/balance', { documentNumber: cpf, provider: pv })));
    p.pedido = rs.map((r, i) => ({ provider: ['bms', 'girotech'][i], s: r.s, erro: r.s >= 400 || r.s === 0 ? erroDe(r) : '' }));
    p.pedido_em = agora(); p.passo = 'saldo'; p.situacao = 'processando'; p.mensagem = 'Consultando o saldo do FGTS na V8';
    return p;
  }
  if (p.passo === 'saldo') {
    const r = await v8fCall('GET', '/fgts/balance?search=' + cpf);
    const b = r.b; let lista = Array.isArray(b) ? b : ((b && (b.data || b.items)) || ((b && (b.balanceId || b.amount || b.periods)) ? [b] : []));
    const desde = Date.parse(p.pedido_em) - 120000;
    const recentes = lista.filter(x => !x.createdAt && !x.updatedAt || Date.parse(x.updatedAt || x.createdAt) >= desde);
    if (!p.amostra && lista[0]) p.amostra = Object.keys(lista[0]).slice(0, 25);
    const porProv = {};
    recentes.forEach(x => { const pv = String(x.provider || x.balanceProvider || '').toLowerCase(); const atual = porProv[pv]; if (!atual || Date.parse(x.updatedAt || x.createdAt || 0) > Date.parse(atual.updatedAt || atual.createdAt || 0)) porProv[pv] = x; });
    const saldos = [], motivos = [];
    let pendente = false;
    Object.entries(porProv).forEach(([pv, x]) => {
      const periods = x.periods || x.installments || x.repasses || [];
      const amount = num(x.amount || x.balance);
      const st = String(x.status || '').toLowerCase();
      const info = String(x.statusInfo || x.errorMessage || x.message || '');
      if ((periods && periods.length) || amount > 0) saldos.push({ provider: pv || 'bms', balanceId: x.balanceId || x.id, amount, periods });
      else if (/pend|process|wait|aguard|queue/.test(st) || (!info && !/error|fail|reject|success|done|finish/.test(st))) pendente = true;
      else motivos.push(info || st);
    });
    if (saldos.length) { p.saldos = saldos; p.passo = 'simular'; }
    else if (pendente || !Object.keys(porProv).length) {
      p.situacao = 'processando'; p.mensagem = 'A V8 ainda está consultando o saldo';
      if (p.tentativas > 36) { p.situacao = 'erro'; p.passo = 'fim'; p.mensagem = 'A V8 não respondeu o saldo a tempo. Consulte de novo.'; }
      return p;
    } else {
      const txt = [...new Set(motivos)].join(' · '); p.passo = 'fim';
      p.situacao = /autoriza/i.test(txt) ? 'sem_autorizacao' : /ades[aã]o|anivers/i.test(txt) ? 'sem_adesao' : 'sem_saldo';
      p.mensagem = p.situacao === 'sem_autorizacao' ? 'O cliente precisa autorizar a V8 no app do FGTS' : (txt.slice(0, 300) || 'Sem saldo de FGTS');
      return p;
    }
  }
  if (p.passo === 'simular') {
    const ofertas = p.parcial ? p.parcial.ofertas : [], erros = p.parcial ? p.parcial.erros : [];
    const ini = p.parcial ? p.parcial.pos : [0, 0];
    for (let si = ini[0]; si < p.saldos.length; si++) {
      const sd = p.saldos[si];
      const rf = await v8fCall('GET', '/fgts/simulations/fees/new?provider=' + sd.provider);
      let fees = Array.isArray(rf.b) ? rf.b : ((rf.b && (rf.b.data || rf.b.items)) || []);
      fees = fees.map(f => ({ id: (f.simulation_fees && f.simulation_fees.id_simulation_fees) || f.id_simulation_fees || f.id, label: (f.simulation_fees && f.simulation_fees.label) || f.label || f.visible_name || f.name || '', ativo: f.active !== false })).filter(f => f.id && f.ativo);
      if (!fees.length) { erros.push(BZ_V8[sd.provider] + ': sem tabelas (' + erroDe(rf) + ')'); continue; }
      const desired = (sd.periods || []).map(x => ({ totalAmount: num(x.amount || x.totalAmount), dueDate: x.dueDate || x.date })).filter(x => x.dueDate);
      const simula = (fee, prov) => v8fCall('POST', '/fgts/simulations', { balanceId: sd.balanceId, targetAmount: 0, documentNumber: cpf, desiredInstallments: desired, provider: prov, simulationFeesId: fee.id });
      for (let i = si === ini[0] ? ini[1] : 0; i < fees.length; i += 4) {
        if (resta() < 15000) { p.parcial = { ofertas, erros, pos: [si, i] }; p.situacao = 'simulando'; p.mensagem = 'Simulando as tabelas FGTS da V8'; return p; }
        const lote = fees.slice(i, i + 4);
        const rs = await Promise.all(lote.map(f => simula(f, sd.provider)));
        for (let j = 0; j < lote.length; j++) {
          let r = rs[j];
          if (!(r.s < 300 && r.b && num(r.b.availableBalance) > 0)) { const r2 = await simula(lote[j], 'qi'); if (r2.s < 300 && r2.b && num(r2.b.availableBalance) > 0) r = r2; }
          if (r.s < 300 && r.b && num(r.b.availableBalance) > 0) ofertas.push({ tabela: lote[j].label, banco: BZ_V8[sd.provider] || sd.provider.toUpperCase(), prazo: num(r.b.totalInstallments) || desired.length, valor: num(r.b.availableBalance), bruto: num(r.b.totalBalance || r.b.emissionAmount), saldo: sd.amount });
          else erros.push(lote[j].label + ': ' + erroDe(r));
        }
      }
    }
    const melhor = {}; ofertas.forEach(o => { const k = o.banco + '|' + o.tabela.toUpperCase(); if (!melhor[k] || o.valor > melhor[k].valor) melhor[k] = o; });
    p.ofertas = Object.values(melhor); p.passo = 'fim'; delete p.parcial;
    p.situacao = p.ofertas.length ? 'ofertas' : 'sem_ofertas'; p.mensagem = p.ofertas.length ? '' : ([...new Set(erros)].join(' · ').slice(0, 300) || 'Saldo encontrado, mas a V8 não simulou');
  }
  return p;
};

// ===================== FGTS Unno =====================
const unnoCall = (method, path, body, idem) => http(method, cfg.unno_base + '/api/v1/fgts/applications' + path, { headers: Object.assign({ Authorization: 'Bearer ' + tk.unno, 'Content-Type': 'application/json' }, idem ? { 'Idempotency-Key': idem } : {}), body, timeout: 30000 });
const unnofgts = async (p) => {
  if (!tk.unno || !cfg.unno_base) { p.situacao = 'erro'; p.mensagem = 'Sem acesso à Unno no momento (renovando). Consulte de novo em 1 minuto.'; p.passo = 'fim'; return p; }
  if (!p.passo) {
    const r = await unnoCall('POST', '', { customer: { cpf }, user_uuid: cfg.unno_user_uuid }, uuid());
    if (r.s >= 200 && r.s < 300 && r.b && r.b.application_id) { p.application_id = r.b.application_id; p.passo = 'status'; p.situacao = 'processando'; p.mensagem = 'A Unno está cotando nas bancarizadoras'; return p; }
    p.situacao = 'erro'; p.passo = 'fim'; p.mensagem = 'Unno: ' + erroDe(r); return p;
  }
  const rs = await unnoCall('GET', '/' + p.application_id + '/status');
  const st = String((rs.b && rs.b.status) || '');
  if (!st) { if (p.tentativas > 40) { p.situacao = 'erro'; p.passo = 'fim'; p.mensagem = 'Unno: ' + erroDe(rs); } return p; }
  p.status_unno = st;
  if (st === 'QUOTING') { p.situacao = 'processando'; p.mensagem = 'A Unno está cotando nas bancarizadoras'; if (p.tentativas > 60) { p.situacao = 'erro'; p.passo = 'fim'; p.mensagem = 'A Unno demorou demais para cotar.'; } return p; }
  if (st === 'AWAITING_AUTHORIZATION') { p.situacao = 'aguardando_autorizacao'; p.mensagem = 'O cliente precisa autorizar no app do FGTS'; return p; }
  const rd = await unnoCall('GET', '/' + p.application_id);
  const a = rd.b || {};
  const motivos = (a.quotes || []).map(q => [q.source, q.reason].filter(Boolean).join(': ')).filter(Boolean);
  p.ofertas = (a.offers || []).filter(o => num(o.net_amount) > 0 && (!o.status || o.status === 'AVAILABLE')).map(o => ({ tabela: o.table_name || '', tabela_id: o.table_id || '', banco: o.source || '', prazo: (o.installments || []).length, valor: num(o.net_amount), bruto: num(o.gross_amount || o.total_amount), taxa: num(o.monthly_interest_rate), expira: o.expires_at || '' }));
  if (st === 'OFFERS_AVAILABLE' && num(a.quotes_pending) > 0 && p.tentativas < 30) { p.situacao = 'simulando'; p.mensagem = 'Chegando mais ofertas da Unno'; return p; }
  p.passo = 'fim';
  if (p.ofertas.length) { p.situacao = 'ofertas'; p.mensagem = ''; return p; }
  const txt = motivos.join(' · ');
  p.situacao = st === 'EXPIRED' ? 'erro' : classificaFgts(txt) === 'erro' ? 'sem_ofertas' : classificaFgts(txt);
  p.mensagem = st === 'EXPIRED' ? 'As ofertas da Unno expiraram. Consulte de novo.' : (txt.slice(0, 300) || 'A Unno não liberou oferta');
  return p;
};

// ===================== roda tudo em paralelo =====================
const PARTES = { v8_clt: v8clt, unno_clt: unnoclt, hub_clt: hubclt, v8_fgts: v8fgts, unno_fgts: unnofgts, hub_fgts: hubfgts };
await garantirCliente();
const alteradas = {};
await Promise.all(Object.entries(PARTES).map(async ([nome, fn]) => {
  const p = partes[nome] || { situacao: 'iniciando', tentativas: 0, ofertas: [] };
  if (TERMINAL.includes(p.situacao)) return;
  p.tentativas = (p.tentativas || 0) + 1;
  const antes = JSON.stringify(p);
  try { await fn(p); } catch (e) {
    if (e && e.tempo) { Object.assign(p, JSON.parse(antes)); p.situacao = TERMINAL.includes(p.situacao) || p.situacao === 'iniciando' ? 'processando' : p.situacao; p.mensagem = 'Ainda consultando'; }
    else { p.situacao = 'erro'; p.passo = 'fim'; p.mensagem = 'Falha interna: ' + String(e.message || e).slice(0, 200); }
  }
  p.ofertas = p.ofertas || []; p.atualizado_em = agora();
  alteradas[nome] = p;
}));
return [{ json: { id: ctx.id, partes: alteradas, cliente } }];
