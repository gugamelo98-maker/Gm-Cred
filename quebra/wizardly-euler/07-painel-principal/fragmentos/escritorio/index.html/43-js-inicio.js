// ═════════════ INÍCIO ═════════════
// consulta 1x por minuto; pausa quando a aba está escondida e atualiza na hora quando ela volta
let timer=null;
function agendar(){clearTimeout(timer);if(document.hidden)return;timer=setTimeout(async()=>{await atualizar();agendar();},demo?DEMO_MS:POLL_MS);}
document.addEventListener('visibilitychange',()=>{if(!document.hidden){atualizar();}agendar();});
const TELAS=['escritorio','pipeline','v8','disparo','oficial','hoje','clientes','indicacoes','conversas','links','numeros','bms','maturador','mes','funil','agentes','financeiro','simulacao'];
let telaAtual=TELAS.find(t=>location.hash==='#tela-'+t)||'hoje';
// menu em grupos: WhatsApp reúne Campanha, Números e Maturador; no celular, Análise fica em "Mais"
const GRUPO_WPP=['numeros','bms','maturador','agentes','indicacoes','financeiro','simulacao'],ANALISE=['v8','links','disparo','oficial','mes','funil'].concat(GRUPO_WPP);
const PG={hoje:['Início','Resumo do dia em números'],v8:['Consulta V8, Unno e HUB','Margem e simulação direto nos bancos'],escritorio:['Escritório','Empresa virtual · agentes de IA'],pipeline:['Pipeline','Clientes por etapa do atendimento'],links:['Links','Ferramentas e páginas da GM Cred'],conversas:['Conversas','WhatsApp de todos os números'],clientes:['Clientes','Todos que já entraram no escritório'],disparo:['Disparo','Envio em massa pelos números de disparo'],oficial:['API oficial','Disparo por mensagem modelo da Meta'],bms:['BMs da Meta','Conexões da API oficial: número, WABA e token'],mes:['Vendas','Meta do mês e vendas por dia'],funil:['Funil','Onde os clientes avançam e onde param'],numeros:['Configurações','Números de WhatsApp'],maturador:['Configurações','Maturador'],agentes:['Configurações','Agentes de IA'],indicacoes:['Configurações','Indicações'],financeiro:['Configurações','Financeiro'],simulacao:['Configurações','Simulação']};
// o Chrome tratava qualquer campo do painel como "usuário" e ficava sugerindo/pedindo para salvar senha: só a tela de login fica com senha
function semSenhaSalva(raiz){(raiz||document).querySelectorAll('input:not([type=password]):not([autocomplete=username]),textarea').forEach(e=>{if(e.getAttribute('autocomplete')!=='off')e.setAttribute('autocomplete','off');e.setAttribute('data-1p-ignore','');e.setAttribute('data-lpignore','true');e.setAttribute('data-form-type','other');});}
semSenhaSalva();try{new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===1)semSenhaSalva(n.matches&&n.matches('input,textarea')?n.parentNode:n);}).observe(document.body,{childList:true,subtree:true});}catch(e){}
function alternarTema(){const e=document.documentElement.dataset.tema==='escuro';if(e)delete document.documentElement.dataset.tema;else document.documentElement.dataset.tema='escuro';lsSet('escritorio_tema',e?'':'escuro');const m=document.querySelector('meta[name=theme-color]');if(m)m.content=e?'#ffffff':'#18181a';}
function alternarMenu(){const m=document.body.classList.toggle('menu-mini');lsSet('escritorio_menu',m?'mini':'');}
if(lsGet('escritorio_menu')==='mini')document.body.classList.add('menu-mini');
let ultimaWpp=lsGet('escritorio_wpp');if(!GRUPO_WPP.includes(ultimaWpp))ultimaWpp='numeros';
function abrirMais(){document.getElementById('maisVeu').classList.add('on');}
function fecharMais(){document.getElementById('maisVeu').classList.remove('on');}
document.addEventListener('keydown',e=>{if(e.key==='Escape')fecharMais();});
/* ===== Consulta V8 (margem + simulação direto no banco) ===== */
let v8C=null,v8Lim=[],v8Seq=0,v8SimSeq=0;
const v8$=id=>document.getElementById(id);
const v8Num=v=>{v=String(v||'').replace(/[^\d.,]/g,'');if(v.includes(',')||/^\d{1,3}(\.\d{3})+$/.test(v))v=v.replace(/\./g,'').replace(',','.');return Number(v)||0;};
const v8Msg=t=>{v8$('v8Msg').textContent=t||'';},v8SimMsg=t=>{v8$('v8SimMsg').textContent=t||'';};
['v8Msg','unnoMsg','hubMsg'].forEach(i=>{const el=v8$(i);new MutationObserver(()=>el.classList.toggle('err',/⚠|inválid|precisa ter|disponível só|não achou/i.test(el.textContent))).observe(el,{childList:true,characterData:true,subtree:true});});
function v8FmtCpf(c){c=String(c||'').replace(/\D/g,'').slice(0,11);return c.replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/,'.$1-$2');}
v8$('v8Cpf').addEventListener('input',e=>{e.target.value=v8FmtCpf(e.target.value);});
v8$('v8Nasc').addEventListener('input',e=>{let v=e.target.value.replace(/\D/g,'').slice(0,8);e.target.value=v.replace(/^(\d{2})(\d)/,'$1/$2').replace(/^(\d{2})\/(\d{2})(\d)/,'$1/$2/$3');});
/* o servidor às vezes devolve corpo vazio (executor do n8n ocupado): tenta de novo até 3 vezes antes de desistir */
async function apiTenta(rota,acao,cpf,dados){
  let ult='resposta vazia';
  for(let t=0;t<3;t++){
    let r;
    try{r=await fetch(BASE+rota,{method:'POST',body:new URLSearchParams({k:chave,acao,cpf:cpf||'',dados:JSON.stringify(dados||{})})});}
    catch(e){ult=e.message||'sem conexão';await new Promise(x=>setTimeout(x,2500));continue;}
    if(r.status===401){pedirChave('Chave inválida ou desativada.');throw new Error('sem acesso');}
    if(r.ok){
      const tx=await r.text();
      if(tx){try{return JSON.parse(tx);}catch(e){ult='resposta inválida';}}
      else ult='resposta vazia';
    }else ult='HTTP '+r.status;
    await new Promise(x=>setTimeout(x,2500));}
  throw new Error(ult+' · tente de novo em instantes');}
async function v8Api(acao,cpf,dados){return apiTenta('/escritorio/v8',acao,cpf,dados);}
function v8PedeDados(on,txt){if(on){v8$('v8Extra').hidden=false;v8$('v8Dica').textContent=txt||'Não achei todos os dados desse CPF sozinho: preencha o que faltar e clique em Consultar de novo.';}}
let v8CpfAnt='';
v8$('v8Cpf').addEventListener('input',e=>{const c=e.target.value.replace(/\D/g,'');if(v8CpfAnt&&c!==v8CpfAnt){v8$('v8Extra').hidden=true;v8$('v8Salva').hidden=true;['v8Nome','v8Nasc','unnoFone','unnoEmail','hubSexo','hubCidade'].forEach(i=>{v8$(i).value='';});v8$('v8Dica').textContent='Digite só o CPF. Nome, nascimento, celular e e-mail são buscados sozinhos; se faltar algum, os campos aparecem aqui. O termo da Unno é assinado automaticamente.';v8CpfAnt='';}});
async function v8Consultar(ev,forcar){if(ev)ev.preventDefault();
  if(demo){v8Msg('Disponível só com o sistema ligado.');return;}
  if(!chave){pedirChave();return;}
  const cpf=v8$('v8Cpf').value.replace(/\D/g,'');
  if(cpf.length!==11){v8Msg('O CPF precisa ter 11 números.');return;}
  if(forcar){salvaLimpa(cpf);unnoApp='';unnoAppCpf='';hubApp='';hubAppCpf='';}
  else{const sv=salvaGet(cpf);if(sv&&(sv.v8C||sv.unnoApp||sv.hubApp)){salvaRestaurar(cpf,sv);return;}}
  v8$('v8Salva').hidden=true;v8$('v8Box').hidden=true;v8$('v8Ofertas').innerHTML='';
  const dados={},nm=v8$('v8Nome').value.trim(),nc=v8$('v8Nasc').value.trim();
  if(nm&&/^\d{2}\/\d{2}\/\d{4}$/.test(nc)){dados.nome=nm;dados.nascimento=nc;}
  v8Final=[];unnoOfs=[];hubOfs=[];v8$('melhorBox').hidden=true;v8CpfAnt=cpf;
  unnoConsultar(cpf);hubConsultar(cpf);
  const seq=++v8Seq;v8SimSeq++;v8C=null;v8Lim=[];v8$('v8SimBox').hidden=true;v8$('v8Ofertas').innerHTML='';v8$('v8Res').innerHTML='';
  const btn=v8$('v8Btn');btn.disabled=true;v8Msg('Consultando na V8…');
  try{
    let d=await v8Api('consultar_cpf',cpf,dados);
    for(let i=1;d&&['processando','sem_consulta'].includes(d.situacao)&&i<=36;i++){
      if(seq!==v8Seq)return;v8Msg('A V8 está processando a consulta… '+(i*5)+'s');
      await new Promise(r=>setTimeout(r,5000));if(seq!==v8Seq)return;
      d=await v8Api('status',cpf,{});}
    if(seq!==v8Seq)return;v8Mostrar(cpf,d||{});
  }catch(e){if(seq===v8Seq)v8Msg('⚠️ Não consegui consultar ('+e.message+').');}
  finally{if(seq===v8Seq)btn.disabled=false;}}
function v8Mostrar(cpf,d){
  const res=v8$('v8Res'),cab=(t)=>'<div class="v8-card">'+t+'</div>';
  const quem='<small>'+esc(d.nome||'')+(d.nome?' · ':'')+'CPF '+esc(v8FmtCpf(cpf))+'</small>';
  if(d.situacao==='com_margem'){
    v8PedeDados(false);v8Msg('');v8C={cpf,consult_id:d.consult_id,margem:Number(d.margem)||0,nome:d.nome||''};
    res.innerHTML=cab(quem+'<small>Margem disponível (parcela máxima por mês)</small><b class="big">'+brlFull(v8C.margem)+'</b>');
    salvaSet(cpf,{ts:Date.now(),v8C,v8Lim:[],v8Sim:null});
    v8$('v8Parc').placeholder='até '+v8C.margem.toFixed(2).replace('.',',');
    if(v8C.margem>0&&v8C.consult_id){v8$('v8SimBox').hidden=false;v8Opcoes('');v8Simular();}
    return;}
  if(d.situacao==='precisa_dados'){const t='A V8 não achou esse CPF sozinha: preencha nome completo e nascimento e clique em Consultar de novo.';v8PedeDados(true,t);v8Msg(t);return;}
  if(d.situacao==='sem_margem'){v8PedeDados(false);v8Msg('');res.innerHTML=cab(quem+'<b>Sem margem na V8</b>'+(d.descricao?'<small>'+esc(d.descricao)+'</small>':''));return;}
  if(d.situacao==='cpf_invalido'){v8Msg('CPF inválido. Confira os números.');return;}
  if(d.situacao==='processando'||d.situacao==='sem_consulta'){v8Msg('A V8 ainda está processando. Clique em Consultar de novo daqui a pouco.');return;}
  v8Msg('⚠️ A V8 respondeu com erro'+(d.erro?' ('+d.erro+')':'')+'. Tente de novo.');}
/* ===== Melhor proposta por comissão (V8 + Unno) ===== */
let v8Final=[],unnoOfs=[],hubOfs=[],comTab=null;
async function comCarregar(){if(comTab)return comTab;try{const d=await unnoApi('comissoes','',{});comTab=(d&&d.tabelas)||[];}catch(e){comTab=[];}return comTab;}
const comNorm=t=>String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase();
function comPct(banco,tabela,seguro,prazo){
  const rows=(comTab||[]).filter(r=>r.banco===banco&&r.seguro===seguro&&Number(r.parcelas)<=prazo&&(banco==='v8digital'||!tabela||comNorm(tabela).includes(String(r.tabela))));
  if(!rows.length)return null;rows.sort((a,b)=>b.parcelas-a.parcelas);return Number(rows[0].pct);}
async function melhorRender(){
  await comCarregar();
  const slug=b=>String(b||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,'');
  const todas=[];
  v8Final.forEach(o=>{const seg=o.seguro!==false,pct=comPct('v8digital','',seg,Number(o.prazo));todas.push({fonte:'V8',banco:'V8',logo:'v8',prazo:o.prazo,parcela:o.parcela,valor:o.valor,seg,pct});});
  unnoOfs.forEach(o=>{const seg=o.seguro!==false,b='unno:'+slug(o.banco),pct=comPct(b,o.tabela,seg,Number(o.prazo));todas.push({fonte:'Unno',logo:'unno',banco:'Unno'+(o.banco?' · '+o.banco:'')+(o.tabela?' · '+o.tabela:''),prazo:o.prazo,parcela:o.parcela,valor:o.valor,seg,pct});});
  hubOfs.forEach(o=>{const seg=o.seguro!==false,pct=comPct('hub:'+slug(o.banco),o.tabela,seg,Number(o.prazo));todas.push({fonte:'HUB',logo:'hub',banco:'HUB'+(o.banco?' · '+o.banco:'')+(o.tabela?' · '+o.tabela:''),prazo:o.prazo,parcela:o.parcela,valor:o.valor,seg,pct});});
  const box=v8$('melhorBox');if(!todas.length){box.hidden=true;return;}
  todas.forEach(o=>{o.com=o.pct==null?null:Math.round(o.valor*o.pct)/100;});
  todas.sort((a,b)=>(b.com==null?-1:b.com)-(a.com==null?-1:a.com)||(b.valor-a.valor));
  box.hidden=false;const m=todas[0];
  v8$('melhorRes').innerHTML=(m.com!=null?'<div class="v8-card"><small>'+esc(m.banco)+' · '+m.prazo+'x'+(m.seg?' com seguro':' sem seguro')+'</small><b class="big">Comissão '+brlFull(m.com)+'</b><small>Cliente recebe '+brlFull(m.valor)+' · parcela '+brlFull(m.parcela)+' · '+String(m.pct).replace('.',',')+'%</small></div>':'<div class="v8-lim">Sem tabela de comissão cadastrada para essas ofertas.</div>')
   +(()=>{const pz=l=>[...new Set(l)].sort((x,y)=>y-x).map(n=>n+'x').join(', ');const u=pz(unnoOfs.map(o=>Number(o.prazo)).filter(Boolean)),h=pz(hubOfs.map(o=>Number(o.prazo)).filter(Boolean)),v=pz(v8Lim.length?v8Lim:v8Final.map(o=>Number(o.prazo)));return '<div class="v8-lim"><b>Prazos liberados pelo banco</b>'+(v?'<br>V8: '+v:'')+(u?'<br>Unno: '+u:'')+(h?'<br>HUB: '+h:'')+'</div>';})()
   +'<table class="v8-tab"><thead><tr><th>Banco</th><th>Prazo</th><th>Liberado</th><th>Comissão</th></tr></thead><tbody>'+todas.map((o,i)=>'<tr><td>'+(i===0&&o.com!=null?'🏆 ':'')+'<img class="bk-logo" src="img/logo-'+o.logo+'.png" alt="" width="18" height="18">'+esc(o.banco)+'</td><td>'+o.prazo+'x'+(o.seg?'':' <small>sem seguro</small>')+'</td><td>'+brlFull(o.valor)+'</td><td><b>'+(o.com==null?'—':brlFull(o.com))+'</b></td></tr>').join('')+'</tbody></table>';}
/* ===== Unno (mesmo CPF da consulta V8) ===== */
let unnoSeq=0,unnoApp='',unnoAppCpf='';
async function unnoApi(acao,cpf,dados){return apiTenta('/escritorio/unno',acao,cpf,dados);}
v8$('unnoFone').addEventListener('input',e=>{let v=e.target.value.replace(/\D/g,'').slice(0,11);e.target.value=v.replace(/^(\d{2})(\d)/,'($1) $2').replace(/(\d{5})(\d{1,4})$/,'$1-$2');});
function cardsTabelas(tabs){
  const linha=(o,g)=>'<tr><td>'+(o.prazo?o.prazo+'x':'-')+(o.variante&&o.variante!==g.tabela?'<small>'+esc(o.variante)+'</small>':'')+'</td><td>'+(o.parcela?brlFull(o.parcela):'-')+'</td><td><b>'+brlFull(o.valor)+'</b></td></tr>';
  return tabs.map(g=>'<details class="un-tab"><summary><span class="un-nome">'+esc(g.tabela)+(g.banco?'<small>'+esc(g.banco)+'</small>':'')+'</span><span class="un-ap">a partir de<b>'+brlFull(g.a_partir_de)+'/mês</b></span><span class="un-ap">até<b>'+brlFull(g.max_valor)+'</b></span><span class="un-qtd">'+g.qtd+' oferta'+(g.qtd>1?'s':'')+'</span></summary><table class="v8-tab"><thead><tr><th>Prazo</th><th>Parcela</th><th>Valor liberado</th></tr></thead><tbody>'+g.ofertas.map(o=>linha(o,g)).join('')+'</tbody></table></details>').join('');}
function v8Cards(lista,parc,lim,erros,ajust){
  if(!lista.length)return '<div class="v8-card"><small>CPF '+esc(v8FmtCpf(v8C?v8C.cpf:''))+'</small><b>A V8 não aprovou essa simulação</b>'+(erros.length?'<small>'+esc([...new Set(erros)].join(' · '))+'</small>':'')+'</div>'+(lim?'<div class="v8-lim">Limites do banco para este CPF: '+esc(lim)+'</div>':'');
  const tabs=['sem','com'].map(k=>{const os=lista.filter(o=>(o.seguro===false)===(k==='sem')).sort((a,b)=>a.prazo-b.prazo||b.valor-a.valor);
    return os.length?{tabela:k==='sem'?'Sem seguro':'Com seguro',banco:'V8 · CLT Acelera',a_partir_de:Math.min(...os.map(o=>o.parcela)),max_valor:Math.max(...os.map(o=>o.valor)),qtd:os.length,ofertas:os}:null;}).filter(Boolean).sort((a,b)=>b.max_valor-a.max_valor);
  const menor=lista.some(o=>Number(o.parcela)<parc-0.01);
  return '<div class="v8-card"><small>CPF '+esc(v8FmtCpf(v8C?v8C.cpf:''))+'</small><b>Ofertas da V8</b><small>Simulado com parcela de '+brlFull(parc)+(ajust?' (limite da margem da V8)':'')+'</small><small>'+tabs.length+' tabela'+(tabs.length>1?'s':'')+' · toque para ver as ofertas de cada uma</small></div>'+cardsTabelas(tabs)
    +(menor?'<div class="v8-lim">O banco não aceitou a parcela cheia em algum prazo, então a V8 simulou com a parcela menor que aparece na tabela.</div>':'')
    +(lim?'<div class="v8-lim">Limites do banco para este CPF: '+esc(lim)+'</div>':'');}
function unnoMostrar(d){
  const box=v8$('unnoRes'),msg=v8$('unnoMsg');msg.textContent='';
  const quem='<small>CPF '+esc(v8FmtCpf(unnoAppCpf))+'</small>';
  if(d.situacao==='aguardando_termo'||d.situacao==='termo_assinado'||d.situacao==='processando'){box.innerHTML='<div class="v8-card">'+quem+'<b>Consultando na Unno…</b></div>';return;}
  if(d.situacao==='sem_margem'){box.innerHTML='<div class="v8-card">'+quem+'<b>Sem margem na Unno</b></div>';return;}
  if(d.situacao==='sem_ofertas'){box.innerHTML='<div class="v8-card">'+quem+'<b>A Unno não liberou oferta para este CPF</b></div>';return;}
  if(d.situacao==='ofertas'){
    unnoOfs=(d.ofertas||[]).slice();melhorRender();
    const tabs=Array.isArray(d.tabelas)&&d.tabelas.length?d.tabelas:[{tabela:'Ofertas',banco:'',a_partir_de:Math.min(...(d.ofertas||[]).map(o=>o.parcela||Infinity)),max_valor:Math.max(...(d.ofertas||[]).map(o=>o.valor||0)),qtd:(d.ofertas||[]).length,ofertas:(d.ofertas||[]).slice().sort((a,b)=>(a.prazo-b.prazo)||(b.valor-a.valor))}];
    const nota=d.parcela_usada?'<small>Simulado com parcela de '+brlFull(d.parcela_usada)+(d.ajustada?' (limite da margem da Unno)':'')+'</small>':'';
    box.innerHTML='<div class="v8-card">'+quem+'<b>Ofertas da Unno</b>'+nota+'<small>'+tabs.length+' tabela'+(tabs.length>1?'s':'')+' · toque para ver as ofertas de cada uma</small></div>'+cardsTabelas(tabs);return;}
  if(d.situacao==='precisa_dados'){v8PedeDados(true,(d.erro||'Faltam dados do cliente.')+' Preencha os campos e clique em Consultar de novo.');box.innerHTML='<div class="v8-lim">'+esc(d.erro||'')+'</div>';return;}
  box.innerHTML='<div class="v8-lim">⚠️ '+(d.erro&&d.situacao==='erro'&&/^Não consegui liberar/.test(d.erro)?esc(d.erro):'A Unno respondeu com erro'+(d.erro?' ('+esc(d.erro)+')':'')+'.')+'</div>';}
async function unnoConsultar(cpf){
  const seq=++unnoSeq,box=v8$('unnoBox');box.hidden=false;v8$('unnoRes').innerHTML='';
  const dados={nome:v8$('v8Nome').value.trim(),nascimento:v8$('v8Nasc').value.trim(),celular:v8$('unnoFone').value.trim(),email:v8$('unnoEmail').value.trim()};
  const retomar=unnoApp&&unnoAppCpf===cpf;unnoAppCpf=cpf;
  try{
    v8$('unnoMsg').textContent=retomar?'Conferindo a solicitação na Unno…':'Abrindo na Unno…';
    let d=retomar?await unnoApi('status',cpf,{application_id:unnoApp}):await unnoApi('abrir',cpf,dados);
    if(seq!==unnoSeq)return;if(d.application_id){unnoApp=d.application_id;salvaSet(cpf,{unnoApp});v8$('v8SimBox').hidden=false;}
    if(!d.ok&&d.situacao==='precisa_dados'){unnoApp='';unnoMostrar(d);return;}
    let semTermo=0;
    for(let i=0;i<120&&d.ok&&['aguardando_termo','termo_assinado','processando'].includes(d.situacao);i++){
      if(d.situacao==='aguardando_termo'&&++semTermo>6){unnoMostrar({ok:false,situacao:'erro',erro:'Não consegui liberar a consulta automaticamente. Clique em Consultar de novo.'});return;}
      unnoMostrar(d);await new Promise(r=>setTimeout(r,5000));if(seq!==unnoSeq)return;
      d=await unnoApi('status',cpf,{application_id:unnoApp});if(seq!==unnoSeq)return;}
    if(d.ok&&d.situacao==='ofertas'){d=await unnoOfertasEspera(cpf,v8Num(v8$('v8Parc').value)||'',seq);if(!d||seq!==unnoSeq)return;if(d.situacao==='ofertas')salvaSet(cpf,{unnoApp,unnoD:d});}
    if(['sem_margem','sem_ofertas','erro'].includes(d.situacao)){unnoApp='';salvaSet(cpf,{unnoApp:''});}
    unnoMostrar(d);
  }catch(e){if(seq===unnoSeq)v8$('unnoMsg').textContent='⚠️ Não consegui consultar a Unno ('+e.message+').';}}
function v8Opcoes(sel){const s=v8$('v8Prazo');
  s.innerHTML='<option value="">36x e 24x (padrão)</option><option value="99">Maior prazo liberado'+(v8Lim.length?' ('+v8Lim[0]+'x)':'')+'</option><option value="todos">Todos os prazos liberados</option>'+v8Lim.map(p=>'<option value="'+p+'">'+p+'x</option>').join('');
  s.value=sel||'';if(s.value!==(sel||''))s.value='';}
async function v8Simular(ev){if(ev)ev.preventDefault();if(!v8C)return;
  let parc=v8Num(v8$('v8Parc').value)||v8C.margem,ajust=false;
  if(parc>v8C.margem+0.001){parc=Math.floor(v8C.margem*100)/100;ajust=true;}
  const pz=v8$('v8Prazo').value,seq=++v8SimSeq,out=v8$('v8Ofertas');
  v8$('v8Box').hidden=false;out.innerHTML='<div class="v8-card"><b>Simulando na V8…</b></div>';
  const base={consult_id:v8C.consult_id,margem:v8C.margem,parcela:parc};let lista=[],lim='',erros=[];
  const roda=async p=>{const d=await v8Api('simular','',Object.assign({},base,{prazo:p}));if(d.limites)lim=d.limites;(d.ofertas||[]).forEach(o=>lista.push(o));(d.erros||[]).forEach(e=>e&&erros.push(e));};
  const leLim=()=>{if(lim)v8Lim=[...new Set([...lim.matchAll(/(\d+)x/g)].map(m=>+m[1]))].sort((a,b)=>b-a);};
  try{
    if(pz==='todos'){if(!v8Lim.length){await roda('');leLim();}lista=[];erros=[];const ps=v8Lim.slice();
      for(let i=0;i<ps.length;i+=3){if(seq!==v8SimSeq)return;v8SimMsg('V8: simulando '+Math.min(i+3,ps.length)+' de '+ps.length+' prazos…');await Promise.all(ps.slice(i,i+3).map(p=>roda(String(p))));}}
    else await roda(pz);
    if(seq!==v8SimSeq)return;leLim();v8Opcoes(pz);
    const vis={};lista=lista.filter(o=>{const k=o.prazo+'|'+o.parcela+'|'+o.seguro;if(vis[k])return false;vis[k]=1;return o.valor>0;}).sort((a,b)=>(b.prazo-a.prazo)||(b.valor-a.valor));
    out.innerHTML=v8Cards(lista,parc,lim,erros,ajust);v8SimMsg('');v8Final=lista.slice();melhorRender();
    salvaSet(v8C.cpf,{v8Lim,v8Sim:{lista,parc,lim,erros,ajust}});
  }catch(e){if(seq===v8SimSeq){out.innerHTML='<div class="v8-lim">⚠️ Não consegui simular na V8 ('+esc(e.message)+'). Se a consulta for antiga, clique em Refazer consulta.</div>';}}}
async function unnoOfertasEspera(cpf,parc,seq){
  let d=await unnoApi('ofertas',cpf,{application_id:unnoApp,parcela:parc||''});
  for(let i=0;i<40&&d&&(d.pendente===true||d.situacao==='processando');i++){
    if(seq!==unnoSeq)return null;await new Promise(r=>setTimeout(r,4000));if(seq!==unnoSeq)return null;
    d=await unnoApi('ofertas',cpf,{application_id:unnoApp});}
  return d;}
async function unnoSimular(parc){if(!unnoApp)return;const cpf=unnoAppCpf,seq=++unnoSeq;
  v8$('unnoBox').hidden=false;v8$('unnoRes').innerHTML='<div class="v8-card"><small>CPF '+esc(v8FmtCpf(cpf))+'</small><b>Simulando na Unno…</b></div>';
  try{
    const d=await unnoOfertasEspera(cpf,parc,seq);if(!d||seq!==unnoSeq)return;
    if(d.situacao==='ofertas'){salvaSet(cpf,{unnoApp,unnoD:d});}
    else if(d.situacao==='erro'){unnoApp='';salvaSet(cpf,{unnoApp:'',unnoD:null});v8$('unnoRes').innerHTML='<div class="v8-lim">⚠️ A consulta da Unno expirou. Clique em Refazer consulta.</div>';return;}
    unnoMostrar(d);
  }catch(e){if(seq===unnoSeq)v8$('unnoRes').innerHTML='<div class="v8-lim">⚠️ Não consegui simular na Unno ('+esc(e.message)+').</div>';}}
/* ===== HUB (CLT, mesmo CPF da consulta) ===== */
let hubSeq=0,hubApp='',hubAppCpf='';
async function hubApi(acao,cpf,dados){
  /* o servidor às vezes devolve corpo vazio (executor do n8n ocupado): tenta de novo até 3 vezes antes de desistir */
  let ult='resposta vazia';
  for(let t=0;t<3;t++){
    let r;
    try{r=await fetch(BASE+'/escritorio/hub',{method:'POST',body:new URLSearchParams({k:chave,acao,cpf:cpf||'',dados:JSON.stringify(dados||{})})});}
    catch(e){ult=e.message||'sem conexão';await new Promise(x=>setTimeout(x,2500));continue;}
    if(r.status===401){pedirChave('Chave inválida ou desativada.');throw new Error('sem acesso');}
    if(r.ok){
      const tx=await r.text();
      if(tx){try{return JSON.parse(tx);}catch(e){ult='resposta inválida';}}
      else ult='resposta vazia';
    }else ult='HTTP '+r.status;
    await new Promise(x=>setTimeout(x,2500));}
  throw new Error(ult+' · tente de novo em instantes');}
function hubMostrar(d){
  const box=v8$('hubRes'),msg=v8$('hubMsg');msg.textContent='';
  const quem='<small>CPF '+esc(v8FmtCpf(hubAppCpf))+'</small>';
  if(d.situacao==='processando'){box.innerHTML='<div class="v8-card">'+quem+'<b>Consultando na HUB…</b></div>';return;}
  if(d.situacao==='aguardando_termo'){box.innerHTML='<div class="v8-card">'+quem+'<b>A HUB precisa da autorização do cliente</b><small>O cliente precisa aceitar o termo de consulta da HUB. Depois de aceitar, clique em Refazer consulta.</small><small><a href="'+esc(d.link_termo||'https://termo.hubcredito.com.br/')+'" target="_blank" rel="noopener">Abrir o termo da HUB</a></small></div>';return;}
  if(d.situacao==='sem_margem'){box.innerHTML='<div class="v8-card">'+quem+'<b>Sem margem na HUB</b>'+(d.erro?'<small>'+esc(d.erro)+'</small>':'')+'</div>';return;}
  if(d.situacao==='sem_ofertas'){box.innerHTML='<div class="v8-card">'+quem+'<b>A HUB não liberou oferta para este CPF</b></div>';return;}
  if(d.situacao==='ofertas'){
    hubOfs=(d.ofertas||[]).slice();melhorRender();
    const tabs=Array.isArray(d.tabelas)&&d.tabelas.length?d.tabelas:[];
    const nota=d.parcela_usada?'<small>Simulado com parcela de '+brlFull(d.parcela_usada)+(d.ajustada?' (limite da margem da HUB)':'')+'</small>':'';
    box.innerHTML='<div class="v8-card">'+quem+'<b>Ofertas da HUB</b>'+nota+'<small>'+tabs.length+' tabela'+(tabs.length>1?'s':'')+' · toque para ver as ofertas de cada uma</small></div>'+cardsTabelas(tabs);return;}
  if(d.situacao==='precisa_dados'){const falta=d.falta||[];
    if(falta.length&&falta.every(x=>['sexo','cidade'].includes(x))&&!hubAutoFeito[hubAppCpf]){
      hubAutoFeito[hubAppCpf]=1;hubPreencheAuto(d.nome);hubApp='';
      box.innerHTML='<div class="v8-card">'+quem+'<b>Consultando na HUB…</b></div>';
      hubConsultar(hubAppCpf||v8$('v8Cpf').value.replace(/\D/g,''));return;}
    box.innerHTML='<div class="v8-card">'+quem+'<b>A HUB precisa de mais dados</b><small>Preencha aqui e consulte. A parcela digitada em Simular parcela já vale para a HUB.</small>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">'
      +(falta.includes('sexo')?'<select id="hubSexo2" style="padding:8px;border:1px solid var(--bd);border-radius:8px;background:var(--bg2,#fff);color:var(--tx)"><option value="">Sexo</option><option value="M">Masculino</option><option value="F">Feminino</option></select>':'')
      +(falta.includes('cidade')?'<input id="hubCidade2" placeholder="Cidade do cliente" autocomplete="off" style="padding:8px;border:1px solid var(--bd);border-radius:8px;min-width:170px;background:var(--bg2,#fff);color:var(--tx)">':'')
      +(falta.some(x=>!['sexo','cidade'].includes(x))?'<small>Também falta: '+esc(falta.filter(x=>!['sexo','cidade'].includes(x)).join(', '))+' (preencha acima e consulte de novo).</small>':'')
      +'<button class="bt pri" onclick="hubDadosOk()">Consultar na HUB</button></div></div>';return;}
  box.innerHTML='<div class="v8-lim">⚠️ A HUB respondeu com erro'+(d.erro?' ('+esc(d.erro)+')':'')+'.</div>';}
function hubDadosOk(){const s=document.getElementById('hubSexo2'),c=document.getElementById('hubCidade2');
  if(s&&!s.value){v8$('hubMsg').textContent='Escolha o sexo do cliente.';return;}if(c&&!c.value.trim()){v8$('hubMsg').textContent='Digite a cidade do cliente.';return;}
  if(s)v8$('hubSexo').value=s.value;if(c)v8$('hubCidade').value=c.value.trim();hubApp='';hubConsultar(hubAppCpf||v8$('v8Cpf').value.replace(/\D/g,''));}
/* HUB: sexo pelo nome e cidade padrão (a HUB exige, o cliente não precisa informar) */
const HUB_CIDADE_PADRAO='Florianópolis';
function hubSexoDoNome(nome){
  const p=String(nome||'').trim().split(/\s+/)[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(!p)return 'M';
  const homemA=['luca','lucca','joshua','jonata','mica','costa','sacha','nikita','gianluca','elias','tobias','matias','jonas','lucas','tomas','andre','jose'];
  const mulher=['isabel','raquel','rachel','beatriz','ester','esther','ruth','carmen','miriam','mirian','ingrid','iris','lis','liz','jaqueline','jacqueline','michele','michelle','aline','eliane','elaine','daiane','daniele','suelen','sueli','simone','solange','josiane','viviane','adriane','ariane','karine','karen','kelly','keli','kelli','cristiane','cristine','rosangela','rosane','rosemeire','rosimeire','marlene','marilene','irene','lourdes','nazare','neide','neuza','ines','valdete','dulce','cleide','claudete','edinete','ivone','yvone','denise','elisete','lucimar','tais','thais','ana','luz','nair','nadir','vilma','jussara','lidiane','sheila','shirley','sirlei','solene'];
  if(mulher.includes(p))return 'F';
  if(homemA.includes(p))return 'M';
  if(/a$/.test(p))return 'F';
  if(/(ane|ine|iane|eli|ely|elly|ele|ice|ete|ise|ize|ede|ilde|aine|ysse|eide|essa)$/.test(p))return 'F';
  return 'M';}
function hubPreencheAuto(nome){
  if(!v8$('hubSexo').value)v8$('hubSexo').value=hubSexoDoNome(nome||v8$('v8Nome').value);
  if(!v8$('hubCidade').value.trim())v8$('hubCidade').value=HUB_CIDADE_PADRAO;}
const hubAutoFeito={};
async function hubConsultar(cpf){
  const seq=++hubSeq,box=v8$('hubBox');box.hidden=false;v8$('hubRes').innerHTML='';
  hubPreencheAuto();
  const dados={nome:v8$('v8Nome').value.trim(),nascimento:v8$('v8Nasc').value.trim(),celular:v8$('unnoFone').value.trim(),email:v8$('unnoEmail').value.trim(),sexo:v8$('hubSexo').value,cidade:v8$('hubCidade').value.trim()};
  const retomar=hubApp&&hubAppCpf===cpf;hubAppCpf=cpf;
  try{
    v8$('hubMsg').textContent=retomar?'Conferindo a pré-simulação na HUB…':'Abrindo na HUB…';
    let d=retomar?await hubApi('status',cpf,{presim_id:hubApp}):await hubApi('abrir',cpf,dados);
    if(seq!==hubSeq)return;
    if(d.presim_id){hubApp=String(d.presim_id);salvaSet(cpf,{hubApp});v8$('v8SimBox').hidden=false;}
    if(!d.ok&&d.situacao==='precisa_dados'){hubApp='';hubMostrar(d);return;}
    for(let i=0;i<60&&d.ok&&d.situacao==='processando';i++){
      hubMostrar(d);await new Promise(r=>setTimeout(r,5000));if(seq!==hubSeq)return;
      d=await hubApi('status',cpf,{presim_id:hubApp});if(seq!==hubSeq)return;}
    if(d.ok&&d.situacao==='pronto'){d=await hubApi('simular',cpf,{presim_id:hubApp,parcela:v8Num(v8$('v8Parc').value)||''});if(seq!==hubSeq)return;if(d.situacao==='ofertas')salvaSet(cpf,{hubApp,hubD:d});}
    if(['aguardando_termo','sem_margem','sem_ofertas','erro'].includes(d.situacao)||(!d.ok&&d.situacao==='erro')){hubApp='';salvaSet(cpf,{hubApp:''});}
    hubMostrar(d);
  }catch(e){if(seq===hubSeq)v8$('hubMsg').textContent='⚠️ Não consegui consultar a HUB ('+e.message+').';}}
async function hubSimular(parc){if(!hubApp)return;const cpf=hubAppCpf,seq=++hubSeq;
  v8$('hubBox').hidden=false;v8$('hubRes').innerHTML='<div class="v8-card"><small>CPF '+esc(v8FmtCpf(cpf))+'</small><b>Simulando na HUB…</b></div>';
  try{
    const d=await hubApi('simular',cpf,{presim_id:hubApp,parcela:parc||''});if(seq!==hubSeq)return;
    if(d.situacao==='ofertas')salvaSet(cpf,{hubApp,hubD:d});
    else if(d.situacao==='erro'||d.situacao==='aguardando_termo'){hubApp='';salvaSet(cpf,{hubApp:'',hubD:null});}
    hubMostrar(d);
  }catch(e){if(seq===hubSeq)v8$('hubRes').innerHTML='<div class="v8-lim">⚠️ Não consegui simular na HUB ('+esc(e.message)+').</div>';}}
function simularAmbos(ev){if(ev)ev.preventDefault();
  if(!v8C&&!unnoApp&&!hubApp){v8SimMsg('Faça a consulta do CPF primeiro.');return;}
  const parc=v8Num(v8$('v8Parc').value);v8SimMsg('');
  if(v8C)v8Simular();
  if(unnoApp)unnoSimular(parc);
  if(hubApp)hubSimular(parc);}
/* ===== Consulta salva por CPF (neste navegador) ===== */
const SALVA_KEY='gm_consultas_v1',SALVA_TTL=3*3600*1000;
function salvaTudo(){try{return JSON.parse(localStorage.getItem(SALVA_KEY)||'{}')||{};}catch(e){return{};}}
function salvaGet(cpf){const e=salvaTudo()[cpf];return e&&Date.now()-e.ts<SALVA_TTL?e:null;}
function salvaSet(cpf,patch){if(!cpf)return;try{const t=salvaTudo(),e=Object.assign(t[cpf]||{ts:Date.now()},patch);t[cpf]=e;
  const ks=Object.keys(t).sort((a,b)=>t[b].ts-t[a].ts).slice(0,30);const n={};ks.forEach(k=>{n[k]=t[k];});localStorage.setItem(SALVA_KEY,JSON.stringify(n));}catch(e){}}
function salvaLimpa(cpf){try{const t=salvaTudo();delete t[cpf];localStorage.setItem(SALVA_KEY,JSON.stringify(t));}catch(e){}}
function salvaAviso(e){const el=v8$('v8Salva'),h=new Date(e.ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  el.innerHTML='Consulta salva de '+h+' · é só digitar a parcela e simular.<a onclick="v8Consultar(null,true)">Refazer consulta</a>';el.hidden=false;}
function salvaRestaurar(cpf,e){
  v8Seq++;v8SimSeq++;unnoSeq++;hubSeq++;v8CpfAnt=cpf;hubOfs=[];hubApp=e.hubApp||'';hubAppCpf=hubApp?cpf:'';v8Msg('');v8$('v8Res').innerHTML='';v8Final=[];unnoOfs=[];
  v8C=e.v8C||null;v8Lim=e.v8Lim||[];unnoApp=e.unnoApp||'';unnoAppCpf=unnoApp?cpf:'';
  if(v8C){v8$('v8Res').innerHTML='<div class="v8-card"><small>'+esc(v8C.nome||'')+(v8C.nome?' · ':'')+'CPF '+esc(v8FmtCpf(cpf))+'</small><small>Margem disponível (parcela máxima por mês)</small><b class="big">'+brlFull(v8C.margem)+'</b></div>';v8Opcoes('');}
  v8$('v8Box').hidden=!(e.v8Sim);
  if(e.v8Sim){v8Final=(e.v8Sim.lista||[]).slice();v8$('v8Ofertas').innerHTML=v8Cards(e.v8Sim.lista||[],e.v8Sim.parc,e.v8Sim.lim,e.v8Sim.erros||[],e.v8Sim.ajust);}
  v8$('hubBox').hidden=!(e.hubD);if(e.hubD){v8$('hubRes').innerHTML='';hubMostrar(e.hubD);}
  v8$('unnoBox').hidden=!(e.unnoD);
  if(e.unnoD){v8$('unnoRes').innerHTML='';unnoMostrar(e.unnoD);}
  v8$('v8SimBox').hidden=!(v8C||unnoApp||hubApp);melhorRender();salvaAviso(e);
  if(v8Num(v8$('v8Parc').value))simularAmbos();}
function irPara(v){telaAtual=TELAS.includes(v)?v:'escritorio';lsSet('escritorio_tela',telaAtual);try{history.replaceState(null,'','#tela-'+telaAtual);}catch(e){}
  TELAS.forEach(t=>{document.getElementById('v-'+t).hidden=telaAtual!==t;});
  const ehWpp=GRUPO_WPP.includes(telaAtual);if(ehWpp){ultimaWpp=telaAtual;lsSet('escritorio_wpp',telaAtual);}
  document.getElementById('wppTabs').hidden=!ehWpp;
  document.querySelectorAll('.wseg button').forEach(b=>{const on=b.dataset.w===telaAtual;b.classList.toggle('on',on);b.setAttribute('aria-selected',on);});
  document.querySelectorAll('.mais-grid [data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===telaAtual));
  document.querySelectorAll('.nv').forEach(b=>{const on=b.dataset.v===telaAtual||(b.dataset.v==='config'&&ehWpp)||(b.dataset.v==='mais'&&ANALISE.includes(telaAtual));b.classList.toggle('on',on);b.setAttribute('aria-current',on?'page':'false');});
  fecharMais();
  {const t=PG[telaAtual]||PG.escritorio;document.getElementById('pgTit').textContent=t[0];document.getElementById('pgSub').textContent=t[1];}
  window.scrollTo(0,0);if(telaAtual==='escritorio')setTimeout(posicionarClientes,30);if(telaAtual==='mes')setTimeout(renderVendas,30);if(telaAtual==='clientes')renderCrm();if(telaAtual==='agentes')renderAgentes();if(!demo&&chave&&faltaParte())atualizar();if(telaAtual==='financeiro')finCarregar();if(telaAtual==='disparo')dpCarregar();if(telaAtual==='oficial')ofCarregar();if(telaAtual==='pipeline')renderPipeline();if(telaAtual==='bms')bmCarregar();cvLigar(telaAtual==='conversas');if(telaAtual==='indicacoes')inCarregar();nmLigar(telaAtual==='numeros'||telaAtual==='maturador');}
irPara(telaAtual);
atualizar();agendar();
</script>
