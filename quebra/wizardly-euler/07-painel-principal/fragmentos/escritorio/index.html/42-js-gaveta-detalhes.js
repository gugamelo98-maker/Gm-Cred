// ═════════════ GAVETA (detalhes) ═════════════
let painelAberto=null;
function abrirPainel(id){painelAberto=id;tip.style.display='none';if(String(id).startsWith('cliente:'))carregarFicha(Number(String(id).slice(8)));else if(String(id).startsWith('agente:'))painelAgente(Number(String(id).slice(7)));else renderPainel();veu.classList.add('on');gaveta.classList.add('on');gaveta.setAttribute('aria-hidden','false');}
function fecharPainel(){painelAberto=null;veu.classList.remove('on');gaveta.classList.remove('on');gaveta.setAttribute('aria-hidden','true');}
document.addEventListener('keydown',e=>{if(e.key==='Escape')fecharPainel();});
function itemLead(l){const s=setorById(l.setor_id);const m=minDesde(l.entrou_setor_em);
  return `<div class="item ${l.parado?'parado':''}" style="cursor:pointer" role="button" tabindex="0" onclick="abrirPainel('cliente:${l.id}')"><div class="av">${pessoaEmPe(l.id,l.parado).replace('viewBox="0 0 30 74"','viewBox="4 0 22 24"')}</div>
    <div class="t"><b>${esc(l.nome||l.telefone||'Cliente #'+l.id)}</b><span>${STATUS_LABEL[l.status]||esc(l.status)} · ${l.produto?esc(l.produto.toUpperCase()):'—'}${s&&painelAberto==='gerente'?' · <span style="color:'+s.cor+'">'+esc(s.nome)+'</span>':''}</span></div>
    <div class="d"><b>${l.valor?brl(l.valor):'—'}</b><span style="color:${l.parado?'var(--vermelho)':''}">${l.parado?'⚠ ':''}${tempo(m)}</span></div></div>`;}
function renderPainel(){
  const T=gTit,S=gSub,C=gCorpo;
  if(painelAberto==='atencao'){const L=atencaoOrdenada();T.textContent='🔔 Precisa da sua atenção';S.textContent=L.length+(L.length===1?' item':' itens')+', do mais urgente para o menos urgente.';
    C.innerHTML=L.length?`<div class="at-lista">${L.map(atItem).join('')}</div>`:'<div class="vazio">✅ Tudo em ordem: nada precisa de você agora.</div>';return;}
  if(painelAberto==='feed'){T.textContent='Feed ao vivo';S.textContent='Tudo o que está acontecendo na empresa, do mais recente para o mais antigo.';
    C.innerHTML=estado.eventos.length?estado.eventos.map(e=>{const s=setorById(e.setor_destino||e.setor_origem);const cor=e.tipo==='fechou'?'var(--verde)':e.tipo==='perdeu'?'var(--vermelho)':(s?s.cor:'#999');
      return `<div class="ev"><time>${hora(e.criado_em)}</time><i style="background:${cor}"></i><span>${esc(e.descricao)}</span></div>`;}).join(''):'<div class="vazio">Nenhum acontecimento ainda. Quando um cliente entrar, aparece aqui.</div>';return;}
  if(painelAberto&&painelAberto.startsWith('etapa:')){const k=painelAberto.slice(6),e=ETAPAS[k];const f=estado.financeiro.find(x=>x.etapa===k)||{contratos:0,valor_liberado:0,comissao:0};
    const lista=estado.contratos.filter(c=>c.etapa===k);
    T.innerHTML=`<span style="color:${e.cor}">●</span> ${e.nome}`;S.textContent=e.desc+'.';
    C.innerHTML=`<div class="g-kpis"><div><b style="color:${e.cor}">${brlFull(f.comissao)}</b><span>Comissão</span></div><div><b>${f.contratos}</b><span>Contratos</span></div><div><b>${brlFull(f.valor_liberado)}</b><span>Valor liberado</span></div><div><b>${f.contratos?brlFull(f.comissao/f.contratos):'—'}</b><span>Comissão média</span></div></div>
      <div class="g-sec">Contratos · ${lista.length}</div>${lista.length?lista.map(itemContrato).join(''):'<div class="vazio">Nenhum contrato nesta etapa.</div>'}`;return;}
  if(painelAberto==='meta'){const M=estado.meta||{};const meta=Number(M.meta_valor||7000),feito=Number(M.valor_hoje||0);
    T.textContent='🎯 Meta do dia';S.innerHTML='Meta de '+brlFull(meta)+' liberados por dia. Contam só os contratos <b>pagos hoje</b> (dinheiro na conta do cliente).';
    const hoje=new Date().toDateString(),lista=estado.contratos.filter(c=>c.etapa==='pago'&&c.dt_pagamento&&new Date(c.dt_pagamento).toDateString()===hoje);
    C.innerHTML=`<div class="g-kpis"><div><b>${brlFull(feito)}</b><span>Liberado (pagos hoje)</span></div><div><b>${brlFull(Math.max(0,meta-feito))}</b><span>Falta para a meta</span></div><div><b>${M.contratos_hoje||0}</b><span>Contratos pagos hoje</span></div><div><b>${brlFull(M.comissao_hoje)}</b><span>Comissão dos pagos hoje</span></div></div>
      <div class="g-sec">Contratos pagos hoje · ${lista.length}</div>${lista.length?lista.map(itemContrato).join(''):'<div class="vazio">Nenhum contrato pago hoje ainda.</div>'}`;return;}
  if(painelAberto==='numeros'){T.textContent='Números de atendimento';S.textContent='Portas de entrada do WhatsApp. Todos os agentes atendem em todos os números, e o cliente sempre continua no número por onde entrou.';
    C.innerHTML=estado.numeros.length?estado.numeros.map(n=>{const cor={conectado:'var(--verde)',desconectado:'var(--vermelho)',bloqueado:'var(--vermelho)'}[n.status_conexao]||'var(--tx3)';
      return `<div class="item"><div class="av" style="display:grid;place-items:center;font-size:17px">📱</div><div class="t"><b>${esc(n.apelido||n.telefone||'Número '+n.id)}</b><span>${esc(n.telefone||'')}</span></div><div class="d"><b style="color:${cor}">${esc(n.status_conexao||'—')}</b><span>${n.leads_ativos||0} clientes</span></div></div>`;}).join('')
      :'<div class="vazio">Nenhum número cadastrado ainda.<br>Eles entram na tabela <b>credito.numeros</b> quando o WhatsApp for ligado.</div>';return;}
  const s=setorById(painelAberto);if(!s)return fecharPainel();
  const ger=s.id==='gerente';const ag=estado.agentes.find(a=>a.setor_id===s.id);
  const leads=ger?estado.leads.filter(l=>l.parado):estado.leads.filter(l=>l.setor_id===s.id);
  T.innerHTML=`<span style="color:${s.cor}">●</span> ${esc(s.nome)}`;S.textContent=s.descricao+(s.sla_minutos?' · Prazo do setor: '+tempo(s.sla_minutos)+'.':'');
  const k=ger?[[estado.resumo.em_andamento||0,'Clientes na empresa'],[estado.resumo.parados||0,'Parados além do prazo'],[(estado.meta&&estado.meta.contratos_hoje)||0,'Pagos hoje'],[brl(estado.meta&&estado.meta.comissao_hoje),'Comissão dos pagos hoje']]
    :[[s.leads_ativos,'Clientes aqui'],[s.leads_parados,'Parados'],[leads.filter(l=>l.aguardando==='cliente').length,'Esperando o cliente'],[ag?(AG_LABEL[ag.status]||ag.status):'—','Agente']];
  C.innerHTML=`<div class="g-kpis">${k.map(x=>`<div><b>${x[0]}</b><span>${x[1]}</span></div>`).join('')}</div>
    ${agentesDe(s.id).length?`<div class="g-sec">Agentes do setor</div>`+agentesDe(s.id).map(a=>`<div class="item"><div class="av">${avatarAgente(a)}</div><div class="t"><b>${a.versao?'<span class="vtag">'+esc(a.versao)+'</span>':''}${esc(a.nome)}</b><span>${esc(a.abordagem||a.papel||'')}</span></div><div class="d"><b>${estado.leads.filter(l=>l.setor_id===s.id&&l.agente_id===a.id).length}</b><span>clientes agora</span></div></div>`).join(''):''}
    <div class="g-sec">${ger?'Clientes parados (precisam de atenção)':'Clientes aqui agora'} · ${leads.length}</div>
    ${leads.length?leads.map(itemLead).join(''):`<div class="vazio">${ger?'Nenhum cliente parado. Tudo em dia!':'Nenhum cliente neste setor agora.'}</div>`}`;
}

