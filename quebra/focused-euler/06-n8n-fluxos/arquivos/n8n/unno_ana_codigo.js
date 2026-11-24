const P = $('Preparar').first().json.r;
const tk = $('Token').first().json.access_token;
const base = P.base + '/api/v1/clt/applications';
const app = P.application_id;
const sleep = ms => new Promise(r => setTimeout(r, ms));
if (!tk) return [{ json: { erro: 'sem token da Unno' } }];

const call = async (method, url, body, idem) => {
  try {
    const o = { method, url, headers: Object.assign({ Authorization: 'Bearer ' + tk }, idem ? { 'Idempotency-Key': idem } : {}), json: true, returnFullResponse: true, ignoreHttpStatusErrors: true };
    if (body) o.body = body;
    const r = await this.helpers.httpRequest(o);
    return { code: Number(r.statusCode), body: r.body || {} };
  } catch (e) {
    return { code: 0, body: { error: { code: 'REDE', message: String(e.message || e).slice(0, 200) } } };
  }
};
const falha = r => {
  const b = r.body || {}, e = b.error || b;
  return { code: String(e.code || r.code || 'erro'), message: String(e.message || b.message || '').slice(0, 300), details: Array.isArray(e.details) ? e.details : (Array.isArray(b.details) ? b.details : []) };
};
const txtErro = f => f.code + (f.message ? ' · ' + f.message : '');
const num2 = v => Math.floor(Number(v) * 100) / 100;

const margemEVinculo = async () => {
  const m = await call('GET', base + '/' + app + '/margin');
  if (m.code >= 400) return { erro: falha(m) };
  const emps = ((m.body.employments) || []).filter(e => Number(e.available_margin) > 0 && (!e.eligibility || e.eligibility === 'ELIGIBLE')).sort((a, b) => Number(b.available_margin) - Number(a.available_margin));
  if (!emps.length) return { semMargem: true };
  return { emp: emps[0], margem: Number(emps[0].available_margin) };
};
const simular = async (emp, parcela) => {
  const par = num2(Math.min(parcela, Number(emp.available_margin)));
  const r = await call('POST', base + '/' + app + '/simulations', { employment_id: emp.employment_id, basis: 'INSTALLMENT', installment_amount: par }, 'ana-sim-' + app + '-' + par + '-' + Date.now());
  return r.code >= 400 ? { erro: falha(r) } : { par };
};
const padrao = margem => margem >= 300 ? 300 : num2(margem);

if (P.etapa === 'abrir') {
  const r = await call('POST', base, P.body, P.idem);
  if (r.code >= 400) return [{ json: { erro: txtErro(falha(r)) } }];
  let raw = r.body;
  const id = raw.application_id || raw.id;
  const au = (raw.authorization && raw.authorization.status) || '';
  if (id && au !== 'AUTHORIZED' && !(raw.authorization && raw.authorization.consent_url)) {
    const l = await call('POST', base + '/' + id + '/authorization', null, 'ana-link-' + Date.now());
    if (l.code < 400) raw = Object.assign({}, raw, { authorization: Object.assign({}, raw.authorization || {}, l.body.authorization || l.body) });
  }
  return [{ json: { raw, cpf: P.cpf, email: P.email } }];
}

if (P.etapa === 'status') {
  const s = await call('GET', base + '/' + app + '/status');
  if (s.code >= 400) return [{ json: { erro: txtErro(falha(s)) } }];
  const st = s.body.status, au = s.body.authorization_status;
  const out = { status: s.body };
  if (au === 'AUTHORIZED' && st === 'AWAITING_SIMULATION' && !(Number(s.body.offers_count) > 0)) {
    const mv = await margemEVinculo();
    if (mv.erro) return [{ json: { erro: txtErro(mv.erro) } }];
    if (mv.semMargem) out.sem_margem = true;
    else {
      const sm = await simular(mv.emp, padrao(mv.margem));
      if (sm.erro) return [{ json: { erro: txtErro(sm.erro) } }];
      out.simulou = true; out.margem = mv.margem;
    }
  }
  return [{ json: out }];
}

if (P.etapa === 'ofertas') {
  let s = await call('GET', base + '/' + app + '/status');
  if (s.code >= 400) return [{ json: { erro: txtErro(falha(s)) } }];
  let st = s.body.status;
  const autorizado = s.body.authorization_status === 'AUTHORIZED' || ['AWAITING_SIMULATION', 'QUOTING', 'OFFERS_AVAILABLE', 'NO_OFFERS', 'CONTRACT_REJECTED'].includes(st);
  let margem = null;
  if (autorizado && ['AWAITING_SIMULATION', 'QUOTING', 'OFFERS_AVAILABLE', 'NO_OFFERS', 'CONTRACT_REJECTED'].includes(st)) {
    const semOfertas = !(Number(s.body.offers_count) > 0);
    const dt = await call('GET', base + '/' + app);
    const simPar = dt.code < 400 && dt.body.simulation ? Number(dt.body.simulation.installment_amount) : 0;
    const mv = await margemEVinculo();
    if (mv.erro) return [{ json: { erro: txtErro(mv.erro) } }];
    if (mv.semMargem) return [{ json: { status: Object.assign({}, s.body, { status: 'NO_MARGIN' }) } }];
    margem = mv.margem;
    let alvo = null;
    if (P.mais_dinheiro) alvo = mv.margem;
    else if (P.parcela) alvo = Math.min(Number(P.parcela), mv.margem);
    else if (semOfertas && st === 'AWAITING_SIMULATION') alvo = padrao(mv.margem);
    if (alvo !== null && (st === 'AWAITING_SIMULATION' || Math.abs(simPar - num2(alvo)) > 0.01 || semOfertas)) {
      const sm = await simular(mv.emp, alvo);
      if (sm.erro) return [{ json: { erro: txtErro(sm.erro) } }];
      await sleep(2500);
      for (let i = 0; i < 14; i++) {
        s = await call('GET', base + '/' + app + '/status');
        st = s.body.status;
        if (st === 'NO_OFFERS' || (st === 'OFFERS_AVAILABLE' && Number(s.body.quotes_pending || 0) === 0 && Number(s.body.offers_count) > 0)) break;
        await sleep(3000);
      }
    }
  }
  const dt = await call('GET', base + '/' + app);
  if (dt.code >= 400) return [{ json: { erro: txtErro(falha(dt)) } }];
  return [{ json: { status: s.body, offers: Array.isArray(dt.body.offers) ? dt.body.offers : [], simulacao: dt.body.simulation || null, margem, mais_dinheiro: !!P.mais_dinheiro } }];
}

if (P.etapa === 'aceitar') {
  const draft = await call('GET', base + '/' + app + '/kyc');
  const juntar = (a, b) => {
    const o = Object.assign({}, a);
    for (const k of Object.keys(b || {})) {
      const v = b[k];
      if (v === null || v === undefined || v === '') continue;
      o[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? juntar(o[k] && typeof o[k] === 'object' ? o[k] : {}, v) : v;
    }
    return o;
  };
  const kyc = juntar(draft.code < 400 ? draft.body : {}, P.kyc);
  if (draft.code < 400 && draft.body.name_from_dataprev && draft.body.name) kyc.name = draft.body.name;
  const k = await call('POST', base + '/' + app + '/kyc', kyc);
  if (k.code >= 400) return [{ json: { kyc_erro: falha(k) } }];
  const ac = await call('POST', base + '/' + app + '/offers/' + encodeURIComponent(P.offer_id) + '/accept', null, 'ana-acc-' + P.offer_id);
  if (ac.code >= 400) return [{ json: { aceite_erro: falha(ac) } }];
  const proposal = ac.body.proposal_uuid || '';
  const achar = (o, d) => {
    if (!o || typeof o !== 'object' || d > 4) return '';
    for (const k2 of Object.keys(o)) {
      const v = o[k2];
      if (typeof v === 'string' && /^https?:\/\//.test(v) && /(sign|assin|formal|link|url)/i.test(k2) && !/consent/i.test(k2)) return v;
      if (v && typeof v === 'object') { const r = achar(v, d + 1); if (r) return r; }
    }
    return '';
  };
  await sleep(2000);
  let link = '';
  const dt = await call('GET', base + '/' + app);
  if (dt.code < 400) link = achar(dt.body, 0);
  if (!link && proposal) {
    const pp = await call('GET', P.base + '/api/v1/proposals/' + encodeURIComponent(proposal));
    if (pp.code < 400) link = achar(pp.body, 0);
  }
  return [{ json: { proposal_uuid: proposal, status: ac.body.status || (dt.code < 400 ? dt.body.status : ''), link } }];
}

return [{ json: { erro: 'etapa desconhecida' } }];
