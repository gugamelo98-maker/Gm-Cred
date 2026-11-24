// ═════════════ FINANCEIRO (gastos, lucro e retorno) ═════════════
const FIN_CAT={disparos:['📤','Disparos de WhatsApp','#16a36a'],numeros:['📱','Números de WhatsApp','#e0a100'],trafego:['📣','Tráfego pago','#2f6fed'],bms:['🧩','BMs','#8a5cd6'],outros:['📎','Outros','#8a96a5']};
let finMesAtual=null,finDados=null,finOcupado=false,demoGastos=null;
function mesISO(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
function nomeMes(m){const [y,mm]=m.split('-').map(Number);const t=new Date(y,mm-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});return t.charAt(0).toUpperCase()+t.slice(1);}
function finMes(delta){const [y,m]=finMesAtual.split('-').map(Number);const d=new Date(y,m-1+delta,1);if(mesISO(d)>mesISO(new Date()))return;finMesAtual=mesISO(d);finCarregar();}
function finDemo(acao,extra){
  if(!demoGastos){const h=new Date(),d=n=>dataISO(new Date(h.getFullYear(),h.getMonth(),Math.max(1,h.getDate()-n)));let i=0;
    demoGastos=[[0,'trafego',180,'Campanha Facebook · CLT'],[1,'disparos',240,'Lista CLT SC',6000],[2,'trafego',175,'Campanha Facebook · CLT'],[3,'bms',350,'BM nova'],[4,'numeros',120,'3 chips novos'],[5,'disparos',200,'Lista CLT PR',5000],[6,'trafego',190,'Campanha Instagram'],[8,'outros',99,'Ferramenta de números']].map(g=>({id:++i,data:d(g[0]),categoria:g[1],valor:g[2],descricao:g[3],quantidade:g[4]||null}));}
  if(acao==='salvar')demoGastos.unshift({id:Date.now(),data:extra.data,categoria:extra.categoria,valor:Number(extra.valor),descricao:extra.descricao,quantidade:extra.categoria==='disparos'&&Number(extra.quantidade)>0?Number(extra.quantidade):null});
  if(acao==='apagar')demoGastos=demoGastos.filter(g=>String(g.id)!==String(extra.id));
  const noMes=m=>demoGastos.filter(g=>g.data.slice(0,7)===m),V=estado.vendas||[],vm=m=>V.filter(x=>x.dia.slice(0,7)===m),soma=(a,k)=>a.reduce((s,x)=>s+Number(x[k]||0),0);
  const G=noMes(finMesAtual),pc={};G.forEach(g=>pc[g.categoria]=(pc[g.categoria]||0)+g.valor);
  const hist=[];for(let i=0;i<6;i++){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-i);const m=mesISO(d);hist.push({mes:m,receita:soma(vm(m),'comissao'),gastos:soma(noMes(m),'valor')});}
  const cliM=soma(vm(finMesAtual),'clientes'),pgM=soma(vm(finMesAtual),'pagos'),comQ=G.filter(g=>g.categoria==='disparos'&&g.quantidade);
  return{disparos_qtd:soma(comQ,'quantidade'),disparos_gasto_com_qtd:soma(comQ,'valor'),origens:{disparo:{leads:Math.round(cliM*.58),pagos:Math.round(pgM*.5)},trafego:{leads:cliM-Math.round(cliM*.58),pagos:pgM-Math.round(pgM*.5)}},mes:finMesAtual,hoje:dataISO(new Date()),erro:null,gastos:G.slice().sort((a,b)=>b.data.localeCompare(a.data)),por_categoria:pc,total_gastos:soma(G,'valor'),receita:soma(vm(finMesAtual),'comissao'),liberado:soma(vm(finMesAtual),'liberado'),
    contratos_pagos:soma(vm(finMesAtual),'pagos'),prevista:estado.financeiro.filter(f=>f.etapa!=='pago').reduce((a,f)=>a+Number(f.comissao||0),0),clientes:soma(vm(finMesAtual),'clientes'),historico:hist};}
async function finCarregar(acao,extra){acao=acao||'ver';extra=extra||{};
  if(!finMesAtual)finMesAtual=mesISO(new Date());
  const di=document.getElementById('finData');if(di&&!di.value)di.value=dataISO(new Date());finAjustarForm();
  if(finOcupado)return;finOcupado=true;let erro='';
  try{
    if(demo)finDados=finDemo(acao,extra);
    else{if(!chave){pedirChave();return;}
      const r=await fetch(BASE+'/escritorio/financeiro',{method:'POST',body:new URLSearchParams({k:chave,acao,mes:finMesAtual,...extra})});
      if(r.status===401){pedirChave('Chave inválida ou desativada.');return;}
      if(!r.ok)throw new Error('HTTP '+r.status);finDados=await r.json();}
    erro=(finDados&&finDados.erro)||'';
  }catch(e){erro='Não consegui falar com o servidor ('+e.message+').';}
  finally{finOcupado=false;}
  document.getElementById('finErro').textContent=erro;renderFinanceiro();return !erro;}
function finAjustarForm(){const d=document.getElementById('finCatIn').value==='disparos';document.getElementById('finQtdLab').hidden=!d;}
async function finSalvar(ev){ev.preventDefault();
  let v=document.getElementById('finValor').value.trim().replace(/[^\d.,]/g,'');if(v.includes(','))v=v.replace(/\./g,'').replace(',','.');
  const valor=Number(v);if(!(valor>0)){document.getElementById('finErro').textContent='Informe um valor maior que zero.';return;}
  const bt=document.getElementById('finBtn');bt.disabled=true;
  const ok=await finCarregar('salvar',{valor:valor.toFixed(2),data:document.getElementById('finData').value,categoria:document.getElementById('finCatIn').value,descricao:document.getElementById('finDesc').value.trim(),quantidade:document.getElementById('finCatIn').value==='disparos'?document.getElementById('finQtd').value.replace(/\D/g,''):''});
  bt.disabled=false;if(ok){document.getElementById('finValor').value='';document.getElementById('finDesc').value='';document.getElementById('finQtd').value='';}}
function finApagar(id,txt){if(confirm('Apagar este gasto?\n'+txt))finCarregar('apagar',{id:String(id)});}
function renderFinanceiro(){const D=finDados;if(!D||typeof telaAtual==='undefined'||telaAtual!=='financeiro')return;
  document.getElementById('finMesTxt').textContent=nomeMes(D.mes);document.getElementById('finProx').disabled=D.mes>=mesISO(new Date());
  const rec=Number(D.receita||0),gas=Number(D.total_gastos||0),lucro=rec-gas,pg=Number(D.contratos_pagos||0),cli=Number(D.clientes||0);
  document.getElementById('finResumo').innerHTML=`
    <div><span class="big" style="color:#0f7a4f">${brlFull(rec)}</span>comissão recebida · <b>${pg}</b> contrato${pg===1?'':'s'} pago${pg===1?'':'s'}</div>
    <div><span class="big" style="color:#b42318">${brlFull(gas)}</span>gastos lançados no mês</div>
    <div><span class="big" style="color:${lucro>=0?'#0f7a4f':'#b42318'}">${lucro<0?'− ':''}${brlFull(Math.abs(lucro))}</span>${lucro>=0?'lucro':'prejuízo'} do mês${gas>0?` · para cada R$ 1 gasto ${rec>0?'voltaram <b>R$ '+(rec/gas).toFixed(2).replace('.',',')+'</b>':'ainda não voltou nada'}`:''}</div>`;
  const pc=D.por_categoria||{},max=Math.max(1,...Object.values(pc).map(Number));
  document.getElementById('finCat').innerHTML=`<h4>📊 Para onde foi o dinheiro</h4>${Object.entries(FIN_CAT).map(([k,c])=>{const v=Number(pc[k]||0);return `<div class="fc"><span>${c[0]} ${c[1]}</span><span class="br"><i style="width:${v/max*100}%;background:${c[2]}"></i></span><b>${brlFull(v)}</b></div>`;}).join('')}
    <div class="ag-nota">${gas>0?`Somando tudo: custo por cliente novo <b>${cli?brlFull(gas/cli):'—'}</b> (${cli} clientes no mês) · custo por contrato pago <b>${pg?brlFull(gas/pg):'—'}</b>`:'Lance os gastos ao lado para ver o custo por cliente e por contrato pago.'}</div>`;
  const O=D.origens||{},temOrig=!!(O.disparo||O.trafego),gD=Number(pc.disparos||0),gT=Number(pc.trafego||0),q=Number(D.disparos_qtd||0),gQ=Number(D.disparos_gasto_com_qtd||0);
  // sem a origem marcada nos números, só dá para atribuir os clientes a um canal quando o outro não teve gasto
  const lD=temOrig?Number((O.disparo||{}).leads||0):(gT===0?cli:null),lT=temOrig?Number((O.trafego||{}).leads||0):(gD===0?cli:null);
  const pD=temOrig?Number((O.disparo||{}).pagos||0):(gT===0?pg:null),pT=temOrig?Number((O.trafego||{}).pagos||0):(gD===0?pg:null);
  const num=n=>Number(n).toLocaleString('pt-BR'),cplTxt=(g,l)=>g>0&&l?brlFull(g/l):'—';
  document.getElementById('finLead').innerHTML=`<h4>🎯 Custo por lead · disparo x tráfego</h4><div class="cpl">
    <div><h5>📤 Disparos · API oficial</h5><span class="big">${cplTxt(gD,lD)} <small>por lead</small></span>
      ${gD>0?`Gasto: <b>${brlFull(gD)}</b>${q?` · <b>${num(q)}</b> disparos · <b>${brlFull(gQ/q)}</b> por disparo`:' · quantidade de disparos não informada'}<br>
      ${lD!=null?`<b>${num(lD)}</b> leads entraram${q&&lD?` · <b>${(lD/q*100).toFixed(1).replace('.',',')}%</b> dos disparos viraram conversa`:''}${pD?`<br>Custo por contrato pago: <b>${brlFull(gD/pD)}</b> (${pD} pagos)`:''}`:'Leads: ainda não dá para separar dos de tráfego'}`:'Nenhum gasto de disparo lançado neste mês.'}</div>
    <div><h5>📣 Tráfego pago</h5><span class="big">${cplTxt(gT,lT)} <small>por lead</small></span>
      ${gT>0?`Gasto: <b>${brlFull(gT)}</b><br>${lT!=null?`<b>${num(lT)}</b> leads entraram${pT?`<br>Custo por contrato pago: <b>${brlFull(gT/pT)}</b> (${pT} pagos)`:''}`:'Leads: ainda não dá para separar dos de disparo'}`:'Nenhum gasto de tráfego lançado neste mês.'}</div></div>
    <div class="ag-nota">${temOrig?'Disparos: só entram os clientes que vieram da API oficial (os chips não têm custo por mensagem). Tráfego: clientes que entraram pelo número de tráfego.':(gD>0&&gT>0?'⚠️ Há gasto nos dois canais e os números de WhatsApp ainda não estão marcados como "disparo" ou "tráfego", então não dá para saber de onde veio cada lead. Isso é resolvido quando os números forem ligados.':'Enquanto só um canal tem gasto, todos os clientes do mês são atribuídos a ele.')} O custo por lead considera só o gasto do próprio canal (números e BMs ficam de fora).</div>`;
  const G=D.gastos||[];
  document.getElementById('finLista').innerHTML=`<h4>🧾 Gastos do mês · ${G.length}</h4>${G.length?G.map(g=>{const c=FIN_CAT[g.categoria]||FIN_CAT.outros,dt=String(g.data).slice(8,10)+'/'+String(g.data).slice(5,7);
      return `<div class="fg"><span class="dt">${dt}</span><span class="ds">${c[0]} ${c[1]}${g.descricao||g.quantidade?`<small>${g.quantidade?Number(g.quantidade).toLocaleString('pt-BR')+' disparos'+(g.descricao?' · ':''):''}${esc(g.descricao||'')}</small>`:''}</span><b>${brlFull(g.valor)}</b><button title="Apagar" aria-label="Apagar gasto" onclick="finApagar('${g.id}','${dt} · ${c[1]} · ${brlFull(g.valor)}')">🗑</button></div>`;}).join(''):'<div class="vazio">Nenhum gasto lançado neste mês.</div>'}`;
  document.getElementById('finHist').innerHTML=`<h4>📅 Últimos 6 meses</h4><table class="fh"><thead><tr><th>Mês</th><th>Comissão</th><th>Gastos</th><th>Lucro</th></tr></thead><tbody>${(D.historico||[]).map(h=>{const l=Number(h.receita)-Number(h.gastos);
      return `<tr><td>${nomeMes(h.mes).replace(' de ',' ')}</td><td>${brl(h.receita)}</td><td>${brl(h.gastos)}</td><td style="font-weight:700;color:${l>=0?'#0f7a4f':'#b42318'}">${l<0?'−':''}${brl(Math.abs(l))}</td></tr>`;}).join('')}</tbody></table>
    <div class="ag-nota">Comissão = contratos pagos no mês. A comissão prevista (contratos ainda não pagos: ${brlFull(D.prevista)}) não entra no lucro.</div>`;
}

