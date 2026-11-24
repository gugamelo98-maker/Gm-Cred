// ═════════════ BUSCA DE DADOS ═════════════
async function atualizar(){
  if(demo){if(!demoState)demoInit();aplicarEstado(demoTick());setConn();return;}
  try{
    const r=await fetch(ENDPOINT,{cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const j=await r.json();
    conectado=true;ultimoErro=null;aplicarEstado(j);
  }catch(e){conectado=false;ultimoErro=e.message;}
  setConn();
}
function setConn(){
  const b=document.getElementById('connBtn'),bn=document.getElementById('banner');
  if(demo){b.className='conn demo';b.textContent='● DEMO';bn.style.display='block';bn.innerHTML='MODO DEMONSTRAÇÃO — dados fictícios.<br>Toque em DEMO para voltar aos dados reais.';return;}
  b.className='conn '+(conectado?'on':'off');b.textContent=conectado?'● AO VIVO':'● OFFLINE';
  if(!conectado){bn.style.display='block';bn.innerHTML='Sem conexão com o servidor ('+esc(ultimoErro||'...')+').<br>Tentando de novo a cada 5s.';}
  else if(!estado.leads.length){bn.style.display='block';bn.innerHTML='Escritório aberto, mas sem clientes no momento.<br>Os agentes aparecem aqui assim que começarem a atender.';}
  else bn.style.display='none';
}
function toggleDemo(){demo=!demo;lsSet('escritorio_demo',demo?'1':'0');demoState=null;leadSprites.clear();atualizar();}

let ultimoEventoId=null;
function aplicarEstado(j){
  estado={setores:j.setores||[],agentes:j.agentes||[],leads:j.leads||[],eventos:j.eventos||[],resumo:j.resumo||{},numeros:j.numeros||[],funil:j.funil||[]};
  const R=estado.resumo;
  document.getElementById('kAnd').textContent=R.em_andamento??0;
  document.getElementById('kEnt').textContent=R.entraram_hoje??0;
  document.getElementById('kFec').textContent=R.fecharam_hoje??0;
  document.getElementById('kCom').textContent=brl(R.comissao_hoje);
  document.getElementById('kPar').textContent=R.parados??0;
  const ev=estado.eventos[0];
  if(ev){document.getElementById('tickerTxt').textContent=hora(ev.criado_em)+' · '+ev.descricao;
    if(ultimoEventoId!==null&&ev.id!==ultimoEventoId&&ev.tipo==='fechou')celebrar(ev);ultimoEventoId=ev.id;}
  sincronizarSprites();buildSidebar();
  if(dashAberto)renderDash();
}

