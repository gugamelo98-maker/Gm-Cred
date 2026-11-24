<script>
const BASE = 'https://rarelookingorca-n8n.cloudfy.live/webhook';
const SETORES = {
  recepcao:{nome:'Recepção',cor:'#f26b4d'}, simulacao:{nome:'Simulação',cor:'#e0a100'}, vendas:{nome:'Vendas',cor:'#2f8fd8'},
  formalizacao:{nome:'Formalização',cor:'#16a36a'}, posvenda:{nome:'Pós-venda',cor:'#8a5cd6'}, gerente:{nome:'Recuperação',cor:'#6b7787'}
};
const STATUS = { respondeu:'conversando', cpf_ok:'CPF consultado', simulado:'ofertas prontas', negociando:'negociando', fechou:'oferta escolhida',
  link_env:'link enviado', assinou:'assinou', parou:'encerrado', disparado:'novo' };
const OPERACAO = { formalization:'aguardando assinatura', analysis:'em análise', manual_analysis:'em análise manual', awaiting_call:'aguardando ligação',
  processing:'em processamento', pending:'com pendência', paid:'pago', canceled:'cancelado', refunded:'estornado' };
const MODOS = { apresentar:'enviou as ofertas', recuperar:'mensagem de recuperação', aviso:'aviso automático' };
const ATALHOS = ['Oi', 'Quero um empréstimo', 'Meu CPF é 111.444.777-35', 'O que é crédito CLT?', 'Dá pra fazer em 24 meses?', 'Quero a opção 1',
  'Minha chave PIX é o e-mail teste@gmail.com', 'Já assinei', 'Você é robô?', 'Quero falar com um atendente'];

function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
function lsDel(k){try{localStorage.removeItem(k);}catch(e){}}
const $ = id => document.getElementById(id);

let token = lsGet('escritorio_token') || '';
let tel = lsGet('chat_teste_tel') || novoTel();
let hist = []; try { hist = JSON.parse(lsGet('chat_teste_hist_' + tel) || '[]'); } catch(e) { hist = []; }
let info = null; try { info = JSON.parse(lsGet('chat_teste_info_' + tel) || 'null'); } catch(e) {}
let ultimoId = hist.reduce((m, x) => Math.max(m, x.id || 0), 0);
let enviando = 0, timerPoll = null;   // nº de mensagens aguardando resposta (o cliente pode mandar várias seguidas)

function novoTel(){ const t = 'teste-' + Date.now().toString(36) + Math.random().toString(36).slice(2,5); lsSet('chat_teste_tel', t); return t; }
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function formatar(s){ return esc(s).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }
function hora(d){ return new Date(d).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }
function salvar(){ lsSet('chat_teste_hist_' + tel, JSON.stringify(hist.slice(-300))); lsSet('chat_teste_info_' + tel, JSON.stringify(info)); }
function estado(cls, txt){ const e = $('estado'); e.className = 'estado ' + cls; e.querySelector('span').textContent = txt; }

function bolha(m){
  const d = document.createElement('div');
  d.className = 'b ' + m.de;
  if (m.de === 'ag') {
    const s = SETORES[m.setor] || {nome:m.setor||'', cor:'#8a96a5'};
    d.style.setProperty('--cor', s.cor);
    d.innerHTML = '<span class="tag">' + esc(s.nome) + ' · ' + esc(m.agente || '') + ' ' + esc(m.versao || '') +
      (MODOS[m.modo] ? '<span class="auto">· ' + MODOS[m.modo] + '</span>' : '') + '</span><br>' + formatar(m.texto) + '<small>' + hora(m.em) + '</small>';
  } else if (m.de === 'cli') {
    d.innerHTML = esc(m.texto).replace(/\n/g, '<br>') + '<small>' + hora(m.em) + '</small>';
  } else d.textContent = m.texto;
  $('msgs').insertBefore(d, $('digitando'));
  $('msgs').scrollTop = $('msgs').scrollHeight;
  return d;
}
function render(){
  $('msgs').querySelectorAll('.b').forEach(e => e.remove());
  $('vazio').style.display = hist.length ? 'none' : '';
  hist.forEach(bolha);
  bastidores();
}
function addAgente(lista){
  let novos = 0;
  for (const m of (lista || [])) {
    if (m.id && m.id <= ultimoId) continue;
    hist.push({ id:m.id, de:'ag', texto:m.texto, agente:m.agente, versao:m.versao, setor:m.setor, modo:m.modo, em:m.em || Date.now() });
    ultimoId = Math.max(ultimoId, m.id || 0); novos++;
  }
  return novos;
}
function bastidores(){
  const el = $('bast');
  if (!info) { el.innerHTML = '<p class="nota">Quem está atendendo aparece aqui depois da primeira mensagem. O cliente sempre vê "Ana, da GM Cred". Os nomes internos (Ana, Bia, Caio…) servem só para o teste A/B/C.</p>'; atualizarBotoes(); return; }
  const s = SETORES[info.setor] || {nome: info.setor, cor: '#8a96a5'};
  const ag = info.agente || {};
  const passos = (info.jornada || []).map(p => { const ps = SETORES[p.setor] || {nome:p.setor, cor:'#8a96a5'};
    return '<div class="passo"><i style="background:' + ps.cor + '"></i><b>' + esc(ps.nome) + '</b><span>' + esc(p.agente) + ' · versão ' + esc(p.versao) + '</span></div>'; }).join('');
  el.innerHTML =
    '<span class="setor"><i style="background:' + s.cor + '"></i>' + esc(s.nome) + '</span><span class="status">' + esc(STATUS[info.status] || info.status || '') + (info.operacao ? ' · contrato ' + esc(OPERACAO[info.operacao] || info.operacao) : '') + '</span>' +
    (ag.nome ? '<div class="agente"><div class="av" style="background:' + s.cor + '">' + esc(ag.nome[0]) + '</div><div><b>' + esc(ag.nome) + '</b><span class="ver">Versão ' + esc(ag.versao) + '</span><p>' + esc(ag.abordagem || '') + '</p></div></div>' : '') +
    (passos ? '<div class="jornada" aria-label="Jornada do cliente">' + passos + '</div>' : '') +
    (info.operacao_real && !['canceled','refunded','paid'].includes(info.operacao) ? '<div class="aviso-h">⚠️ Esta proposta é <b>real</b> na V8 (com dados de teste). Use “Cancelar proposta na V8” quando terminar o teste. A situação é verificada na V8 a cada 1 minuto (os botões de simular mudam só aqui no sistema).</div>' : '') +
    (info.aguardando === 'humano' ? '<div class="aviso-h">🙋 Um atendente humano foi chamado. Os agentes não respondem até ele devolver a conversa no Escritório.</div>' : '');
  atualizarBotoes();
}
function atualizarBotoes(){
  const temProposta = info && (info.status === 'link_env' || info.operacao);
  const real = !!(info && info.operacao_real);
  const encerrada = info && ['canceled','refunded'].includes(info.operacao);
  $('bAssinou').disabled = encerrada || !(temProposta && (!info.operacao || info.operacao === 'formalization'));
  $('bPagou').disabled = encerrada || !(temProposta && info.operacao && info.operacao !== 'paid');
  $('bCancelar').hidden = !(real && !['canceled','refunded','paid'].includes(info.operacao));
}
async function cancelarProposta(){
  if (!token) { pedirLogin(); return; }
  if (!confirm('Cancelar de verdade esta proposta na V8?')) return;
  $('bCancelar').disabled = true;
  try {
    const r = await fetch(BASE + '/gmcred/chat/evento', { method:'POST', body:new URLSearchParams({k:token, telefone:tel, evento:'cancelar'}) });
    if (r.status === 401) { semSessao(); return; }
    const j = await r.json().catch(() => ({}));
    hist.push({de:'sis', texto: j.ok ? 'Proposta cancelada na V8.' : ('Não cancelou: ' + (j.texto || 'erro')), em:Date.now()}); bolha(hist[hist.length-1]); salvar();
    await buscarNovas();
  } catch (e) { alert('Não foi possível cancelar agora.'); }
  finally { $('bCancelar').disabled = false; }
}
function placar(lista){
  if (!lista || !lista.length) return;
  const porSetor = {};
  lista.forEach(a => (porSetor[a.setor] = porSetor[a.setor] || []).push(a));
  $('placar').innerHTML = Object.keys(SETORES).filter(k => porSetor[k]).map(k => {
    const s = SETORES[k], ags = porSetor[k];
    const topo = Math.max(...ags.map(a => a.taxa || 0));
    const melhor = ags.some(a => a.atendidos >= 3 && (a.taxa || 0) === topo) ? topo : -1;
    return '<div class="pl-setor"><b><i style="background:' + s.cor + '"></i>' + esc(s.nome) + '</b>' + ags.map(a =>
      '<div class="pl-linha' + (melhor > 0 && a.atendidos >= 3 && a.taxa === melhor ? ' lider' : '') + '" title="' + esc(a.abordagem || '') + '"><span class="nm"><em>' + esc(a.versao) + '</em> ' + esc(a.nome) + '</span>' +
      '<span class="barra"><span style="width:' + (a.taxa || 0) + '%;background:' + s.cor + '"></span></span>' +
      '<span class="n">' + (a.atendidos ? (a.taxa || 0) + '% <span style="color:var(--tx3)">(' + a.sucesso + '/' + a.atendidos + ')</span>' : '—') + '</span></div>').join('') + '</div>';
  }).join('') + '<p class="nota" style="margin-top:4px">Mesma conta da aba Agentes: % dos clientes que fizeram o passo do setor. Sem margem e clientes ainda em atendimento não contam. A ★ aparece a partir de 3 atendimentos.</p>';
}
function aplicarLead(j){
  if (!j) return;
  info = { lead_id: j.id, setor: j.setor, status: j.status, aguardando: j.aguardando, operacao: j.operacao, operacao_real: !!j.operacao_real, agente: j.agente || {}, jornada: j.jornada || [] };
}

async function enviar(texto, audio){
  texto = String(texto || '').trim();
  if (audio) texto = '🎤 Áudio (' + audio.dur + ')';
  if (!texto) return;
  if (!token) { pedirLogin(); return; }
  const enviadoEm = new Date().toISOString();   // hora em que o cliente enviou (ordena as mensagens em sequência)
  enviando++;
  const itemCli = {de:'cli', texto, em:Date.now()}; hist.push(itemCli); salvar(); $('vazio').style.display = 'none'; const elCli = bolha(itemCli);
  $('txt').value = ''; ajustar();
  $('digitando').classList.add('on'); $('msgs').scrollTop = $('msgs').scrollHeight;
  try {
    const r = await fetch(BASE + '/gmcred/chat', { method:'POST', body:new URLSearchParams(audio ? {k:token, telefone:tel, mensagem:'', audio:audio.b64, audio_mime:audio.mime, enviado_em:enviadoEm} : {k:token, telefone:tel, mensagem:texto, enviado_em:enviadoEm}) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { semSessao(); return; }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    estado('ok', 'Conectado');
    if (audio && j.ouvido) {   // mostra o que a IA entendeu do áudio
      const ouvido = String(j.ouvido).replace(/^🎤\s*/, '');
      itemCli.texto = texto + '\n“' + ouvido + '”'; salvar();
      elCli.innerHTML = esc(itemCli.texto).replace(/\n/g, '<br>') + '<small>' + hora(itemCli.em) + '</small>';
    }
    if (j.agrupada) return;   // juntada com as próximas mensagens: a resposta vem na última
    aplicarLead(j);
    if (j.humano) { hist.push({de:'sis', texto:'Um atendente humano está com esta conversa. O agente não responde.', em:Date.now()}); bolha(hist[hist.length-1]); }
    const lista = (j.mensagens || []).filter(m => !m.id || m.id > ultimoId);
    for (let i = 0; i < lista.length; i++) {
      if (i) { $('digitando').classList.add('on'); await new Promise(res => setTimeout(res, 650)); }
      if (addAgente([lista[i]])) bolha(hist[hist.length-1]);
    }
    salvar(); bastidores(); buscarNovas();
  } catch (e) {
    hist.push({de:'sis', texto:'Não consegui falar com o servidor (' + e.message + '). Tente de novo.', em:Date.now()}); bolha(hist[hist.length-1]);
    estado('erro', 'Erro de conexão');
  } finally {
    enviando = Math.max(0, enviando - 1); if (!enviando) $('digitando').classList.remove('on'); $('txt').focus();
  }
}

async function buscarNovas(){
  if (!token) return;
  try {
    const r = await fetch(BASE + '/gmcred/chat/novas', { method:'POST', body:new URLSearchParams({k:token, telefone:tel, depois:String(ultimoId)}) });
    if (r.status === 401) { semSessao(); return; }
    const j = await r.json();
    if (j.lead) aplicarLead(j.lead);
    const antes = hist.length;
    if (addAgente(j.mensagens)) { for (let i = antes; i < hist.length; i++) bolha(hist[i]); $('vazio').style.display = 'none'; }
    placar(j.placar); salvar(); bastidores(); estado('ok', 'Conectado');
  } catch (e) { estado('erro', 'Sem conexão'); }
}
function agendarPoll(){ clearInterval(timerPoll); timerPoll = setInterval(() => { if (!document.hidden) buscarNovas(); }, 5000); }

async function evento(tipo){
  if (!token) { pedirLogin(); return; }
  const btn = tipo === 'assinou' ? $('bAssinou') : $('bPagou'); btn.disabled = true;
  hist.push({de:'sis', texto: tipo === 'assinou' ? 'Simulando: o cliente assinou o contrato.' : 'Simulando: o dinheiro caiu na conta do cliente.', em:Date.now()}); bolha(hist[hist.length-1]); salvar();
  try {
    const r = await fetch(BASE + '/gmcred/chat/evento', { method:'POST', body:new URLSearchParams({k:token, telefone:tel, evento:tipo}) });
    if (r.status === 401) { semSessao(); return; }
    const j = await r.json().catch(() => ({}));
    if (!j.ok) { hist.push({de:'sis', texto: j.texto || 'Não foi possível simular agora.', em:Date.now()}); bolha(hist[hist.length-1]); }
    await buscarNovas();
  } catch (e) { alert('Não foi possível simular agora.'); }
}

function novoCliente(){
  tel = novoTel(); hist = []; info = null; ultimoId = 0; render();
  hist.push({de:'sis', texto:'Novo cliente de teste. Na primeira mensagem ele é sorteado para um agente.', em:Date.now()}); render(); salvar();
}
async function limparTestes(){
  if (!token) { pedirLogin(); return; }
  if (!confirm('Apagar todos os clientes de teste (e as conversas deles) do painel?')) return;
  try {
    const r = await fetch(BASE + '/gmcred/chat/limpar', { method:'POST', body:new URLSearchParams({k:token}) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { semSessao(); return; }
    Object.keys(localStorage).filter(k => k.startsWith('chat_teste_')).forEach(lsDel);
    tel = novoTel(); hist = []; info = null; ultimoId = 0;
    hist.push({de:'sis', texto:(j.apagados || 0) + ' cliente(s) de teste apagado(s).', em:Date.now()}); render(); salvar(); buscarNovas();
  } catch (e) { alert('Não foi possível apagar agora.'); }
}

function semSessao(){ token=''; lsDel('escritorio_token'); $('digitando').classList.remove('on'); estado('erro','Sem sessão'); pedirLogin('Sua sessão expirou. Entre de novo.'); }
function pedirLogin(msg){ $('chaveErr').textContent = msg || ''; $('login').classList.add('on'); setTimeout(() => $('chaveIn').focus(), 50); }
async function entrar(){
  const v = $('chaveIn').value.trim(), err = $('chaveErr');
  if (!v) { err.textContent = 'Digite a chave.'; return; }
  err.textContent = 'Entrando…';
  try {
    const r = await fetch(BASE + '/escritorio/login', { method:'POST', body:new URLSearchParams({k:v}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.token) { err.textContent = r.status === 401 ? 'Chave inválida.' : 'Não foi possível entrar (HTTP ' + r.status + ').'; return; }
    token = j.token; lsSet('escritorio_token', token);
  } catch (e) { err.textContent = 'Sem conexão com o servidor.'; return; }
  $('chaveIn').value = ''; err.textContent = ''; $('login').classList.remove('on'); estado('ok', 'Conectado'); buscarNovas(); $('txt').focus();
}

function ajustar(){ const t = $('txt'); t.style.height = '44px'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; }
$('txt').addEventListener('input', ajustar);
$('txt').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar($('txt').value); } });
$('form').addEventListener('submit', e => { e.preventDefault(); enviar($('txt').value); });
// gravar áudio: toque para começar, toque de novo para enviar (até 2 minutos)
let gravador = null, pedacos = [], inicioGrav = 0, timerGrav = null;
function fmtDur(ms){ const t = Math.round(ms/1000); return Math.floor(t/60) + ':' + String(t%60).padStart(2,'0'); }
async function alternarGravacao(){
  const b = $('mic');
  if (gravador && gravador.state === 'recording') { gravador.stop(); return; }
  if (!token) { pedirLogin(); return; }
  if (!navigator.mediaDevices || !window.MediaRecorder) { alert('Este navegador não grava áudio.'); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (e) { alert('Não consegui acessar o microfone. Libere o microfone para este site e tente de novo.'); return; }
  const tipos = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];
  const mime = tipos.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
  gravador = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); pedacos = [];
  gravador.ondataavailable = e => { if (e.data && e.data.size) pedacos.push(e.data); };
  gravador.onstop = async () => {
    clearInterval(timerGrav); stream.getTracks().forEach(t => t.stop());
    b.classList.remove('gravando'); b.textContent = '🎤';
    const dur = Date.now() - inicioGrav;
    if (dur < 700 || !pedacos.length) return;   // toque sem querer
    const blob = new Blob(pedacos, { type: gravador.mimeType || mime || 'audio/webm' });
    const b64 = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.readAsDataURL(blob); });
    enviar('', { b64, mime: blob.type, dur: fmtDur(dur) });
  };
  gravador.start(); inicioGrav = Date.now(); b.classList.add('gravando'); b.textContent = '■ 0:00';
  timerGrav = setInterval(() => { const d = Date.now() - inicioGrav; b.textContent = '■ ' + fmtDur(d); if (d > 120000) gravador.stop(); }, 250);
}
$('mic').addEventListener('click', alternarGravacao);
ATALHOS.forEach(a => { const b = document.createElement('button'); b.type = 'button'; b.textContent = a; b.onclick = () => enviar(a); $('atalhos').appendChild(b); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) buscarNovas(); });

render();
if (token) { estado('ok', 'Pronto'); buscarNovas(); } else { estado('', 'Sem sessão'); pedirLogin(); }
agendarPoll();
</script>
