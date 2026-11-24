// ═════════════ ATENÇÃO, FUNIL E SAÚDE ═════════════
const AT_ICON={humano:'🙋',pedido_humano:'🙋',pendencia:'🧾',numero:'📵',travado:'⏳',cancelamento:'🚫',v8_erro:'⚠️'};
function atencaoOrdenada(){return (estado.atencao||[]).slice().sort((a,b)=>(a.prioridade||9)-(b.prioridade||9));}
function atItem(a){return `<div class="at-item ${a.prioridade>1?'p2':''}"><div class="ic">${AT_ICON[a.tipo]||'🔔'}</div>
    <div class="tx"><b>${esc(a.titulo)}</b><span>${a.cliente?esc(a.cliente)+' · ':''}${esc(a.detalhe||'')}${a.desde?' · há '+tempo(minDesde(a.desde)):''}</span></div>
    <div class="bts">${a.lead_id?`<button class="bt pri" onclick="abrirPainel('cliente:${a.lead_id}')">Ver cliente</button>`:''}${a.alerta_id?`<button class="bt" onclick="acao('resolver',null,${a.alerta_id})">Resolver</button>`:''}${a.tipo==='numero'?`<button class="bt" onclick="abrirPainel('numeros')">Ver números</button>`:''}</div></div>`;}
function renderAtencao(){const el=document.getElementById('atencao');const L=atencaoOrdenada();
  const nb=document.getElementById('navBadge');nb.hidden=!L.length;nb.textContent=L.length;
  el.classList.toggle('ok',!L.length);
  if(!L.length){el.innerHTML='<div class="at-ok">✅ Tudo em ordem: nada precisa de você agora.</div>';return;}
  el.innerHTML=`<div class="at-topo">🔔 Precisa da sua atenção <span class="n">${L.length}</span>${L.length>3?`<button class="lnk" onclick="abrirPainel('atencao')">ver todos →</button>`:''}</div>
    <div class="at-lista" style="margin-top:10px">${L.slice(0,3).map(atItem).join('')}</div>`;}
function renderFunil(){const el=document.getElementById('funilSec');const F=(estado.funil&&!Array.isArray(estado.funil))?estado.funil:{};const base=Number(F.entraram||0);
  const et=[['Entraram',F.entraram],['Mandaram o CPF',F.enviaram_cpf],['Receberam a proposta',F.com_margem],...(F.escolheram!=null?[['Escolheram uma oferta',F.escolheram]]:[]),['Link enviado',F.receberam_proposta],['Assinaram',F.assinaram],['Foram pagos',F.pagos]];
  const rows=et.map(([n,v],i)=>{v=Number(v||0);const pct=base?Math.round(v/base*100):0;const ant=i?Number(et[i-1][1]||0):0;
    return `<div class="fl" title="${i&&ant?Math.round(v/ant*100)+'% de quem chegou na etapa anterior':''}"><span>${n}</span><div class="bar"><i style="width:${base?Math.max(v?2:0,pct):0}%"></i></div><div class="v">${v}<small>${i?pct+'% do total':'100%'}</small></div></div>`;}).join('');
  const C30=(estado.crm||[]).filter(c=>c.entrou&&Date.now()-new Date(c.entrou).getTime()<=30*86400000);
  if(C30.length){const cont={};C30.filter(c=>c.grupo==='perdido').forEach(c=>{const k=catPerda(c);cont[k]=(cont[k]||0)+1;});
    const L=Object.entries(cont).sort((x,y)=>y[1]-x[1]),tot=L.reduce((a,x)=>a+x[1],0),sm=C30.filter(c=>c.grupo==='sem_margem').length,cm=C30.filter(c=>c.grupo==='com_margem').length;
    el.innerHTML=`<div class="fbox"><h4>📉 Funil · últimos 30 dias</h4>${base?rows:'<div class="vazio">Ainda não há clientes nos últimos 30 dias.</div>'}</div>
    <div class="fbox"><h4>❌ Atendimentos finalizados · ${tot}</h4>${L.length?L.map(([k,n])=>`<button class="mot" onclick="verCat(this.dataset.c)" data-c="${esc(k)}" title="Ver esses clientes"><span>🏷️ ${esc(k)}</span><b>${n} ›</b></button>`).join(''):'<div class="vazio">Nenhum atendimento finalizado.</div>'}
      <button class="mot" style="margin-top:10px;color:#a15c00" onclick="crmF={grupo:'com_margem',busca:'',motivo:'',cat:''};irPara('clientes')" title="Têm margem e pararam de responder: dá para chamar de novo"><span>💰 Com margem (dá para chamar de novo)</span><b>${cm} ›</b></button>
      <button class="mot" style="margin-top:10px;color:var(--tx2)" onclick="crmF={grupo:'sem_margem',busca:'',motivo:'',cat:''};irPara('clientes')" title="Não conta como perda: o cliente não tinha margem"><span>🚫 Sem margem (fora das perdas)</span><b>${sm} ›</b></button></div>`;return;}
  const TODOS=F.motivos_perda||[],ehSM=m=>/^sem margem/i.test(m.motivo||''),M=TODOS.filter(m=>!ehSM(m)),SM=TODOS.filter(ehSM).reduce((a,m)=>a+Number(m.total||0),0),totP=M.reduce((a,m)=>a+Number(m.total||0),0);
  el.innerHTML=`<div class="fbox"><h4>📉 Funil · últimos 30 dias</h4>${base?rows:'<div class="vazio">Ainda não há clientes nos últimos 30 dias.</div>'}</div>
    <div class="fbox"><h4>❌ Onde perdemos clientes · ${totP}</h4>${M.length?M.map(m=>`<button class="mot" onclick="verMotivo(this.dataset.m)" data-m="${esc(m.motivo)}" title="Ver esses clientes"><span>${esc(m.motivo)}</span><b>${m.total} ›</b></button>`).join(''):'<div class="vazio">Nenhuma perda registrada.</div>'}<button class="mot" style="margin-top:10px;color:var(--tx2)" onclick="crmF={grupo:'sem_margem',busca:'',motivo:'',cat:''};irPara('clientes')" title="Não conta como perda: o cliente não tinha margem"><span>🚫 Sem margem (fora das perdas)</span><b>${SM} ›</b></button></div>`;}
function renderSaude(){const S=estado.saude||{};
  const it=[['V8',S.v8],['WhatsApp',S.whatsapp],['n8n',S.n8n]].map(([n,x])=>[n,x||{}]);
  const erro=it.filter(([,x])=>x.ok===false),ok=!erro.length&&it.some(([,x])=>x.ok===true);
  const tit=it.map(([n,x])=>(x.ok===true?'✅ ':x.ok===false?'❌ ':'• ')+n+': '+(x.detalhe||'sem dados')).join('\n');
  document.getElementById('saude').innerHTML=`<span class="sd ${erro.length?'erro':ok?'ok':'neutro'}" title="${esc(tit)}" aria-label="${esc(tit)}"><i></i><span>${erro.length?esc(erro.map(e=>e[0]).join(', '))+' com problema':ok?'Sistema ok':'Sistema'}</span></span>`;}

