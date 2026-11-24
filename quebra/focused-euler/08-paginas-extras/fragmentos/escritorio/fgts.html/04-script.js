<script>
const API = 'https://rarelookingorca-n8n.cloudfy.live/webhook/escritorio/lotus';
const FILA = 'https://rarelookingorca-n8n.cloudfy.live/webhook/escritorio/lotus-fila';
let chave = ''; try { chave = localStorage.getItem('escritorio_token') || ''; } catch (e) {}
const $ = id => document.getElementById(id);
if (!chave) { $('semLogin').hidden = false; $('form').hidden = true; $('tokcard').hidden = true; }
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const brl = v => v == null ? '—' : 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCpf = c => String(c || '').replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
const fmtTel = t => { t = String(t || '').replace(/\D/g, ''); if (t.startsWith('55') && t.length > 11) t = t.slice(2); return t.length === 11 ? '(' + t.slice(0, 2) + ') ' + t.slice(2, 7) + '-' + t.slice(7) : (t.length === 10 ? '(' + t.slice(0, 2) + ') ' + t.slice(2, 6) + '-' + t.slice(6) : t); };
const n = v => Number(v || 0).toLocaleString('pt-BR');
let lote = null, timer = null, saldos = [];

function lerCpfs() {
  return [...new Set($('cpfs').value.split(/[\s,;]+/).map(x => x.replace(/\D/g, '')).filter(x => x.length >= 9 && x.length <= 11).map(x => x.padStart(11, '0')))];
}
function contar() {
  const q = lerCpfs().length;
  $('qtd').textContent = q ? n(q) + ' CPF' + (q > 1 ? 's' : '') + ' para simular' : 'Nenhum CPF detectado';
}

async function post(url, dados) {
  const r = await fetch(url, { method: 'POST', body: new URLSearchParams(Object.assign({ k: chave }, dados)) });
  if (r.status === 401) throw new Error('login do painel vencido: entre no painel de novo');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
const fila = (acao, dados) => post(FILA, { acao, dados: JSON.stringify(dados || {}) });

async function salvarToken() {
  const t = $('tok').value.trim();
  if (t.length < 20) { $('tokMsg').textContent = 'Cole o token completo.'; return; }
  $('btTok').disabled = true; $('tokMsg').textContent = 'Salvando…';
  try {
    const r = await post(API, { acao: 'salvar_token', token: t });
    if (r.ok) {
      $('tok').value = ''; $('tok').placeholder = 'Token salvo em ' + (r.salvo_em || 'agora') + '. Cole um novo só quando vencer.'; $('tokMsg').textContent = '✓ Token salvo.';
      if (lote) { const s = await fila('status', { lote }); if (s.estado === 'pausado') await controle('retomar'); }
    } else $('tokMsg').textContent = '⚠️ ' + (r.erro || 'não consegui salvar');
  } catch (e) { $('tokMsg').textContent = '⚠️ ' + e.message; }
  finally { $('btTok').disabled = false; }
}

async function criar() {
  const cpfs = lerCpfs();
  if (!cpfs.length) { $('msg').textContent = 'Cole pelo menos um CPF (9 a 11 números).'; return; }
  $('btIr').disabled = true; $('msg').textContent = 'Mandando para a fila…';
  try {
    const d = await fila('criar', { cpfs, periodos: $('periodos').value, seguro: $('seguro').value === 'true', provider: $('provider').value });
    if (!d.ok) throw new Error(d.erro || 'não consegui criar a fila');
    lote = d.lote;
    $('msg').textContent = '📥 ' + n(d.total) + ' CPFs na fila' + (d.pulados ? ' · ' + n(d.pulados) + ' pulados (já simulados nos últimos 15 dias)' : '') + '.';
    $('cpfs').value = ''; contar();
    acompanhar();
  } catch (e) { $('msg').textContent = '⚠️ ' + e.message; }
  finally { $('btIr').disabled = false; }
}

function acompanhar() { clearTimeout(timer); atualizar(); }
async function atualizar() {
  try {
    const s = await fila('status', lote ? { lote } : {});
    mostrar(s);
    if (s.estado === 'rodando' || s.estado === 'pausado' || (s.hub_na_fila || 0) > 0) timer = setTimeout(atualizar, 8000);
  } catch (e) { $('estado').textContent = '⚠️ ' + e.message; timer = setTimeout(atualizar, 15000); }
}

function mostrar(s) {
  if (!s || !s.lote) return;
  lote = s.lote;
  $('andamento').hidden = false; $('resCard').hidden = false;
  const tot = s.total || 0, conc = s.concluidos || 0;
  $('barra').style.width = (tot ? Math.round(conc / tot * 100) : 100) + '%';
  const nomes = { rodando: 'Rodando', pausado: 'Pausado', encerrado: 'Encerrado', concluido: 'Concluído' };
  $('titLote').textContent = 'Lote #' + s.lote + ' · ' + s.criado_em + ' · ' + (nomes[s.estado] || s.estado);
  let txt = n(conc) + ' de ' + n(tot) + ' CPFs';
  if (s.estado === 'rodando') txt += ' · faltam ' + n(s.na_fila) + ' na fila, ' + n(s.processando) + ' sendo simulados · pode fechar a página';
  if (s.estado === 'pausado') txt += ' · pausado' + (s.na_fila ? ', faltam ' + n(s.na_fila) : '') + '. Se a Lotus recusou o token, cole um novo acima: o lote retoma sozinho.';
  if (s.pulados) txt += ' · ' + n(s.pulados) + ' pulados';
  $('estado').textContent = txt;
  $('nConc').textContent = n(conc); $('nSaldo').textContent = n(s.com_saldo); $('nTel').textContent = n(s.com_telefone);
  $('nSem').textContent = n(s.sem_saldo); $('nErro').textContent = n(s.erros);
  $('nHubFeitos').textContent = n(s.hub_feitos); $('nHubSaldo').textContent = n(s.hub_com_saldo); $('nHubFila').textContent = n(s.hub_na_fila); $('nTelTot').textContent = n(s.com_telefone_total);
  $('hubEstado').textContent = (s.hub_token_ok ? '✓ Login da HUB automático, funcionando.' : '⏳ Entrando na HUB (o login é automático, renova a cada 6 horas).') + ' Vão para a HUB: os com saldo na Lotus (BMP e, se não tiver, J17) e os que não autorizaram na Lotus (J17).';
  const ativo = s.estado === 'rodando' || s.estado === 'pausado';
  $('btPausar').hidden = s.estado !== 'rodando'; $('btRetomar').hidden = s.estado !== 'pausado'; $('btEncerrar').hidden = !ativo;
  saldos = s.saldos || [];
  $('res').innerHTML = saldos.length ? saldos.map(x => '<tr><td>' + esc(fmtCpf(x.cpf)) + '</td><td><b>' + esc(brl(x.liberado)) + '</b></td><td><b>' + esc(x.hub_liberado == null ? '—' : brl(x.hub_liberado) + (x.hub_banco ? ' · ' + x.hub_banco : '')) + '</b>' + (x.hub_tabela ? '<br><span class="msg">Tabela ' + esc(x.hub_tabela) + '</span>' : '') + '</td><td>' + esc(x.nome || '—') + '</td><td>' + esc(x.telefone ? fmtTel(x.telefone) : '—') + '</td></tr>').join('')
    : '<tr><td colspan="5" class="vazio">Ainda nenhum com saldo.</td></tr>';
  $('limite').textContent = Math.max(s.com_saldo || 0, s.hub_com_saldo || 0) > saldos.length ? 'Mostrando os ' + saldos.length + ' maiores. A planilha completa tem todos.' : '';
}

async function controle(acao) {
  if (!lote) return;
  if (acao === 'encerrar' && !confirm('Encerrar este lote? Os CPFs que ainda não foram enviados para a Lotus serão descartados.')) return;
  try { const s = await fila(acao, { lote }); mostrar(s); if (s.estado === 'rodando' || s.estado === 'pausado') acompanhar(); }
  catch (e) { $('estado').textContent = '⚠️ ' + e.message; }
}

const BASE_TEL = 'https://rarelookingorca-n8n.cloudfy.live/webhook/consulta-cpf';
let junta = [];
// todos os CPFs com saldo do lote (Lotus ou HUB), com o telefone achado na higienização
async function comSaldoDoLote() {
  const d = await fila('planilha', { lote });
  return (d.linhas || []).filter(x => x.situacao === 'com_saldo' || x.hub_situacao === 'com_saldo');
}
async function copiarCaixa(id) {
  const t = $(id).value;
  try { await navigator.clipboard.writeText(t); $('limite').textContent = 'Copiado.'; }
  catch (e) { $(id).select(); $('limite').textContent = 'Selecionei o texto: aperte Ctrl+C para copiar.'; }
}
async function copiarCpfs() {
  if (!lote) return;
  $('limite').textContent = 'Buscando os CPFs com saldo…';
  try {
    const cpfs = [...new Set((await comSaldoDoLote()).map(x => x.cpf))];
    if (!cpfs.length) { $('limite').textContent = 'Nenhum CPF com saldo ainda.'; return; }
    $('juntaCard').hidden = false; $('juntaMsg').textContent = n(cpfs.length) + ' CPFs com saldo.'; $('juntaTel').value = cpfs.join('\n');
    await copiarCaixa('juntaTel');
    $('limite').textContent = n(cpfs.length) + ' CPFs com saldo copiados.';
  } catch (e) { $('limite').textContent = '⚠️ ' + e.message; }
}
// telefone no mesmo formato para comparar: DDD + número, com o 9 no celular
function normTel(t) {
  t = String(t || '').replace(/\D/g, '');
  if (t.length > 11 && t.startsWith('55')) t = t.slice(2);
  if (t.length === 10 && /[6-9]/.test(t[2])) t = t.slice(0, 2) + '9' + t.slice(2);
  return (t.length === 10 || t.length === 11) ? t : '';
}
const telsDe = v => [...new Set(String(v || '').split(/[,;\/|\n]+/).map(normTel).filter(Boolean))];
async function juntarTelefones() {
  if (!lote) return;
  $('juntaCard').hidden = false; $('juntaTel').value = ''; $('juntaMsg').textContent = 'Buscando os CPFs com saldo…';
  try {
    const linhas = await comSaldoDoLote();
    if (!linhas.length) { $('juntaMsg').textContent = 'Nenhum CPF com saldo ainda.'; return; }
    const cpfs = [...new Set(linhas.map(x => x.cpf))], base = {};
    for (let i = 0; i < cpfs.length; i += 2000) {
      $('juntaMsg').textContent = 'Consultando a base de telefones: ' + n(Math.min(i + 2000, cpfs.length)) + ' de ' + n(cpfs.length) + '…';
      const r = await fetch(BASE_TEL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cpfs: cpfs.slice(i, i + 2000) }) });
      if (!r.ok) throw new Error('a base de telefones respondeu ' + r.status);
      const d = await r.json();
      if (d.erro) throw new Error(d.erro);
      (d.resultados || []).forEach(x => { if (x.encontrado) base[String(x.cpf).padStart(11, '0')] = x; });
    }
    let iguais = 0, diferentes = 0, soHig = 0, soBase = 0, sem = 0;
    junta = linhas.filter((x, i, a) => a.findIndex(y => y.cpf === x.cpf) === i).map(x => {
      const b = base[x.cpf] || {}, hig = telsDe(x.telefone), bas = telsDe(b.telefone);
      const todos = [...new Set(hig.concat(bas))];
      if (hig.length && bas.length) { if (todos.length === hig.length && todos.length === bas.length) iguais++; else diferentes++; }
      else if (hig.length) soHig++; else if (bas.length) soBase++; else sem++;
      return { cpf: x.cpf, nome: x.nome || b.nome || '', hig: hig.join(' '), base: bas.join(' '), tels: todos,
               lotus: x.liberado, hub: x.hub_liberado };
    });
    const tels = [...new Set(junta.flatMap(x => x.tels))];
    $('juntaTel').value = tels.join('\n');
    $('juntaMsg').textContent = n(junta.length) + ' CPFs com saldo → ' + n(tels.length) + ' telefones para rodar. '
      + 'Mesmo número nos dois: ' + n(iguais) + ' (ficou um só) · números diferentes: ' + n(diferentes) + ' (foram os dois) · só na higienização: ' + n(soHig)
      + ' · só na base: ' + n(soBase) + ' · sem telefone: ' + n(sem) + '.';
  } catch (e) {
    $('juntaMsg').textContent = '⚠️ ' + (e instanceof TypeError ? 'não consegui falar com a base de telefones' : e.message);
  }
}
function baixarJunta() {
  if (!junta.length) return;
  const q = v => { v = String(v ?? ''); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const v = x => x == null ? '' : Number(x).toFixed(2).replace('.', ',');
  const linhas = [['CPF', 'Nome', 'Valor Lotus', 'Valor HUB', 'Telefone higienização', 'Telefone base', 'Telefones para rodar']]
    .concat(junta.map(x => [fmtCpf(x.cpf), x.nome, v(x.lotus), v(x.hub), x.hig, x.base, x.tels.join(' ')]));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + linhas.map(r => r.map(q).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = 'fgts-telefones-lote-' + lote + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function copiarTel() {
  const tels = saldos.map(x => String(x.telefone || '').replace(/\D/g, '')).filter(Boolean);
  if (!tels.length) { $('limite').textContent = 'Nenhum telefone para copiar ainda.'; return; }
  try { await navigator.clipboard.writeText(tels.join('\n')); $('limite').textContent = n(tels.length) + ' telefones copiados.'; } catch (e) { $('limite').textContent = 'Não consegui copiar.'; }
}

async function baixar() {
  if (!lote) return;
  $('limite').textContent = 'Preparando planilha…';
  try {
    const d = await fila('planilha', { lote });
    const sit = { com_saldo: 'Com saldo', sem_saldo: 'Sem saldo', erro: 'Erro', cancelado: 'Cancelado', na_fila: 'Na fila', enviando: 'Enviando', enviado: 'Simulando', conferindo: 'Simulando' };
    const q = v => { v = String(v ?? ''); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const hs = { com_saldo: 'Com saldo', sem_saldo: 'Sem saldo', j17_pendente: 'Esperando J17', enviando: 'Consultando' };
    const v = x => x == null ? '' : Number(x).toFixed(2).replace('.', ',');
    const linhas = [['CPF', 'Situação Lotus', 'Valor Lotus', 'Mensagem Lotus', 'HUB', 'Valor HUB', 'Banco HUB', 'Tabela HUB', 'Mensagem HUB', 'Nome', 'Telefone', 'E-mail']].concat((d.linhas || []).map(x => [fmtCpf(x.cpf), sit[x.situacao] || x.situacao, v(x.liberado), x.mensagem || '', hs[x.hub_situacao] || x.hub_situacao || '', v(x.hub_liberado), x.hub_situacao === 'com_saldo' ? (x.hub_banco || '') : '', x.hub_tabela || '', x.hub_mensagem || '', x.nome || '', x.telefone || '', x.email || '']));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + linhas.map(r => r.map(q).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = 'fgts-lotus-lote-' + lote + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    $('limite').textContent = 'Planilha baixada (' + n((d.linhas || []).length) + ' linhas).';
  } catch (e) { $('limite').textContent = '⚠️ ' + e.message; }
}

// ao abrir, mostra o último lote
if (chave) fila('status', {}).then(s => { if (s && s.lote) { mostrar(s); if (s.estado === 'rodando' || s.estado === 'pausado') acompanhar(); } }).catch(() => {});
</script>
