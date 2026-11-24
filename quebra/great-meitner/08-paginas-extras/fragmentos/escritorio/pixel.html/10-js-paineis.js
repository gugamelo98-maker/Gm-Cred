// ═════════════ PAINÉIS ═════════════
let dashAberto=null;
function abrir(){document.getElementById('dash').classList.add('open');buildSidebar();}
function openDash(id){dashAberto=id;renderDash();abrir();}
function openFeed(){dashAberto='feed';renderDash();abrir();}
function closeDash(){document.getElementById('dash').classList.remove('open');dashAberto=null;buildSidebar();}
function leadRow(l,cor){
  const s=setorById(l.setor_id);const m=minDesde(l.entrou_setor_em);
  return `<div class="row" style="--c:${cor||(s?s.cor:'#666')}">
    <div class="a">${esc(l.nome||l.telefone||'Cliente #'+l.id)}</div>
    <div class="b" style="color:${l.produto==='fgts'?'#cc44ff':'#ffcc00'}">${(l.produto||'—').toUpperCase()}</div>
    <div class="b">${STATUS_LABEL[l.status]||esc(l.status)}</div>
    <div class="b">${l.valor?brl(l.valor):'—'}</div>
    <div class="b ${l.parado?'warn':''}">${l.parado?'⚠ ':''}${tempo(m)}</div>
    <div class="b">${l.aguardando==='cliente'?'⏳ cliente':l.aguardando==='humano'?'🙋 humano':'🤖 agente'}</div>
  </div>`;
}
function renderDash(){
  const T=document.getElementById('dashTitle'),S=document.getElementById('dashSub'),C=document.getElementById('dashContent');
  if(dashAberto==='feed'){
    T.textContent='FEED AO VIVO';T.style.color='#ffcc00';S.textContent='Tudo o que está acontecendo na empresa, em ordem.';
    C.innerHTML=estado.eventos.length?'<div class="list">'+estado.eventos.map(e=>{const s=setorById(e.setor_destino||e.setor_origem);
      const cor=e.tipo==='fechou'?'#ffcc00':e.tipo==='perdeu'?'#ff2244':(s?s.cor:'#666');
      return `<div class="row" style="--c:${cor}"><span class="ev-time">${hora(e.criado_em)}</span><div class="a">${esc(e.descricao)}</div></div>`;}).join('')+'</div>'
      :'<div class="empty">Nenhum evento ainda.<br>Quando um cliente entrar, aparece aqui.</div>';return;}
  if(dashAberto==='numeros'){
    T.textContent='NÚMEROS DE ATENDIMENTO';T.style.color='#00ff88';S.textContent='Portas de entrada do WhatsApp. Todos os agentes atendem em todos os números.';
    C.innerHTML=estado.numeros.length?'<div class="list">'+estado.numeros.map(n=>{const cor={conectado:'#00ff88',desconectado:'#ff4466',bloqueado:'#ff2244'}[n.status_conexao]||'#666';
      return `<div class="row" style="--c:${cor}"><div class="a">${esc(n.apelido||n.telefone||'Número '+n.id)}</div><div class="b">${esc(n.telefone||'')}</div><div class="b" style="color:${cor}">${esc((n.status_conexao||'').toUpperCase())}</div><div class="b">${n.leads_ativos||0} clientes</div></div>`;}).join('')+'</div>'
      :'<div class="empty">Nenhum número cadastrado ainda.<br>Os números entram na tabela credito.numeros.</div>';return;}
  const s=setorById(dashAberto);if(!s)return closeDash();
  T.textContent=s.nome.toUpperCase();T.style.color=s.cor;S.textContent=s.descricao+(s.sla_minutos?' · prazo: '+tempo(s.sla_minutos):'');
  const ags=estado.agentes.filter(a=>a.setor_id===s.id);
  const leads=s.id==='gerente'?estado.leads.filter(l=>l.parado):estado.leads.filter(l=>l.setor_id===s.id);
  const kpis=s.id==='gerente'
    ?[[estado.resumo.em_andamento??0,'CLIENTES NA EMPRESA'],[estado.resumo.parados??0,'PARADOS ALÉM DO PRAZO'],[estado.resumo.fecharam_hoje??0,'FECHARAM HOJE'],[brl(estado.resumo.comissao_hoje),'COMISSÃO HOJE']]
    :[[s.leads_ativos,'CLIENTES AQUI'],[s.leads_parados,'PARADOS'],[leads.filter(l=>l.aguardando==='cliente').length,'ESPERANDO CLIENTE'],[s.agentes_trabalhando+'/'+s.agentes,'AGENTES ATIVOS']];
  C.innerHTML=`<div class="kpi-row">${kpis.map(k=>`<div class="kpi"><div class="kpi-v" style="color:${s.cor}">${k[0]}</div><div class="kpi-l">${k[1]}</div></div>`).join('')}</div>
    <div class="sec-title">▸ AGENTES</div>
    <div class="list">${ags.map(a=>`<div class="row" style="--c:${s.cor}"><div class="a">${esc(a.nome)} · ${esc(a.papel||'')}</div><div class="b" style="color:${AG_COLOR[a.status]||'#666'}">${AG_LABEL[a.status]||esc(a.status)}</div><div class="b">${a.fechados||0} fechados</div></div>`).join('')||'<div class="empty">Nenhum agente neste setor.</div>'}</div>
    <div class="sec-title">▸ ${s.id==='gerente'?'CLIENTES PARADOS (PRECISAM DE ATENÇÃO)':'CLIENTES AQUI AGORA'} (${leads.length})</div>
    <div class="list">${leads.length?leads.map(l=>leadRow(l)).join(''):'<div class="empty">'+(s.id==='gerente'?'Nenhum cliente parado. Tudo em dia!':'Nenhum cliente neste setor agora.')+'</div>'}</div>`;
}

