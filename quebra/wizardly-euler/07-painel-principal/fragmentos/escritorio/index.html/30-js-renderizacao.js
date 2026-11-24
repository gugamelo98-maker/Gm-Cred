// ═════════════ RENDERIZAÇÃO ═════════════
let ultimoEventoId=null,estruturaKey='';
function aplicarEstado(j){
  estado={setores:j.setores||[],agentes:j.agentes||[],leads:j.leads||[],eventos:j.eventos||[],resumo:j.resumo||{},numeros:j.numeros||[],funil:j.funil||[],financeiro:j.financeiro||[],meta:j.meta||null,contratos:j.contratos||[],atencao:j.atencao||[],saude:j.saude||{},simulacao:j.simulacao||null,vendas:j.vendas||[],resumo_v2:j.resumo_v2||null,crm:j.crm!==undefined?j.crm:(estado.crm===undefined?null:estado.crm),agentes_dados:j.agentes_dados!==undefined?j.agentes_dados:(estado.agentes_dados||null)};
  const R=estado.resumo;
  kAnd.textContent=R.em_andamento??0;kPag.textContent=(estado.meta&&estado.meta.contratos_hoje)||0;
  renderFin();renderAtencao();renderFunil();renderPipeline();renderSaude();renderSimulacao();renderVendas();renderCrm();renderAgentes();kPar.textContent=R.parados??0;
  const ev=estado.eventos[0];
  if(ev){tickerTxt.textContent=hora(ev.criado_em)+' · '+ev.descricao;if(ultimoEventoId!==null&&ev.id!==ultimoEventoId&&ev.tipo==='fechou')festa(ev.lead_id);ultimoEventoId=ev.id;}
  const key=estado.setores.map(s=>s.id+s.cor).join('|')+'#'+estado.agentes.map(a=>a.id+a.setor_id+(a.versao||'')).join('|');
  if(key!==estruturaKey){montarSalas();estruturaKey=key;}
  atualizarSalas();posicionarClientes();
  if(painelAberto&&painelAberto.startsWith('agente:'))painelAgente(Number(painelAberto.slice(7)));
  else if(painelAberto&&!painelAberto.startsWith('cliente:'))renderPainel();
}
function montarSalas(){
  salas.innerHTML=estado.setores.map(s=>{
    const ags=agentesDe(s.id),pos=POSTOS[ags.length]||[50];
    return `<section class="sala" id="sala-${s.id}" tabindex="0" onclick="abrirPainel('${s.id}')" onkeydown="if(event.key==='Enter')abrirPainel('${s.id}')">
      <div class="sala-topo"><span class="cor" style="background:${s.cor}"></span><h2>${esc(s.nome)}</h2><span class="alerta" hidden></span><span class="cnt">0</span></div>
      <div class="cena">${cenaFundo(s)}
        ${ags.length?ags.map((ag,i)=>`<div class="posto p${ags.length}" style="left:${pos[i]}%"><div class="agente" id="ag-${ag.id}">${avatarAgente(ag)}</div><div class="mesa" id="mesa-${ag.id}">${mesaSvg(s,false)}</div><span class="nome-ag">${ag.versao?`<span class="vl">${esc(ag.versao)}</span>`:''}${esc(ag.nome)}${ags.length===1&&ag.papel?' · '+esc(ag.papel):''}</span></div>`).join('')+'<span class="tag livre">DISPONÍVEL</span>'
          :'<div class="posto" style="left:50%"><div class="mesa">'+mesaSvg(s,false)+'</div></div>'}
        <div class="balao"></div>
      </div>
    </section>`;}).join('');
}
function atualizarSalas(){
  estado.setores.forEach(s=>{
    const el=document.getElementById('sala-'+s.id);if(!el)return;
    const ags=agentesDe(s.id);
    const cnt=el.querySelector('.cnt'),al=el.querySelector('.alerta'),tag=el.querySelector('.tag'),bal=el.querySelector('.balao');
    const ger=s.id==='gerente';const par=ger?(estado.resumo.parados||0):s.leads_parados;
    cnt.textContent=ger?(estado.resumo.em_andamento||0)+' na empresa':s.leads_ativos+(s.leads_ativos===1?' cliente':' clientes');
    al.hidden=!par;al.textContent='⚠ '+par+(par===1?' parado':' parados');
    const comCliente=new Set(estado.leads.filter(l=>l.setor_id===s.id).map(l=>l.agente_id));
    let algum=false;
    ags.forEach(ag=>{const trab=(ag.status||'livre')==='trabalhando'||comCliente.has(ag.id)||(ger&&par>0);algum=algum||trab;
      const agEl=document.getElementById('ag-'+ag.id);if(agEl)agEl.classList.toggle('trabalhando',trab);
      const me=document.getElementById('mesa-'+ag.id);if(me&&me.dataset.on!==String(trab)){me.innerHTML=mesaSvg(s,trab);me.dataset.on=String(trab);}});
    if(tag){tag.className='tag '+(ger&&par?'alerta':algum?'trabalhando':'livre');tag.textContent=ger&&par?'RESGATANDO CLIENTES':algum?'TRABALHANDO':'DISPONÍVEL';}
    const ev=estado.eventos.find(e=>ger?(e.tipo==='perdeu'||e.tipo==='fechou'):(e.setor_destino===s.id||e.setor_origem===s.id));
    if(ger){bal.innerHTML=par?`${par} cliente${par>1?'s':''} ${par>1?'estão':'está'} esperando a nossa resposta além do prazo. Vamos cobrar os setores.`:'Tudo em dia. Nenhum cliente parado.';bal.classList.add('on');}
    else if(ev){bal.innerHTML=`<b>${hora(ev.criado_em)}</b> · ${esc(ev.descricao)}`;bal.classList.add('on');}
    else bal.classList.remove('on');
  });
}

