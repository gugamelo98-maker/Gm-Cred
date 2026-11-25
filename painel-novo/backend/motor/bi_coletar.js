// BI: coleta as propostas do mês em V8 (CLT e FGTS), Unno (CLT e FGTS) e HUB (CLT e FGTS) e guarda cru em credito.bi_bancos_raw.
const H = this.helpers;
const t = $('Acessos').first().json.t;
const agora = new Date();
const ini = new Date(agora.getFullYear(), agora.getMonth() - (agora.getDate() < 6 ? 1 : 0), 1);
const iniISO = ini.toISOString(), fimISO = agora.toISOString(), iniDia = iniISO.slice(0, 10), fimDia = fimISO.slice(0, 10);
const resumo = {}, itens = [];
const get = async (url, headers) => {
  try { const r = await H.httpRequest({ method: 'GET', url, headers, json: true, timeout: 25000, returnFullResponse: true, ignoreHttpStatusErrors: true }); return { s: r.statusCode, b: r.body }; }
  catch (e) { return { s: 0, b: String(e.message || e).slice(0, 200) }; }
};
const lista = (b) => Array.isArray(b) ? b : (b && (b.data || b.items || b.content || b.itens || b.results || (b.value && (Array.isArray(b.value) ? b.value : b.value.itens || b.value.items)))) || [];
const guarda = (fonte, r) => {
  const L = lista(r.b);
  resumo[fonte] = { http: r.s, qtd: L.length, chaves: L[0] ? Object.keys(L[0]).slice(0, 40) : [], erro: L.length ? undefined : (typeof r.b === 'string' ? r.b : JSON.stringify(r.b || {}).slice(0, 300)) };
  L.forEach(x => itens.push({ fonte, id: String(x.id || x.uuid || x.proposal_uuid || x.operationId || x.idProposta || x.numeroProposta || x.proposalId || JSON.stringify(x).length + '-' + (x.cpf || '')), item: x }));
  return L.length;
};
const pagina = async (fonte, mk, max = 10) => { for (let p = 1; p <= max; p++) { const n = guarda(fonte + (p > 1 ? '' : ''), await mk(p)); if (n < 50) break; } };

const V8C = 'https://v2-bff-prod-front.yellowisland-b252a8a0.eastus.azurecontainerapps.io/private-consignment';
const hv8 = { Authorization: 'Bearer ' + t.v8_clt, Origin: 'https://new.v8sistema.com' };
await pagina('v8_clt', p => get(`${V8C}/operation?startDate=${encodeURIComponent(iniISO)}&endDate=${encodeURIComponent(fimISO)}&limit=50&page=${p}`, hv8));
await pagina('v8_fgts', p => get(`https://bff.v8sistema.com/fgts/proposal?startDate=${encodeURIComponent(iniISO)}&endDate=${encodeURIComponent(fimISO)}&limit=50&page=${p}`, { Authorization: 'Bearer ' + t.v8_fgts }));
const hu = { Authorization: 'Bearer ' + t.unno };
await pagina('unno', p => get(`${t.unno_base}/api/v1/proposals?page=${p - 1}&size=50&created_from=${iniDia}&created_to=${fimDia}`, hu));
const hh = { Authorization: 'Bearer ' + t.hub };
for (const [fonte, tipo] of [['hub_fgts', 2], ['hub_clt', 27]])
  await pagina(fonte, p => get(`https://api.hubcredito.com.br/api/Proposta/painelV4?tiposOperacao=${tipo}&lojasId=${t.hub_loja}&numeroPagina=${p}&tamanhoPagina=50&dataInicial=${iniDia}&dataFinal=${fimDia}`, hh));
return [{ json: { p: { resumo, itens } } }];
