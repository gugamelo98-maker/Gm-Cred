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
/* período do funil: 30 dias (padrão, já vem pronto), hoje, 7 dias, este mês ou datas à escolha */
let funilBusy=false;let funilP=(()=>{try{return JSON.parse(lsGet('escritorio_funilp')||'null')||{k:'30'};}catch(e){return{k:'30'};}})(),funilD=null,funilSeq=0;
const isoD=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function funilRange(){const h=new Date(),f=n=>{const d=new Date(h);d.setDate(d.getDate()-n);return d;};
  if(funilP.k==='hoje')return{de:isoD(h),ate:isoD(h),nome:'hoje'};
  if(funilP.k==='7')return{de:isoD(f(6)),ate:isoD(h),nome:'últimos 7 dias'};
  if(funilP.k==='mes')return{de:isoD(new Date(h.getFullYear(),h.getMonth(),1)),ate:isoD(h),nome:'este mês'};
  if(funilP.k==='custom'&&funilP.de&&funilP.ate){const b=x=>x.split('-').reverse().join('/');return{de:funilP.de,ate:funilP.ate,nome:funilP.de===funilP.ate?'em '+b(funilP.de):'de '+b(funilP.de)+' a '+b(funilP.ate)};}
  return{de:isoD(f(29)),ate:isoD(h),nome:'últimos 30 dias'};}
function funilBarra(){const ch=[['hoje','Hoje'],['7','7 dias'],['30','30 dias'],['mes','Este mês'],['custom','Escolher datas']];
  return '<div class="fbox" style="padding:10px 12px"><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">'+ch.map(([k,t])=>`<button class="chip ${funilP.k===k?'on':''}" onclick="funilPeriodo('${k}')">${t}</button>`).join('')
   +(funilP.k==='custom'?`<span style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><input type="date" id="funilDe" value="${esc(funilP.de||'')}" aria-label="De" style="padding:6px 8px;border:1px solid var(--bd);border-radius:8px;background:var(--bg2,#fff);color:var(--tx)"> até <input type="date" id="funilAte" value="${esc(funilP.ate||'')}" aria-label="Até" style="padding:6px 8px;border:1px solid var(--bd);border-radius:8px;background:var(--bg2,#fff);color:var(--tx)"><button class="bt pri" onclick="funilAplicar()">Aplicar</button></span>`:'')
   +'<small class="cpe-h" style="margin-left:auto">'+esc(funilRange().nome)+'</small></div></div>';}
function funilPeriodo(k){funilP.k=k;if(k==='custom'&&!funilP.de){const h=new Date();funilP.de=isoD(new Date(h.getFullYear(),h.getMonth(),1));funilP.ate=isoD(h);}lsSet('escritorio_funilp',JSON.stringify(funilP));funilD=null;if(k==='custom'){renderFunil();return;}funilCarregar();renderFunil();}
function funilAplicar(){const de=document.getElementById('funilDe').value,ate=document.getElementById('funilAte').value;if(!de||!ate||ate<de){alert('Escolha as duas datas (a final não pode ser antes da inicial).');return;}funilP.de=de;funilP.ate=ate;lsSet('escritorio_funilp',JSON.stringify(funilP));funilD=null;funilCarregar();renderFunil();}
async function funilCarregar(){if(funilP.k==='30'||demo||!chave){funilD=null;return;}if(funilP.k==='custom'&&!(funilP.de&&funilP.ate))return;const R=funilRange(),seq=++funilSeq;funilBusy=true;
  try{const r=await fetch(BASE+'/escritorio/funil',{method:'POST',body:new URLSearchParams({k:chave,de:R.de,ate:R.ate})});if(r.status===401){pedirChave('Chave inválida ou desativada.');return;}if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();if(seq!==funilSeq)return;funilD=j.erro?null:Object.assign({de:R.de,ate:R.ate,ts:Date.now()},j);}catch(e){if(seq===funilSeq)funilD=null;}
  if(seq===funilSeq)funilBusy=false;if(telaAtual==='funil')renderFunil();}
function renderFunil(){const el=document.getElementById('funilSec');const R=funilRange(),usaP=funilP.k!=='30';if(usaP&&!demo&&chave&&!funilBusy&&(!funilD||funilD.de!==R.de||funilD.ate!==R.ate||Date.now()-funilD.ts>60000)){funilCarregar();}
  const F=usaP?(funilD&&funilD.de===R.de&&funilD.ate===R.ate?funilD:null):((estado.funil&&!Array.isArray(estado.funil))?estado.funil:{});
  if(!F){el.innerHTML=funilBarra()+'<div class="fbox"><div class="vazio">Carregando o funil…</div></div>';return;}
  const base=Number(F.entraram||0);
  const et=[['Entraram',F.entraram],['Mandaram o CPF',F.enviaram_cpf],['Receberam a proposta',F.com_margem],...(F.escolheram!=null?[['Escolheram uma oferta',F.escolheram]]:[]),['Link enviado',F.receberam_proposta],['Assinaram',F.assinaram],['Foram pagos',F.pagos]];
  const rows=et.map(([n,v],i)=>{v=Number(v||0);const pct=base?Math.round(v/base*100):0;const ant=i?Number(et[i-1][1]||0):0;
    return `<div class="fl" title="${i&&ant?Math.round(v/ant*100)+'% de quem chegou na etapa anterior':''}"><span>${n}</span><div class="bar"><i style="width:${base?Math.max(v?2:0,pct):0}%"></i></div><div class="v">${v}<small>${i?pct+'% do total':'100%'}</small></div></div>`;}).join('');
  const dKey=t=>isoD(new Date(t)),C30=(estado.crm||[]).filter(c=>c.entrou&&(usaP?(dKey(c.entrou)>=R.de&&dKey(c.entrou)<=R.ate):Date.now()-new Date(c.entrou).getTime()<=30*86400000));
  if(C30.length){const cont={};C30.filter(c=>c.grupo==='perdido').forEach(c=>{const k=catPerda(c);cont[k]=(cont[k]||0)+1;});
    const L=Object.entries(cont).sort((x,y)=>y[1]-x[1]),tot=L.reduce((a,x)=>a+x[1],0),sm=C30.filter(c=>c.grupo==='sem_margem').length,cm=C30.filter(c=>c.grupo==='com_margem').length;
    el.innerHTML=funilBarra()+`<div class="fbox"><h4>📉 Funil · ${R.nome}</h4>${base?rows:'<div class="vazio">Ainda não há clientes neste período.</div>'}</div>
    <div class="fbox"><h4>❌ Atendimentos finalizados · ${tot}</h4>${L.length?L.map(([k,n])=>`<button class="mot" onclick="verCat(this.dataset.c)" data-c="${esc(k)}" title="Ver esses clientes"><span>🏷️ ${esc(k)}</span><b>${n} ›</b></button>`).join(''):'<div class="vazio">Nenhum atendimento finalizado.</div>'}
      <button class="mot" style="margin-top:10px;color:#a15c00" onclick="crmF={grupo:'com_margem',busca:'',motivo:'',cat:''};irPara('clientes')" title="Têm margem e pararam de responder: dá para chamar de novo"><span>💰 Com margem (dá para chamar de novo)</span><b>${cm} ›</b></button>
      <button class="mot" style="margin-top:10px;color:var(--tx2)" onclick="crmF={grupo:'sem_margem',busca:'',motivo:'',cat:''};irPara('clientes')" title="Não conta como perda: o cliente não tinha margem"><span>🚫 Sem margem (fora das perdas)</span><b>${sm} ›</b></button></div>`;return;}
  const TODOS=F.motivos_perda||[],ehSM=m=>/^sem margem/i.test(m.motivo||''),M=TODOS.filter(m=>!ehSM(m)),SM=TODOS.filter(ehSM).reduce((a,m)=>a+Number(m.total||0),0),totP=M.reduce((a,m)=>a+Number(m.total||0),0);
  el.innerHTML=funilBarra()+`<div class="fbox"><h4>📉 Funil · ${R.nome}</h4>${base?rows:'<div class="vazio">Ainda não há clientes neste período.</div>'}</div>
    <div class="fbox"><h4>❌ Onde perdemos clientes · ${totP}</h4>${M.length?M.map(m=>`<button class="mot" onclick="verMotivo(this.dataset.m)" data-m="${esc(m.motivo)}" title="Ver esses clientes"><span>${esc(m.motivo)}</span><b>${m.total} ›</b></button>`).join(''):'<div class="vazio">Nenhuma perda registrada.</div>'}<button class="mot" style="margin-top:10px;color:var(--tx2)" onclick="crmF={grupo:'sem_margem',busca:'',motivo:'',cat:''};irPara('clientes')" title="Não conta como perda: o cliente não tinha margem"><span>🚫 Sem margem (fora das perdas)</span><b>${SM} ›</b></button></div>`;}
function renderSaude(){const S=estado.saude||{};
  const it=[['V8',S.v8],['WhatsApp',S.whatsapp],['n8n',S.n8n]].map(([n,x])=>[n,x||{}]);
  const erro=it.filter(([,x])=>x.ok===false),ok=!erro.length&&it.some(([,x])=>x.ok===true);
  const tit=it.map(([n,x])=>(x.ok===true?'✅ ':x.ok===false?'❌ ':'• ')+n+': '+(x.detalhe||'sem dados')).join('\n');
  document.getElementById('saude').innerHTML=`<span class="sd ${erro.length?'erro':ok?'ok':'neutro'}" title="${esc(tit)}" aria-label="${esc(tit)}"><i></i><span>${erro.length?esc(erro.map(e=>e[0]).join(', '))+' com problema':ok?'Sistema ok':'Sistema'}</span></span>`;}

