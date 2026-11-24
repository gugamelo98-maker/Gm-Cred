// ═════════════ AGENTES (versões A/B/C) ═════════════
const SETOR_ORD=['recepcao','simulacao','vendas','formalizacao','posvenda','gerente'];
const SETOR_NOME={recepcao:'Recepção',simulacao:'Simulação',vendas:'Vendas',formalizacao:'Formalização',posvenda:'Pós-venda',gerente:'Recuperação'};
const SETOR_PASSO={recepcao:'mandaram o CPF e tinham margem',simulacao:'receberam a proposta (as ofertas)',vendas:'escolheram uma oferta',formalizacao:'assinaram o contrato',posvenda:'foram pagos',gerente:'voltaram a conversar e avançaram uma etapa'};
const MIN_AMOSTRA=10;
const SETOR_COL={recepcao:'Mandaram CPF com margem',simulacao:'Receberam a proposta',vendas:'Escolheram uma oferta',formalizacao:'Assinaram',posvenda:'Foram pagos',gerente:'Voltaram e avançaram'};
let agF={dias:30,teste:true,par:['recepcao','vendas']};
try{const v=JSON.parse(lsGet('escritorio_agf')||'null');if(v)agF={...agF,...v};}catch(e){}
function agSalvar(){lsSet('escritorio_agf',JSON.stringify(agF));renderAgentes();}
function agJ(){const D=estado.agentes_dados||{},lim=Date.now()-agF.dias*86400000;return (D.jornadas||[]).filter(j=>new Date(j.e).getTime()>=lim);}
function agLista(){return (estado.agentes_dados&&estado.agentes_dados.agentes)||[];}
function assinou(j){return j.g==='pago'||(j.et>=5&&j.g!=='perdido');}
function seguiu(j,set){const r=j.a&&j.a[set]&&j.a[set][1];if(set==='formalizacao')return assinou(j);if(set==='posvenda')return j.g==='pago';return r==='avancou'||r==='recuperou';}
function pc(a,b){return b?Math.round(a/b*100):null;}
function pcT(v){return v==null?'—':v+'%';}
function statsAg(ag,J){const L=J.filter(j=>j.a&&j.a[ag.setor]&&j.a[ag.setor][0]===ag.id),n=L.length;
  const seg=L.filter(j=>seguiu(j,ag.setor)).length,aqui=L.filter(j=>!seguiu(j,ag.setor));
  const sm=aqui.filter(j=>j.g==='sem_margem').length,perd=aqui.filter(j=>j.g==='perdido').length,ab=aqui.filter(j=>j.g==='andamento').length;
  const ass=L.filter(assinou).length,pag=L.filter(j=>j.g==='pago').length,tm=n?Math.round(L.reduce((a,j)=>a+(j.a[ag.setor][2]||0),0)/n):0;
  const paradas={};aqui.filter(j=>j.g!=='andamento').forEach(j=>paradas[j.s]=(paradas[j.s]||0)+1);
  const baseSeg=n-sm-ab;   // sem margem não é culpa do agente; quem ainda está em aberto não conta
  return{n,seg,perd,sm,ab,ass,pag,tm,paradas,L,tSeg:pc(seg,baseSeg),tPerd:pc(perd,baseSeg),tAss:pc(ass,n-sm),tPag:pc(pag,n-sm)};}
function renderAgentes(){
  const el=document.getElementById('agSetores');if(!el||(typeof telaAtual!=='undefined'&&telaAtual!=='agentes'))return;
  const J=agJ(),A=agLista();
  document.getElementById('agChips').innerHTML=[7,30,90].map(d=>`<button class="chip ${agF.dias===d?'on':''}" onclick="agF.dias=${d};agSalvar()">${d} dias</button>`).join('');
  const res=document.getElementById('agResumo'),cmb=document.getElementById('agCombos');
  if(!estado.agentes_dados){res.innerHTML='';el.innerHTML='<div class="fbox" style="grid-column:1/-1"><div class="vazio">Carregando…</div></div>';cmb.innerHTML='';return;}
  if(!A.length||!J.length){res.innerHTML='';el.innerHTML='<div class="fbox" style="grid-column:1/-1"><div class="vazio">Ainda não há clientes no período. Assim que os agentes atenderem, a comparação entre as versões A, B e C aparece aqui.</div></div>';cmb.innerHTML='';return;}
  const VEN=['recepcao','simulacao','vendas','formalizacao'];
  const setores=SETOR_ORD.map(set=>{const st=A.filter(a=>a.setor===set).map(a=>({a,s:statsAg(a,J)}));
    const val=st.filter(x=>x.s.tSeg!=null).sort((x,y)=>y.s.tSeg-x.s.tSeg||y.s.n-x.s.n);
    const L=J.filter(j=>j.a&&j.a[set]),perd=L.filter(j=>!seguiu(j,set)&&j.g==='perdido').length;
    return{set,st,best:val[0]||null,ok:st.length>0&&st.every(x=>x.s.n>=MIN_AMOSTRA),n:L.length,tPerd:pc(perd,L.length)};});
  // resumo: 3 frases
  const pior=setores.filter(x=>x.set!=='gerente'&&x.n>=MIN_AMOSTRA).sort((a,b)=>(b.tPerd||0)-(a.tPerd||0))[0];
  const confi=setores.filter(l=>VEN.includes(l.set)).every(l=>l.ok&&l.best);
  const est=setores.filter(l=>VEN.includes(l.set)).reduce((m,l)=>m*((l.best?l.best.s.tSeg:0)/100),1);
  const base=J.filter(j=>j.g!=='sem_margem'),hoje=pc(base.filter(assinou).length,base.length);
  res.innerHTML=`<div><span class="big">${J.length}</span>clientes atendidos nos últimos ${agF.dias} dias${verTeste&&!demo?' (com testes)':''} · <b>${pcT(hoje)}</b> assinaram</div>
    <div><span class="big" style="color:#b42318">${pior?SETOR_NOME[pior.set]:'—'}</span>${pior?`é onde mais perdemos: <b>${pior.tPerd}%</b> dos clientes param lá`:'ainda poucos dados para saber onde perdemos mais'}</div>
    <div><span class="big" style="color:#0f7a4f">${confi?Math.round(est*100)+'%':'⏳'}</span>${confi?`assinariam se todos passassem pelo <b>time ideal</b> (hoje: ${pcT(hoje)})`:'o time ideal ainda está sendo testado: faltam clientes em alguns setores'}</div>`;
  // 6 cartões
  el.innerHTML=setores.map((x,i)=>{const b=x.best,cls=x.ok?'':'testando';
    return `<div class="tc"><div class="tc-top"><h4>${i+1} · ${SETOR_NOME[x.set]}</h4><span>${x.n} clientes${x.set!=='gerente'&&x.tPerd!=null?' · '+x.tPerd+'% param aqui':''}</span></div>
      ${b?`<div class="tc-win ${cls}" onclick="abrirPainel('agente:${b.a.id}')" title="Ver detalhes"><span class="lt">${esc(b.a.versao)}</span><div class="nm"><b>${esc(b.a.nome)}</b><small>${esc(b.a.abordagem||'')}</small></div><span class="sel">${x.ok?'🏆 melhor':'⏳ testando'}</span></div>`:'<div class="vazio">Sem dados ainda.</div>'}
      <div class="tc-v">${x.st.map(({a,s})=>`<span class="vn" onclick="abrirPainel('agente:${a.id}')"><span class="vtag">${esc(a.versao)}</span>${esc(a.nome)}</span><span class="br"><i class="${b&&b.a.id===a.id?'win':''}" style="width:${s.tSeg||0}%"></i></span><span class="pv" title="${s.n} clientes">${pcT(s.tSeg)}</span>`).join('')}</div>
      <div class="tc-ft">% que ${esc(SETOR_PASSO[x.set])}${x.ok?'':' · menos de '+MIN_AMOSTRA+' clientes por versão'}</div></div>`;}).join('');
  // ranking de times reais (Recepção → Simulação → Vendas): ordenado por QUANTOS assinaram (desempate: pagos)
  const T3=['recepcao','simulacao','vendas'],grp={};
  J.filter(j=>j.g!=='sem_margem'&&j.a&&T3.every(x=>j.a[x])).forEach(j=>{const k=T3.map(x=>{const ag=A.find(a=>a.id===j.a[x][0]);return ag?ag.versao:'·';}).join('');const g=(grp[k]=grp[k]||{n:0,as:0,pg:0});g.n++;if(assinou(j))g.as++;if(j.g==='pago')g.pg++;});
  const top=Object.entries(grp).map(([k,v])=>({k,...v})).sort((a,b)=>b.as-a.as||b.pg-a.pg||a.n-b.n);
  const nomeT=k=>k.split('').map((v,i)=>{const ag=A.find(a=>a.setor===T3[i]&&a.versao===v);return ag?`<span class="vtag">${v}</span>${esc(ag.nome)}`:'—';}).join(' → ');
  const linha=(x,pos)=>`<div class="rk"><span class="pos">${pos}</span><span class="cam">${nomeT(x.k)}</span><span class="tx">${x.as} <small>${x.as===1?'assinou':'assinaram'}</small> · ${x.pg} <small>${x.pg===1?'pago':'pagos'}</small></span></div>`;
  cmb.innerHTML=`<div class="fbox"><h4>🧭 Times que mais assinaram · Recepção → Simulação → Vendas</h4>${top.length?top.slice(0,3).map((x,i)=>linha(x,['🥇','🥈','🥉'][i])).join('')+(top.length>3?linha(top[top.length-1],'👎'):''):'<div class="vazio">Ainda não há clientes que chegaram até Vendas.</div>'}
    <div class="ag-nota">Ordenado pela quantidade de contratos assinados no período (empate: quem tem mais pagos).</div></div>`;
}
function painelAgente(id){const a=agLista().find(x=>x.id===id);if(!a){fecharPainel();return;}const s=statsAg(a,agJ());
  gTit.innerHTML=`<span class="vtag">${esc(a.versao)}</span>${esc(a.nome)} · ${esc(SETOR_NOME[a.setor]||a.setor)}`;gSub.textContent=(a.abordagem||'')+' · últimos '+agF.dias+' dias'+(verTeste&&!demo?' (com testes)':'');
  const P=Object.entries(s.paradas).sort((x,y)=>y[1]-x[1]);
  const cli=s.L.slice(0,60).map(j=>(estado.crm||[]).find(c=>c.id===j.l)||{id:j.l,nome:'Cliente #'+j.l,situacao:j.s,grupo:j.g,telefone:'',entrou:j.e});
  gCorpo.innerHTML=`<div class="g-kpis"><div><b>${s.n}</b><span>Clientes atendidos</span></div><div><b style="color:#0f7a4f">${pcT(s.tSeg)}</b><span>${SETOR_COL[a.setor]}</span></div>
      <div><b style="color:#b42318">${pcT(s.tPerd)}</b><span>Pararam aqui</span></div><div><b>${s.n?tempo(s.tm):'—'}</b><span>Tempo médio no setor</span></div></div>
    <div class="g-sec">Onde os clientes pararam com ${esc(a.nome)} · ${P.reduce((x,y)=>x+y[1],0)}</div>
    ${P.length?P.map(([t,n])=>`<div class="mot"><span>${esc(t)}</span><b>${n}</b></div>`).join(''):'<div class="vazio">Nenhum cliente parou aqui.</div>'}
    <div class="g-sec">Clientes atendidos · ${s.n}</div>${cli.length?cli.map(crmItem).join(''):'<div class="vazio">Nenhum cliente no período.</div>'}`;}

