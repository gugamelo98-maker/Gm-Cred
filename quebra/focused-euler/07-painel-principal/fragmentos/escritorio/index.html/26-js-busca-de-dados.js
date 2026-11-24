// ═════════════ BUSCA DE DADOS ═════════════
let verTeste=lsGet('escritorio_teste')==='1';
const PARTES={clientes:'crm',hoje:'crm',funil:'crm',agentes:'crm,agentes'};   // o que cada tela precisa além do básico
function partesDaTela(){return (typeof telaAtual!=='undefined'&&PARTES[telaAtual])||'nada';}
function faltaParte(){const p=partesDaTela();return (p.includes('crm')&&estado.crm==null)||(p.includes('agentes')&&!estado.agentes_dados);}
function alternarTestes(){verTeste=!verTeste;lsSet('escritorio_teste',verTeste?'1':'0');estado.crm=null;estado.agentes_dados=null;renderCrm();atualizar();}
async function atualizar(){
  const tb=document.getElementById('tstBtn');tb.hidden=demo;tb.className='tst'+(verTeste?' on':'');tb.textContent=verTeste?'🧪 Com testes':'🧪 Sem testes';
  if(demo){if(!demoState)demoInit();aplicarEstado(demoTick());ultimaAtualizacao=Date.now();setConn();return;}
  if(!chave){conectado=false;ultimoErro='sem chave';pedirChave();setConn();return;}
  try{const r=await fetch(ENDPOINT+(ENDPOINT.includes('?')?'&':'?')+'k='+encodeURIComponent(chave)+'&teste='+(verTeste?'1':'0')+'&partes='+partesDaTela(),{cache:'no-store'});
    if(r.status===401){chave='';lsSet('escritorio_token','');conectado=false;ultimoErro='chave inválida';pedirChave('Chave inválida ou desativada.');setConn();return;}
    if(!r.ok)throw new Error('HTTP '+r.status);aplicarEstado(await r.json());conectado=true;ultimoErro=null;ultimaAtualizacao=Date.now();}
  catch(e){conectado=false;ultimoErro=e.message;}
  setConn();
}
function setConn(){
  const b=document.getElementById('connBtn'),a=document.getElementById('aviso');
  if(demo){b.className='conn demo';b.lastChild.textContent='Demonstração';a.style.display='block';a.innerHTML='<b>Modo demonstração</b>: clientes e números fictícios. Toque em “Demonstração” no topo para voltar aos dados reais.';return;}
  if(!chave){b.className='conn off';b.lastChild.textContent='Bloqueado';a.style.display='block';a.innerHTML='🔒 Digite a <b>chave de acesso</b> para ver os dados reais, ou toque em “Bloqueado” para ver a demonstração.';return;}
  b.className='conn '+(conectado?'on':'off');b.lastChild.textContent=conectado?'Ao vivo':'Offline';
  if(!conectado){a.style.display='block';a.innerHTML='Sem conexão com o servidor ('+esc(ultimoErro||'…')+'). Tentando de novo em 1 minuto.';}
  else if(!estado.leads.length){a.style.display='block';a.innerHTML='Escritório aberto e equipe a postos, mas <b>sem clientes no momento</b>. Eles aparecem aqui assim que os agentes começarem a atender.';}
  else a.style.display='none';
}
function pedirChave(msg){if(demo)return;const L=document.getElementById('login');document.getElementById('chaveErr').textContent=msg||'';L.classList.add('on');setTimeout(()=>{try{document.getElementById('chaveIn').focus();}catch(e){}},50);}
async function entrar(){const v=document.getElementById('chaveIn').value.trim(),err=document.getElementById('chaveErr');if(!v){err.textContent='Digite a chave.';return;}
  err.textContent='Entrando…';
  try{const r=await fetch(BASE+'/escritorio/login',{method:'POST',body:new URLSearchParams({k:v})});const j=await r.json().catch(()=>({}));
    if(!r.ok||!j.token){err.textContent=r.status===401?'Chave inválida.':'Não foi possível entrar (HTTP '+r.status+').';return;}
    chave=j.token;lsSet('escritorio_token',chave);err.textContent='';
  }catch(e){err.textContent='Sem conexão com o servidor.';return;}
  document.getElementById('login').classList.remove('on');document.getElementById('chaveIn').value='';if(demo){demo=false;lsSet('escritorio_demo','0');demoState=null;estruturaKey='';document.getElementById('clientes').innerHTML='';cliEls.clear();}atualizar();agendar();}
function verDemo(){document.getElementById('login').classList.remove('on');if(!demo)toggleDemo();}
setInterval(()=>{const u=document.getElementById('upd');if(!ultimaAtualizacao){u.textContent='';return;}const s=Math.round((Date.now()-ultimaAtualizacao)/1000);u.textContent='Atualizado há '+(s<60?s+'s':Math.floor(s/60)+' min');},5000);
function toggleDemo(){demo=!demo;setTimeout(agendar,0);lsSet('escritorio_demo',demo?'1':'0');demoState=null;estruturaKey='';document.getElementById('clientes').innerHTML='';cliEls.clear();atualizar();}

