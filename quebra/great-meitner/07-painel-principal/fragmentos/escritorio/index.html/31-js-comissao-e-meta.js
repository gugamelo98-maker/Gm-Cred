// ═════════════ COMISSÃO E META ═════════════
function renderFin(){renderHoje();renderMes();}
function linhaComissao(){const f=k=>estado.financeiro.find(x=>x.etapa===k)||{contratos:0,valor_liberado:0,comissao:0};
  const lnk=(k,txt)=>{const x=f(k),e=ETAPAS[k];return `<button class="lnk" onclick="abrirPainel('etapa:${k}')" title="${esc(e.desc)}">${e.icone} ${txt} <b>${brlFull(x.comissao)}</b> (${x.contratos})</button>`;};
  return `<div class="mt-com"><span>Comissão:</span>${lnk('aguardando_formalizacao','aguardando assinatura')}${lnk('formalizado','formalizada')}${lnk('pago','recebida no mês')}</div>`;}
function hojeISO(){return dataISO(new Date());}
let resP=lsGet('escritorio_resumo_p')||'hoje';
function resPeriodo(p){resP=p;lsSet('escritorio_resumo_p',p);renderHoje();}
const RES_SET=[['recepcao','Recepção','mandaram o CPF e tinham margem'],['simulacao','Simulação','receberam a proposta'],['vendas','Vendas','escolheram uma oferta'],['formalizacao','Formalização','assinaram'],['posvenda','Pós-venda','foram pagos'],['gerente','Recuperação','voltaram e avançaram']];
function pctTx(a,b){return b?Math.round(a/b*100)+'%':'—';}
function diaTx(d){const h=hojeISO();if(d===h)return 'Hoje';const o=new Date(h+'T12:00:00');o.setDate(o.getDate()-1);if(d===dataISO(o))return 'Ontem';const [a,m,dd]=d.split('-');return dd+'/'+m;}
function blocoDias(){const RV=estado.resumo_v2||{},D=RV.dias||[],h=D[0]||{dia:hojeISO(),campanha:{},ia:{}},C=h.campanha||{},I=h.ia||{},env=+C.enviadas||0;
  const camp=[['Mensagens enviadas',env,'1ª mensagem da campanha'],['Responderam',+C.responderam||0],['Confirmaram o CPF',+C.cpf||0],['Receberam a proposta',+C.proposta||0],['Link enviado',+C.link||0],['Foram pagos',+C.pagos||0]];
  const ia=[['💬','Mensagens recebidas dos clientes',I.recebidas],['🤖','Respostas da IA',I.respostas],['📤','Mensagens da campanha',I.campanha],['🔁','Mensagens de recuperação',I.recuperacao],['🧑','Mensagens do atendente (você)',I.atendente],['🧮','Clientes simulados',I.simulacoes],['📝','Propostas enviadas (link)',I.propostas],['✍️','Contratos assinados',I.assinaram],['✅','Contratos pagos',I.pagos]];
  const ant=D.slice(1).filter(d=>{const c=d.campanha||{},x=d.ia||{};return Object.values(c).some(v=>+v)||Object.values(x).some(v=>+v);});
  const tCamp=ant.length?`<details class="rs-hist"><summary>Dias anteriores</summary><div class="rs-tab"><table><tr><th>Dia</th><th>Enviadas</th><th>Responderam</th><th>CPF</th><th>Proposta</th><th>Link</th><th>Pagos</th><th>Sem WhatsApp</th></tr>${ant.map(d=>{const c=d.campanha||{},e=+c.enviadas||0;return `<tr><td>${diaTx(d.dia)}</td><td>${e}</td><td>${+c.responderam||0} <small>${pctTx(+c.responderam||0,e)}</small></td><td>${+c.cpf||0}</td><td>${+c.proposta||0}</td><td>${+c.link||0}</td><td>${+c.pagos||0}</td><td>${+c.sem_whatsapp||0}</td></tr>`;}).join('')}</table></div></details>`:'';
  const tIa=ant.length?`<details class="rs-hist"><summary>Dias anteriores</summary><div class="rs-tab"><table><tr><th>Dia</th><th>Recebidas</th><th>Respostas IA</th><th>Campanha</th><th>Recuperação</th><th>Atendente</th><th>Simulados</th><th>Links</th><th>Assinados</th><th>Pagos</th></tr>${ant.map(d=>{const x=d.ia||{};return `<tr><td>${diaTx(d.dia)}</td>${['recebidas','respostas','campanha','recuperacao','atendente','simulacoes','propostas','assinaram','pagos'].map(k=>`<td>${+x[k]||0}</td>`).join('')}</tr>`;}).join('')}</table></div></details>`:'';
  return `<div class="fbox"><div class="rs-top"><h4>📤 Campanha de hoje</h4><span class="rs-nota" style="margin:0">${RV.campanha_ativa?'🟢 ligada':'⏸️ pausada'} · ${+RV.na_fila||0} na fila</span></div>
      <div class="rs-camp">${camp.map(([t,v],i)=>`<div><b>${v}</b><span>${t}</span><small>${i?pctTx(v,env)+' das enviadas':'hoje'}</small></div>`).join('')}</div>
      ${+C.sem_whatsapp?`<div class="rs-nota">🚫 ${C.sem_whatsapp} número${C.sem_whatsapp>1?'s':''} sem WhatsApp tirado${C.sem_whatsapp>1?'s':''} da fila hoje.</div>`:''}
      <div class="rs-nota">Cada dia conta os clientes que receberam a 1ª mensagem naquele dia. Se alguém responde amanhã, conta no dia em que recebeu a mensagem.</div>${tCamp}</div>
    <div class="fbox"><h4>🤖 Passo a passo da IA hoje</h4>
      <div class="rs-ia">${ia.map(([e,t,v])=>`<div><span>${e} ${t}</span><b>${+v||0}</b></div>`).join('')}</div>${tIa}</div>`;}
function renderHoje(){
  const el=document.getElementById('fin');if(!el)return;const M=estado.meta||{};
  const RV=(estado.resumo_v2||{})[resP==='hoje'?'hoje':resP]||{},N=RV.numeros||{},S=RV.setores||{},A=RV.agentes||[],C=RV.campanha||{};
  const nome={hoje:'hoje',d7:'nos últimos 7 dias',d30:'nos últimos 30 dias'}[resP];
  const meta=metaDia(),feito=Number(M.valor_hoje||0),pv=Math.min(100,Math.round(feito/meta*100)),bateu=feito>=meta;
  const chips=[['hoje','Hoje'],['d7','7 dias'],['d30','30 dias']].map(([k,t])=>`<button class="chip ${resP===k?'on':''}" onclick="resPeriodo('${k}')">${t}</button>`).join('');
  // conversão por departamento
  const linhas=RES_SET.map(([id,t,ok])=>{const x=S[id]||{},n=+x.atendidos||0,av=+x.avancaram||0,pe=+x.perderam||0,an=+x.andamento||0,fim=av+pe,pc=fim?Math.round(av/fim*100):null;return {id,t,ok,n,av,pe,an,pc};});
  const comPc=linhas.filter(l=>l.pc!=null&&l.av+l.pe>=3),pior=comPc.length>1?comPc.reduce((a,b)=>b.pc<a.pc?b:a):null;
  const dep=linhas.map(l=>`<div class="rs-dep ${pior&&pior.id===l.id?'pior':''}"><div class="rs-dn"><b>${l.t}</b><span>${l.n} atendido${l.n===1?'':'s'} · ${l.av} ${l.ok}${l.pe?` · ${l.pe} perdido${l.pe>1?'s':''}`:''}${l.an?` · ${l.an} em andamento`:''}</span></div>
      <div class="bar"><i style="width:${l.pc||0}%"></i></div><div class="rs-pc">${l.pc==null?'—':l.pc+'%'}</div></div>`).join('');
  // gargalos por agente
  const porSet={};A.forEach(a=>{(porSet[a.setor]=porSet[a.setor]||[]).push(a);});
  const garg=[];A.forEach(a=>{const set=RES_SET.find(r=>r[0]===a.setor),tn=set?set[1]:a.setor;
    if(a.esperando>0)garg.push([2,`<b>${esc(a.nome)}</b> (${tn} ${a.versao}): ${a.esperando} cliente${a.esperando>1?'s':''} esperando resposta dele agora`]);
    const fim=a.avancaram+a.perderam,lin=linhas.find(l=>l.id===a.setor);
    if(fim>=3&&lin&&lin.pc!=null){const pc=Math.round(a.avancaram/fim*100);if(pc<=lin.pc-15)garg.push([1,`<b>${esc(a.nome)}</b> (${tn} ${a.versao}): converte ${pc}%, o setor converte ${lin.pc}% (${a.perderam} perdido${a.perderam>1?'s':''} de ${fim})`]);}});
  garg.sort((a,b)=>b[0]-a[0]);
  // campanha
  el.innerHTML=`<div class="fbox"><div class="rs-top"><h4>📊 Resumo ${nome}</h4><div class="chips">${chips}</div></div>
      ${resP==='hoje'?`<div class="mt" onclick="abrirPainel('meta')" role="button" tabindex="0" style="margin-top:6px">
        <div class="mt-top"><span>🎯 Meta do dia${bateu?' · <span style="color:#0f7a4f">batida</span>':''}</span><b style="color:${bateu?'#16a36a':'var(--tx)'}">${brlFull(feito)}</b></div>
        <div class="meta-barra"><i style="width:${pv}%"></i></div>
        <div class="meta-linha"><span>liberado em contratos pagos hoje</span><b>${pv}% da meta de ${brl(meta)}${bateu?'':' · faltam '+brl(meta-feito)}</b></div></div>`:''}
      <div class="hj-kpis rs-kpis">
        <div><b>${N.entraram||0}</b><span>Clientes entraram</span></div>
        <div><b>${N.simularam||0}</b><span>Simulações feitas</span></div>
        <div><b>${N.propostas||0}</b><span>Propostas enviadas (link)</span></div>
        <div><b>${N.assinaram||0}</b><span>Assinaram</span></div>
        <div><b style="color:var(--verde)">${N.pagos||0}</b><span>Contratos pagos</span></div>
        <div><b style="color:var(--verde)">${brlFull(N.comissao||0)}</b><span>Comissão · ${brl(N.liberado||0)} liberados</span></div>
      </div></div>
    <div class="rs-grid">
      <div class="fbox"><h4>🏢 Quanto cada departamento converte</h4>${dep}
        <div class="rs-nota">% = avançaram ÷ (avançaram + perdidos). Quem ainda está em andamento não entra na conta.${pior?` <b style="color:#b42318">Em vermelho: o departamento que menos converte.</b>`:''}</div></div>
      <div class="fbox"><h4>⚠️ Gargalos nos agentes</h4>${garg.length?garg.map(g=>`<div class="rs-g ${g[0]===2?'urg':''}">${g[1]}</div>`).join(''):'<div class="vazio">Nenhum gargalo: nenhum cliente esperando resposta e nenhum agente bem abaixo do seu setor.</div>'}
        <button class="lnk-a" onclick="irPara('agentes')">ver todos os agentes →</button></div>
    </div>
    ${blocoDias()}`;
  const lstEl=document.getElementById('hojeListas');if(resP!=='hoje'){lstEl.innerHTML='';return;}
  const crmHoje=(estado.crm||[]).filter(c=>c.entrou&&dataISO(new Date(c.entrou))===hojeISO());
  const lst=document.getElementById('hojeListas');
  const pagos=estado.contratos.filter(c=>c.etapa==='pago'&&c.dt_pagamento&&dataISO(new Date(c.dt_pagamento))===hojeISO());
  lst.innerHTML=`<div class="hj-grid">
    <div class="fbox"><h4>✅ Pagos hoje · ${pagos.length}</h4>${pagos.length?pagos.map(itemContrato).join(''):'<div class="vazio">Nenhum contrato pago hoje ainda.</div>'}</div>
    <div class="fbox"><h4>👥 Clientes que entraram hoje · ${crmHoje.length}</h4>${crmHoje.length?crmHoje.slice(0,30).map(crmItem).join('')+(crmHoje.length>30?`<button class="lnk-a" onclick="irPara('clientes')">ver todos em Clientes →</button>`:''):'<div class="vazio">Ninguém entrou hoje ainda.</div>'}</div></div>`;
}
function renderMes(){
  const el=document.getElementById('mesBox');if(!el)return;
  const P=projecaoMes(),pm=Math.min(100,Math.round(P.realLib/P.metaMes*100)),pp=Math.min(100,Math.round(P.projLib/P.metaMes*100));
  el.innerHTML=`<div class="fbox"><div class="mt" title="Projeção: o que já foi liberado no mês + a média dos últimos 7 dias nos dias que faltam">
        <div class="mt-top"><span>📅 Meta do mês</span><b>${brlFull(P.realLib)}</b></div>
        <div class="meta-barra"><i style="width:${pm}%"></i>${P.projLib>P.realLib?`<s style="left:0;width:${pp}%"></s>`:''}</div>
        <div class="meta-linha"><span>${P.vazio?'ainda sem vendas este mês':`${P.realPag} contratos pagos · no ritmo atual fecha em <b>${brl(P.projLib)}</b> (${brl(P.projCom)} de comissão)`}</span><b>${pm}% da meta de ${brl(P.metaMes)}</b></div></div>${linhaComissao()}</div>`;
}
