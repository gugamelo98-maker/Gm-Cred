// Digitação de contrato pelo Motor (separado da Ana). enviar=false só monta e mostra o que vai para o banco.
const H = this.helpers;
const c = $('Contexto').first().json.c;
const w = $('Digitação recebe').first().json.body || {};
const F = c.ficticio || {}, cli = c.cliente || {}, tk = c.tokens || {}, cfg = c.cfg || {};
const parte = String(w.parte || ''), o = w.oferta || {}, d = w.dados || {}, enviar = w.enviar === true;
const cpf = c.cpf;
const num = (v) => Number(v) || 0;
const so = (v) => String(v == null ? '' : v).replace(/\D/g, '');
const val = (k) => (d[k] != null && String(d[k]).trim() !== '') ? String(d[k]).trim() : (F[k] == null ? '' : String(F[k]));
const curto = (x) => { const t = typeof x === 'string' ? x : JSON.stringify(x); return t && t.length > 4000 ? t.slice(0, 4000) + '…' : t; };
const http = async (method, url, headers, body) => {
  try {
    const q = { method, url, headers: Object.assign({ 'Content-Type': 'application/json' }, headers), json: true, timeout: 40000, returnFullResponse: true, ignoreHttpStatusErrors: true };
    if (body !== undefined) q.body = body;
    const r = await H.httpRequest(q);
    let b = r.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { /* texto */ } }
    return { s: Number(r.statusCode) || 0, b };
  } catch (e) { return { s: 0, b: String(e.message || e).slice(0, 300) }; }
};
const erroDe = (r) => {
  const b = (r && r.b) || {};
  if (typeof b === 'string') return b.slice(0, 400);
  const e = b.error || {};
  const det = Array.isArray(e.details || b.details) ? (e.details || b.details).map(x => [x.field, x.code, x.message].filter(Boolean).join(' ')).join(' · ') : '';
  const errs = Array.isArray(b.errors) ? b.errors.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' · ') : (b.errors && typeof b.errors === 'object' ? JSON.stringify(b.errors) : '');
  return String([e.code, e.message || b.message || b.title || b.detail, det, errs].filter(Boolean).join(' · ') || ('HTTP ' + r.s)).slice(0, 600);
};
// procura um link de assinatura/formalização em qualquer lugar da resposta
const achaLink = (x, dd) => {
  if (!x || typeof x !== 'object' || (dd || 0) > 5) return '';
  for (const k of Object.keys(x)) {
    const v = x[k];
    if (typeof v === 'string' && /^https?:\/\//.test(v) && /(sign|assin|formal|link|url)/i.test(k) && !/consent/i.test(k)) return v;
    if (v && typeof v === 'object') { const a = achaLink(v, (dd || 0) + 1); if (a) return a; }
  }
  return '';
};

// ---------- dados do cliente (reais + fictícios) ----------
let fone = so(cli.telefone); if (fone.length > 11 && fone.startsWith('55')) fone = fone.slice(2);
const ddd = fone.slice(0, 2), numFone = fone.slice(2);
const nome = String(d.nome || cli.nome || '').trim();
const nasc = String(d.nascimento || cli.nascimento || '').slice(0, 10);
const email = String(d.email || cli.email || '').trim().toLowerCase() || 'cliente@gmail.com';
const mulher = (d.sexo || cli.sexo) === 'F';
const mae = String(d.mae || '').trim().toUpperCase();
const pixTipo = String(d.pix_tipo || 'cpf').toLowerCase();
const pixChave = String(d.pix_chave || '').trim();
const end = { cep: so(val('cep')), cidade: val('cidade'), uf: val('uf'), bairro: val('bairro'), logradouro: val('logradouro'), numero: val('numero'), complemento: val('complemento') };
const rhTel = ddd + val('rh_telefone_fim');
const falta = [];
if (!nome) falta.push('nome'); if (!/^\d{4}-\d{2}-\d{2}$/.test(nasc)) falta.push('nascimento'); if (fone.length < 10) falta.push('celular');
// HUB e Unno FGTS só pagam em conta bancária
const porConta = parte === 'hub_fgts' || parte === 'unno_fgts';
const conta = { banco: so(d.banco), agencia: so(d.agencia), agencia_dig: String(d.agencia_digito || '').trim(), numero: so(d.conta), digito: String(d.conta_digito || '').trim(), poupanca: d.conta_tipo === 'poupanca' };
if (!mae) falta.push('nome da mãe');
if (porConta) { if (!conta.banco || !conta.agencia || !conta.numero || !conta.digito) falta.push('conta bancária (banco, agência, conta e dígito)'); }
else if (!pixChave) falta.push('chave PIX');

const resposta = (x) => [{ json: Object.assign({ id: c.id, parte, enviado: false, faltando: falta }, x) }];
if (!parte || !Object.keys(o).length) return resposta({ ok: false, erro: 'Escolha uma oferta para digitar' });

// ===================== V8 CLT =====================
const V8C = 'https://ca-bff-rebranding-prod.yellowisland-b252a8a0.eastus.azurecontainerapps.io/private-consignment';
if (parte === 'v8_clt') {
  const PIX_V8 = { cpf: 'cpf', phone: 'phone', email: 'email', random: 'random' };
  const payload = { simulation_id: o.sim_id, provider: 'QI', borrower: {
    name: nome.toUpperCase(), email, phone: { country_code: '55', area_code: ddd, number: numFone }, political_exposition: false,
    address: { city: end.cidade, state: end.uf, number: end.numero, street: end.logradouro, complement: end.complemento, postal_code: end.cep, neighborhood: end.bairro },
    birth_date: nasc, mother_name: mae, nationality: 'brasileira', document_issuer: val('rg_orgao'), gender: mulher ? 'female' : 'male', person_type: 'natural',
    marital_status: 'single', individual_document_number: cpf, document_identification_date: val('rg_emissao'), document_identification_type: 'rg',
    document_identification_number: val('rg'), bank: { transfer_method: 'pix', pix_key: pixChave, pix_key_type: PIX_V8[pixTipo] || pixTipo } } };
  if (!o.sim_id) return resposta({ ok: false, erro: 'Essa oferta da V8 não tem o número da simulação. Consulte de novo.' , payload });
  if (!enviar) return resposta({ ok: true, previa: true, banco: 'V8', payload });
  if (falta.length) return resposta({ ok: false, erro: 'Falta: ' + falta.join(', '), payload });
  if (!tk.v8_clt) return resposta({ ok: false, erro: 'Sem acesso à V8 agora (renovando). Tente em 1 minuto.' });
  const r = await http('POST', V8C + '/operation', { Authorization: 'Bearer ' + tk.v8_clt, Origin: 'https://new.v8sistema.com' }, payload);
  const ok = r.s < 400 && r.b && r.b.id;
  return resposta({ ok: !!ok, enviado: true, banco: 'V8', proposta: ok ? r.b.id : '', link: ok ? (r.b.formalization_url || achaLink(r.b)) : '', erro: ok ? '' : 'V8: ' + erroDe(r), resposta_banco: curto(r.b), payload });
}

// ===================== Unno (CLT e FGTS): KYC + aceite =====================
if (parte === 'unno_clt' || parte === 'unno_fgts') {
  const prod = parte === 'unno_clt' ? 'clt' : 'fgts';
  const app = ((c.partes || {})[parte] || {}).application_id;
  if (!app) return resposta({ ok: false, erro: 'A consulta da Unno não tem solicitação aberta. Consulte de novo.' });
  if (!tk.unno) return resposta({ ok: false, erro: 'Sem acesso à Unno agora (renovando). Tente em 1 minuto.' });
  const base = cfg.unno_base + '/api/v1/' + prod + '/applications/' + app;
  const HU = { Authorization: 'Bearer ' + tk.unno };
  const PIX_U = { cpf: 'CPF', phone: 'PHONE', email: 'EMAIL', random: 'RANDOM' };
  const rascunho = await http('GET', base + '/kyc', HU);
  const draft = (rascunho.s < 400 && rascunho.b && typeof rascunho.b === 'object') ? rascunho.b : {};
  const nosso = { name: nome, birth_date: nasc, phone: fone, email, rg_number: val('rg'), rg_organ: val('rg_orgao'), rg_uf: val('rg_uf'), rg_issue_date: val('rg_emissao'),
    civil_status: 'SINGLE', politically_exposed_person: false, nationality: 'BRASIL', mothers_name: mae, gender: mulher ? 'FEMALE' : 'MALE',
    address: { zip_code: end.cep, uf: end.uf, city: end.cidade, district: end.bairro, street: end.logradouro, number: end.numero, complement: end.complemento },
    bank: porConta
      ? { disbursement_method: 'BANK_ACCOUNT', bank_code: conta.banco, agency: conta.agencia, agency_digit: conta.agencia_dig || undefined, account_number: conta.numero, account_digit: conta.digito, account_type: conta.poupanca ? 'SAVINGS' : 'CHECKING' }
      : { disbursement_method: 'PIX', pix_key: pixChave, pix_type: PIX_U[pixTipo] || 'CPF' } };
  // empregador / RH: preenche só os campos que a Unno trouxer no rascunho
  if (draft.employer && typeof draft.employer === 'object') {
    nosso.employer = {};
    for (const k of Object.keys(draft.employer)) {
      if (draft.employer[k] != null && draft.employer[k] !== '') continue;
      if (/mail/i.test(k)) nosso.employer[k] = val('rh_email');
      else if (/phone|tel/i.test(k)) nosso.employer[k] = rhTel;
    }
  }
  const junta = (a, b) => { const r = Object.assign({}, a); for (const k of Object.keys(b || {})) { const v = b[k]; if (v == null || v === '') continue; r[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? junta(r[k] && typeof r[k] === 'object' ? r[k] : {}, v) : v; } return r; };
  // o que a Unno já tem (vindo da Dataprev etc.) vale mais que o fictício, menos mãe, PIX e e-mail digitados
  const kyc = junta(junta(nosso, draft), { mothers_name: mae, bank: nosso.bank, email: d.email ? email : undefined, address: draft.address && draft.address.zip_code ? undefined : nosso.address });
  if (draft.name_from_dataprev && draft.name) kyc.name = draft.name;
  const offerId = o.offer_id || '';
  if (!enviar) return resposta({ ok: true, previa: true, banco: 'Unno', rascunho_unno: curto(rascunho.s < 400 ? rascunho.b : erroDe(rascunho)), payload: kyc, offer_id: offerId });
  if (falta.length) return resposta({ ok: false, erro: 'Falta: ' + falta.join(', '), payload: kyc });
  if (!offerId) return resposta({ ok: false, erro: 'Essa oferta da Unno não tem o número da oferta. Consulte de novo.' });
  const k1 = await http('POST', base + '/kyc', HU, kyc);
  if (k1.s >= 400 || k1.s === 0) return resposta({ ok: false, enviado: true, banco: 'Unno', etapa: 'kyc', erro: 'Unno (cadastro): ' + erroDe(k1), resposta_banco: curto(k1.b), payload: kyc });
  const ac = await http('POST', base + '/offers/' + encodeURIComponent(offerId) + '/accept', Object.assign({ 'Idempotency-Key': 'motor-acc-' + offerId }, HU));
  if (ac.s >= 400 || ac.s === 0) return resposta({ ok: false, enviado: true, banco: 'Unno', etapa: 'aceite', erro: 'Unno (aceite): ' + erroDe(ac), resposta_banco: curto(ac.b), payload: kyc });
  let link = achaLink(ac.b);
  if (!link) { await new Promise(r => setTimeout(r, 4000)); const st = await http('GET', base, HU); link = achaLink(st.b); }
  return resposta({ ok: true, enviado: true, banco: 'Unno', proposta: (ac.b && ac.b.proposal_uuid) || '', link, resposta_banco: curto(ac.b) });
}

// ===================== HUB (CLT e FGTS) =====================
if (parte === 'hub_clt' || parte === 'hub_fgts') {
  const PIX_H = { cpf: 'NaturalRegistrationNumber', phone: 'Phone', email: 'Email', random: 'Automatic' };
  const clt = parte === 'hub_clt';
  const hoje30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const cliente = { documento: cpf, nome: nome.toUpperCase(),
    pessoaFisica: { dataNascimento: nasc, rg: val('rg'), orgaoEmissorRg: val('rg_orgao'), ufOrgaoEmissorRg: val('rg_uf'), dataEmissaoRg: val('rg_emissao'), mae, pai: val('pai'),
      sexo: mulher ? 2 : 1, estadoCivil: 'Solteiro', email, naturalidade: end.cidade, tipoResidencia: 'Proprio', tempoResidencia: 12, ocupacao: num(F.ocupacao) || 5,
      cargo: val('cargo'), empresa: val('empresa'), valorRenda: num(F.renda) || 3000, valorRendaExtra: 0, tempoServico: 12, falecido: false, quantidadeDependentes: 0 },
    enderecos: [{ logradouro: end.logradouro, numero: num(end.numero), complemento: end.complemento, bairro: end.bairro, cidade: end.cidade, uf: end.uf, cep: end.cep, tipoEndereco: 'Residencial' }],
    telefones: [{ ddd, numero: numFone, tipoTelefone: 'Pessoal', renderPhone: fone }], referencias: [] };
  const payload = clt ? {
    bancarizador: o.banco, tipoOperacao: 27, tipoCliente: 'Novo', formaPagamento: 'DescontoFolha', formaPagamentoCliente: 'Transferencia',
    lojaId: num(cfg.hub_loja) || 9562, cpfAtendente: val('hub_cpf_atendente'), cpfCliente: cpf, dataPrimeiraParcela: String(o.vencimento || '').slice(0, 10) || hoje30,
    valorBruto: num(o.valor), valorVista: num(o.valor), tabelaComercial: num(o.tabela_id), plano: num(o.prazo), valorParcela: num(o.parcela),
    SimulacaoId: String(o.sim_id || ''), valorTac: num(o.tac), chavePix: { tipoChave: PIX_H[pixTipo] || 'NaturalRegistrationNumber', valorChave: pixChave }, cliente }
  : {
    bancarizador: o.banco, tipoOperacao: 2, tipoCliente: 'Novo', formaPagamento: 'Boleto', formaPagamentoCliente: 'FGTS',
    lojaId: num(cfg.hub_loja) || 9562, cpfAtendente: val('hub_cpf_atendente'), cpfCliente: cpf, dataPrimeiraParcela: hoje30,
    valorBruto: num(o.bruto), valorVista: num(o.valor), tabelaComercial: num(o.tabela_cod), plano: num(o.prazo), valorParcela: o.prazo ? Math.round(num(o.valor) / num(o.prazo) * 100) / 100 : num(o.valor),
    SimulacaoId: String(o.sim_id || ''), percentualTac: 0, percentualComissao: 0, valorTac: num(o.tac), valorComissao: 0, valorProduto: 0,
    contaBancaria: { banco: num(conta.banco), agencia: num(conta.agencia), digitoAgencia: conta.agencia_dig || '0', conta: num(conta.numero), digitoConta: conta.digito, tipoContaBancaria: conta.poupanca ? 2 : 1 }, cliente };
  if (!o.sim_id) return resposta({ ok: false, erro: 'Essa oferta da HUB não tem o número da simulação. Consulte de novo.', payload });
  if (!enviar) return resposta({ ok: true, previa: true, banco: 'HUB', payload });
  if (falta.length) return resposta({ ok: false, erro: 'Falta: ' + falta.join(', '), payload });
  let r = await http('POST', 'https://api.hubcredito.com.br/api/proposta', { Authorization: 'Bearer ' + tk.hub }, payload);
  if (r.s === 401) {
    const nv = await http('POST', 'https://rarelookingorca-n8n.cloudfy.live/webhook/motor/renovar', {}, { k: w.k });
    if (nv.s === 200 && nv.b && nv.b.hub) { tk.hub = nv.b.hub; r = await http('POST', 'https://api.hubcredito.com.br/api/proposta', { Authorization: 'Bearer ' + tk.hub }, payload); }
  }
  const v = (r.b && r.b.value) || {};
  const ok = r.s < 400 && r.b && r.b.hasSuccess !== false && r.b.hasError !== true;
  return resposta({ ok: !!ok, enviado: true, banco: 'HUB', proposta: String(v.id || v.propostaId || v.numeroProposta || ''), link: achaLink(r.b), erro: ok ? '' : 'HUB: ' + erroDe(r), resposta_banco: curto(r.b), payload });
}

// ===================== V8 FGTS (mesmo formato do app da V8) =====================
if (parte === 'v8_fgts') {
  const payload = { simulationFeesId: o.fee_id || '', fgtsSimulationId: o.sim_id || '', provider: o.provider || '',
    name: nome.toUpperCase(), individualDocumentNumber: cpf, motherName: mae, nationality: 'Brasileiro(a)', isPEP: false, email, birthDate: nasc,
    personType: 'natural', phone: numFone, phoneCountryCode: '55', phoneRegionCode: ddd,
    postalCode: end.cep, state: end.uf, neighborhood: end.bairro, addressNumber: end.numero, city: end.cidade, street: end.logradouro,
    formalizationLink: '', maritalStatus: 'single', gender: mulher ? 'female' : 'male', payment: { type: 'pix', data: { pix: pixChave } } };
  if (!enviar) return resposta({ ok: true, previa: true, banco: 'V8', payload });
  if (falta.length) return resposta({ ok: false, erro: 'Falta: ' + falta.join(', '), payload });
  if (!tk.v8_fgts) return resposta({ ok: false, erro: 'Sem acesso à V8 agora (renovando). Tente em 1 minuto.' });
  // a oferta do Motor não guarda o id da simulação: refaz a simulação da tabela escolhida (igual ao app da V8)
  if (!payload.fgtsSimulationId) {
    const HV = { Authorization: 'Bearer ' + tk.v8_fgts, Origin: 'https://app.v8sistema.com' };
    const prov = ({ BMP: 'bms', GIRO: 'girotech' })[String(o.banco || '').toUpperCase()] || String(o.banco || '').toLowerCase();
    const sd = (((c.partes || {}).v8_fgts || {}).saldos || []).find(x => x.provider === prov);
    if (!sd || !sd.balanceId) return resposta({ ok: false, erro: 'Não achei o saldo FGTS da V8 dessa consulta. Consulte o CPF de novo e digite.', payload });
    const rf = await http('GET', 'https://bff.v8sistema.com/fgts/simulations/fees/new?provider=' + prov, HV);
    let fees = Array.isArray(rf.b) ? rf.b : ((rf.b && (rf.b.data || rf.b.items)) || []);
    fees = fees.map(f => ({ id: (f.simulation_fees && f.simulation_fees.id_simulation_fees) || f.id_simulation_fees || f.id, label: (f.simulation_fees && f.simulation_fees.label) || f.label || f.visible_name || f.name || '' }));
    const fee = fees.find(f => f.label.trim().toUpperCase() === String(o.tabela || '').trim().toUpperCase());
    if (!fee) return resposta({ ok: false, erro: 'A tabela ' + (o.tabela || '') + ' não está mais disponível na V8 (' + erroDe(rf) + ')', payload });
    const desired = (sd.periods || []).map(x => ({ totalAmount: num(x.amount || x.totalAmount), dueDate: x.dueDate || x.date })).filter(x => x.dueDate);
    let usado = prov;
    let rs = await http('POST', 'https://bff.v8sistema.com/fgts/simulations', HV, { balanceId: sd.balanceId, targetAmount: 0, documentNumber: cpf, desiredInstallments: desired, provider: prov, simulationFeesId: fee.id });
    if (!(rs.s < 300 && rs.b && rs.b.id)) { const r2 = await http('POST', 'https://bff.v8sistema.com/fgts/simulations', HV, { balanceId: sd.balanceId, targetAmount: 0, documentNumber: cpf, desiredInstallments: desired, provider: 'qi', simulationFeesId: fee.id }); if (r2.s < 300 && r2.b && r2.b.id) { rs = r2; usado = 'qi'; } }
    if (!(rs.s < 300 && rs.b && rs.b.id)) return resposta({ ok: false, enviado: true, banco: 'V8', etapa: 'simulação', erro: 'V8 (simulação): ' + erroDe(rs), resposta_banco: curto(rs.b), payload });
    payload.fgtsSimulationId = rs.b.id; payload.simulationFeesId = fee.id; payload.provider = usado;
  }
  const r = await http('POST', 'https://bff.v8sistema.com/fgts/proposal', { Authorization: 'Bearer ' + tk.v8_fgts, Origin: 'https://app.v8sistema.com' }, payload);
  const b = r.b || {};
  const ok = r.s < 400 && (b.id || b.proposalId || b.formalizationLink);
  return resposta({ ok: !!ok, enviado: true, banco: 'V8', proposta: ok ? (b.id || b.proposalId || '') : '', link: ok ? (b.formalizationLink || achaLink(b)) : '', erro: ok ? '' : 'V8: ' + erroDe(r), resposta_banco: curto(r.b), payload });
}

return resposta({ ok: false, erro: 'Banco desconhecido: ' + parte });
