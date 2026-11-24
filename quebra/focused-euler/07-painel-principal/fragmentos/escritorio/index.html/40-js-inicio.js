// ═════════════ INÍCIO ═════════════
// consulta 1x por minuto; pausa quando a aba está escondida e atualiza na hora quando ela volta
let timer=null;
function agendar(){clearTimeout(timer);if(document.hidden)return;timer=setTimeout(async()=>{await atualizar();agendar();},demo?DEMO_MS:POLL_MS);}
document.addEventListener('visibilitychange',()=>{if(!document.hidden){atualizar();}agendar();});
const TELAS=['escritorio','v8','disparo','oficial','hoje','clientes','indicacoes','conversas','campanha','numeros','maturador','mes','funil','agentes','financeiro','simulacao'];
let telaAtual=TELAS.find(t=>location.hash==='#tela-'+t)||'hoje';
// menu em grupos: WhatsApp reúne Campanha, Números e Maturador; no celular, Análise fica em "Mais"
const GRUPO_WPP=['numeros','maturador','agentes','indicacoes','financeiro','simulacao'],ANALISE=['v8','campanha','disparo','oficial','mes','funil'].concat(GRUPO_WPP);
const PG={hoje:['Início','Resumo do dia em números'],v8:['Consulta V8 e Unno','Margem e simulação direto nos bancos'],escritorio:['Escritório','Empresa virtual · agentes de IA'],conversas:['Conversas','WhatsApp de todos os números'],clientes:['Clientes','Todos que já entraram no escritório'],campanha:['Campanha','Prospecção pelo WhatsApp'],disparo:['Disparo','Envio em massa pelos números de disparo'],oficial:['API oficial','Disparo por mensagem modelo da Meta'],mes:['Vendas','Meta do mês e vendas por dia'],funil:['Funil','Onde os clientes avançam e onde param'],numeros:['Configurações','Números de WhatsApp'],maturador:['Configurações','Maturador'],agentes:['Configurações','Agentes de IA'],indicacoes:['Configurações','Indicações'],financeiro:['Configurações','Financeiro'],simulacao:['Configurações','Simulação']};
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
function v8FmtCpf(c){c=String(c||'').replace(/\D/g,'').slice(0,11);return c.replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/,'.$1-$2');}
v8$('v8Cpf').addEventListener('input',e=>{e.target.value=v8FmtCpf(e.target.value);});
v8$('v8Nasc').addEventListener('input',e=>{let v=e.target.value.replace(/\D/g,'').slice(0,8);e.target.value=v.replace(/^(\d{2})(\d)/,'$1/$2').replace(/^(\d{2})\/(\d{2})(\d)/,'$1/$2/$3');});
async function v8Api(acao,cpf,dados){
  const r=await fetch(BASE+'/escritorio/v8',{method:'POST',body:new URLSearchParams({k:chave,acao,cpf:cpf||'',dados:JSON.stringify(dados||{})})});
  if(r.status===401){pedirChave('Chave inválida ou desativada.');throw new Error('sem acesso');}
  if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}
function v8PedeDados(on){if(on)v8$('v8Dica').textContent='A V8 não achou esse CPF sozinha: preencha nome completo e nascimento e clique em Consultar de novo.';}
async function v8Consultar(ev){if(ev)ev.preventDefault();
  if(demo){v8Msg('Disponível só com o sistema ligado.');return;}
  if(!chave){pedirChave();return;}
  const cpf=v8$('v8Cpf').value.replace(/\D/g,'');
  if(cpf.length!==11){v8Msg('O CPF precisa ter 11 números.');return;}
  const dados={},nm=v8$('v8Nome').value.trim(),nc=v8$('v8Nasc').value.trim();
  if(nm&&/^\d{2}\/\d{2}\/\d{4}$/.test(nc)){dados.nome=nm;dados.nascimento=nc;}
  v8Final=[];unnoOfs=[];v8$('melhorBox').hidden=true;
  unnoConsultar(cpf);
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
    if(v8C.margem>0&&v8C.consult_id){v8$('v8SimBox').hidden=false;v8$('v8Parc').value=v8C.margem.toFixed(2).replace('.',',');v8Opcoes('');v8Simular();}
    return;}
  if(d.situacao==='precisa_dados'){v8PedeDados(true);v8Msg('A V8 não achou esse CPF sozinha: preencha nome completo e nascimento e clique em Consultar de novo.');return;}
  if(d.situacao==='sem_margem'){v8PedeDados(false);v8Msg('');res.innerHTML=cab(quem+'<b>Sem margem na V8</b>'+(d.descricao?'<small>'+esc(d.descricao)+'</small>':''));return;}
  if(d.situacao==='cpf_invalido'){v8Msg('CPF inválido. Confira os números.');return;}
  if(d.situacao==='processando'||d.situacao==='sem_consulta'){v8Msg('A V8 ainda está processando. Clique em Consultar de novo daqui a pouco.');return;}
  v8Msg('⚠️ A V8 respondeu com erro'+(d.erro?' ('+d.erro+')':'')+'. Tente de novo.');}
/* ===== Melhor proposta por comissão (V8 + Unno) ===== */
let v8Final=[],unnoOfs=[],comTab=null;
async function comCarregar(){if(comTab)return comTab;try{const d=await unnoApi('comissoes','',{});comTab=(d&&d.tabelas)||[];}catch(e){comTab=[];}return comTab;}
const comNorm=t=>String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase();
function comPct(banco,tabela,seguro,prazo){
  const rows=(comTab||[]).filter(r=>r.banco===banco&&r.seguro===seguro&&Number(r.parcelas)<=prazo&&(banco==='v8digital'||!tabela||comNorm(tabela).includes(String(r.tabela))));
  if(!rows.length)return null;rows.sort((a,b)=>b.parcelas-a.parcelas);return Number(rows[0].pct);}
async function melhorRender(){
  await comCarregar();
  const slug=b=>String(b||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,'');
  const todas=[];
  v8Final.forEach(o=>{const seg=o.seguro!==false,pct=comPct('v8digital','',seg,Number(o.prazo));todas.push({fonte:'V8',banco:'V8',prazo:o.prazo,parcela:o.parcela,valor:o.valor,seg,pct});});
  unnoOfs.forEach(o=>{const seg=o.seguro!==false,b='unno:'+slug(o.banco),pct=comPct(b,o.tabela,seg,Number(o.prazo));todas.push({fonte:'Unno',banco:'Unno'+(o.banco?' · '+o.banco:'')+(o.tabela?' · '+o.tabela:''),prazo:o.prazo,parcela:o.parcela,valor:o.valor,seg,pct});});
  const box=v8$('melhorBox');if(!todas.length){box.hidden=true;return;}
  todas.forEach(o=>{o.com=o.pct==null?null:Math.round(o.valor*o.pct)/100;});
  todas.sort((a,b)=>(b.com==null?-1:b.com)-(a.com==null?-1:a.com)||(b.valor-a.valor));
  box.hidden=false;const m=todas[0];
  v8$('melhorRes').innerHTML=(m.com!=null?'<div class="v8-card"><small>'+esc(m.banco)+' · '+m.prazo+'x'+(m.seg?' com seguro':' sem seguro')+'</small><b class="big">Comissão '+brlFull(m.com)+'</b><small>Cliente recebe '+brlFull(m.valor)+' · parcela '+brlFull(m.parcela)+' · '+String(m.pct).replace('.',',')+'%</small></div>':'<div class="v8-lim">Sem tabela de comissão cadastrada para essas ofertas.</div>')
   +(()=>{const pz=l=>[...new Set(l)].sort((x,y)=>y-x).map(n=>n+'x').join(', ');const u=pz(unnoOfs.map(o=>Number(o.prazo)).filter(Boolean)),v=pz(v8Lim.length?v8Lim:v8Final.map(o=>Number(o.prazo)));return '<div class="v8-lim"><b>Prazos liberados pelo banco</b>'+(v?'<br>V8: '+v:'')+(u?'<br>Unno: '+u:'')+'</div>';})()
   +'<table class="v8-tab"><thead><tr><th>Banco</th><th>Prazo</th><th>Liberado</th><th>Comissão</th></tr></thead><tbody>'+todas.map((o,i)=>'<tr><td>'+(i===0&&o.com!=null?'🏆 ':'')+esc(o.banco)+'</td><td>'+o.prazo+'x'+(o.seg?'':' <small>sem seguro</small>')+'</td><td>'+brlFull(o.valor)+'</td><td><b>'+(o.com==null?'—':brlFull(o.com))+'</b></td></tr>').join('')+'</tbody></table>';}
/* ===== Unno (mesmo CPF da consulta V8) ===== */
let unnoSeq=0,unnoApp='',unnoAppCpf='';
async function unnoApi(acao,cpf,dados){
  const r=await fetch(BASE+'/escritorio/unno',{method:'POST',body:new URLSearchParams({k:chave,acao,cpf:cpf||'',dados:JSON.stringify(dados||{})})});
  if(r.status===401){pedirChave('Chave inválida ou desativada.');throw new Error('sem acesso');}
  if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}
v8$('unnoFone').addEventListener('input',e=>{let v=e.target.value.replace(/\D/g,'').slice(0,11);e.target.value=v.replace(/^(\d{2})(\d)/,'($1) $2').replace(/(\d{5})(\d{1,4})$/,'$1-$2');});
function unnoCopiar(){const u=v8$('unnoLink');if(!u)return;try{navigator.clipboard.writeText(u.value);}catch(e){u.select();document.execCommand('copy');}v8$('unnoMsg').textContent='Link copiado.';}
function unnoMostrar(d){
  const box=v8$('unnoRes'),msg=v8$('unnoMsg');msg.textContent='';
  const quem='<small>CPF '+esc(v8FmtCpf(unnoAppCpf))+(d.status?' · '+esc(d.status):'')+'</small>';
  if(d.situacao==='aguardando_termo'){
    box.innerHTML='<div class="v8-card">'+quem+'<b>Aguardando o cliente assinar o termo</b><small>Envie este link para o cliente autorizar a consulta:</small><input id="unnoLink" readonly value="'+esc(d.consent_url||'')+'" style="width:100%"><button class="bt" type="button" onclick="unnoCopiar()" style="justify-self:start">Copiar link</button></div>';return;}
  if(d.situacao==='processando'){box.innerHTML='<div class="v8-card">'+quem+'<b>A Unno está consultando a margem…</b></div>';return;}
  if(d.situacao==='sem_margem'){box.innerHTML='<div class="v8-card">'+quem+'<b>Sem margem na Unno</b></div>';return;}
  if(d.situacao==='sem_ofertas'){box.innerHTML='<div class="v8-card">'+quem+'<b>A Unno não liberou oferta para este CPF</b></div>'+(d.bruto?'<div class="v8-lim">'+esc(d.bruto)+'</div>':'');return;}
  if(d.situacao==='ofertas'){
    unnoOfs=(d.ofertas||[]).slice();melhorRender();
    const l=(d.ofertas||[]).slice().sort((a,b)=>(b.prazo-a.prazo)||(b.valor-a.valor));
    box.innerHTML='<div class="v8-card">'+quem+'<b>Ofertas da Unno</b></div><table class="v8-tab"><thead><tr><th>Prazo</th><th>Parcela</th><th>Valor liberado</th></tr></thead><tbody>'+l.map(o=>'<tr><td>'+(o.prazo?o.prazo+'x':'-')+'</td><td>'+(o.parcela?brlFull(o.parcela):'-')+'</td><td><b>'+brlFull(o.valor)+'</b></td></tr>').join('')+'</tbody></table>';return;}
  if(d.situacao==='precisa_dados'){box.innerHTML='<div class="v8-lim">'+esc(d.erro||'')+'</div>';return;}
  box.innerHTML='<div class="v8-lim">⚠️ A Unno respondeu com erro'+(d.erro?' ('+esc(d.erro)+')':'')+'.</div>';}
async function unnoConsultar(cpf){
  const seq=++unnoSeq,box=v8$('unnoBox');box.hidden=false;v8$('unnoRes').innerHTML='';
  const dados={nome:v8$('v8Nome').value.trim(),nascimento:v8$('v8Nasc').value.trim(),celular:v8$('unnoFone').value.trim(),email:v8$('unnoEmail').value.trim()};
  const retomar=unnoApp&&unnoAppCpf===cpf;unnoAppCpf=cpf;
  try{
    v8$('unnoMsg').textContent=retomar?'Conferindo a solicitação na Unno…':'Abrindo na Unno…';
    let d=retomar?await unnoApi('status',cpf,{application_id:unnoApp}):await unnoApi('abrir',cpf,dados);
    if(seq!==unnoSeq)return;if(d.application_id)unnoApp=d.application_id;
    if(!d.ok&&d.situacao==='precisa_dados'){unnoApp='';unnoMostrar(d);return;}
    for(let i=0;i<120&&d.ok&&['aguardando_termo','processando'].includes(d.situacao);i++){
      unnoMostrar(d);await new Promise(r=>setTimeout(r,5000));if(seq!==unnoSeq)return;
      d=await unnoApi('status',cpf,{application_id:unnoApp});if(seq!==unnoSeq)return;}
    if(d.ok&&d.situacao==='ofertas'){d=await unnoApi('ofertas',cpf,{application_id:unnoApp});if(seq!==unnoSeq)return;}
    if(['sem_margem','sem_ofertas','erro'].includes(d.situacao))unnoApp='';
    unnoMostrar(d);
  }catch(e){if(seq===unnoSeq)v8$('unnoMsg').textContent='⚠️ Não consegui consultar a Unno ('+e.message+').';}}
function v8Opcoes(sel){const s=v8$('v8Prazo');
  s.innerHTML='<option value="">36x e 24x (padrão)</option><option value="99">Maior prazo liberado'+(v8Lim.length?' ('+v8Lim[0]+'x)':'')+'</option><option value="todos">Todos os prazos liberados</option>'+v8Lim.map(p=>'<option value="'+p+'">'+p+'x</option>').join('');
  s.value=sel||'';if(s.value!==(sel||''))s.value='';}
async function v8Simular(ev){if(ev)ev.preventDefault();if(!v8C)return;
  const parc=v8Num(v8$('v8Parc').value)||v8C.margem;
  if(parc>v8C.margem+0.001){v8SimMsg('A parcela passa da margem ('+brlFull(v8C.margem)+').');return;}
  const pz=v8$('v8Prazo').value,seq=++v8SimSeq,btn=v8$('v8SimBtn'),out=v8$('v8Ofertas');
  btn.disabled=true;out.innerHTML='';v8SimMsg('Simulando na V8…');
  const base={consult_id:v8C.consult_id,margem:v8C.margem,parcela:parc};let lista=[],lim='',erros=[];
  const roda=async p=>{const d=await v8Api('simular','',Object.assign({},base,{prazo:p}));if(d.limites)lim=d.limites;(d.ofertas||[]).forEach(o=>lista.push(o));(d.erros||[]).forEach(e=>e&&erros.push(e));};
  const leLim=()=>{if(lim)v8Lim=[...new Set([...lim.matchAll(/(\d+)x/g)].map(m=>+m[1]))].sort((a,b)=>b-a);};
  try{
    if(pz==='todos'){if(!v8Lim.length){await roda('');leLim();}lista=[];erros=[];const ps=v8Lim.slice();
      for(let i=0;i<ps.length;i+=3){if(seq!==v8SimSeq)return;v8SimMsg('Simulando… '+Math.min(i+3,ps.length)+' de '+ps.length+' prazos');await Promise.all(ps.slice(i,i+3).map(p=>roda(String(p))));}}
    else await roda(pz);
    if(seq!==v8SimSeq)return;leLim();v8Opcoes(pz);
    const vis={};lista=lista.filter(o=>{const k=o.prazo+'|'+o.parcela+'|'+o.seguro;if(vis[k])return false;vis[k]=1;return o.valor>0;}).sort((a,b)=>(b.prazo-a.prazo)||(b.valor-a.valor));
    let h='';
    if(lista.length){
      h='<table class="v8-tab"><thead><tr><th>Prazo</th><th>Parcela</th><th>Valor liberado</th></tr></thead><tbody>'+lista.map(o=>'<tr><td>'+o.prazo+'x'+(o.seguro===false?' <small>sem seguro</small>':'')+'</td><td>'+brlFull(o.parcela)+'</td><td><b>'+brlFull(o.valor)+'</b></td></tr>').join('')+'</tbody></table>';
      if(lista.some(o=>Number(o.parcela)<parc-0.01))h+='<div class="v8-lim">O banco não aceitou a parcela cheia em algum prazo, então a V8 simulou com a parcela menor que aparece na tabela.</div>';
    }else h='<div class="v8-lim"><b>O banco não aprovou essa simulação.</b>'+(erros.length?'<br>'+esc([...new Set(erros)].join(' · ')):'')+'</div>';
    if(lim)h+='<div class="v8-lim">Limites do banco para este CPF: '+esc(lim)+'</div>';
    out.innerHTML=h;v8SimMsg('');v8Final=lista.slice();melhorRender();
  }catch(e){if(seq===v8SimSeq)v8SimMsg('⚠️ Não consegui simular ('+e.message+').');}
  finally{if(seq===v8SimSeq)btn.disabled=false;}}
function irPara(v){telaAtual=TELAS.includes(v)?v:'escritorio';lsSet('escritorio_tela',telaAtual);try{history.replaceState(null,'','#tela-'+telaAtual);}catch(e){}
  TELAS.forEach(t=>{document.getElementById('v-'+t).hidden=telaAtual!==t;});
  const ehWpp=GRUPO_WPP.includes(telaAtual);if(ehWpp){ultimaWpp=telaAtual;lsSet('escritorio_wpp',telaAtual);}
  document.getElementById('wppTabs').hidden=!ehWpp;
  document.querySelectorAll('.wseg button').forEach(b=>{const on=b.dataset.w===telaAtual;b.classList.toggle('on',on);b.setAttribute('aria-selected',on);});
  document.querySelectorAll('.mais-grid [data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===telaAtual));
  document.querySelectorAll('.nv').forEach(b=>{const on=b.dataset.v===telaAtual||(b.dataset.v==='config'&&ehWpp)||(b.dataset.v==='mais'&&ANALISE.includes(telaAtual));b.classList.toggle('on',on);b.setAttribute('aria-current',on?'page':'false');});
  fecharMais();
  {const t=PG[telaAtual]||PG.escritorio;document.getElementById('pgTit').textContent=t[0];document.getElementById('pgSub').textContent=t[1];}
  window.scrollTo(0,0);if(telaAtual==='escritorio')setTimeout(posicionarClientes,30);if(telaAtual==='mes')setTimeout(renderVendas,30);if(telaAtual==='clientes')renderCrm();if(telaAtual==='agentes')renderAgentes();if(!demo&&chave&&faltaParte())atualizar();if(telaAtual==='financeiro')finCarregar();if(telaAtual==='campanha')cpCarregar();if(telaAtual==='disparo')dpCarregar();if(telaAtual==='oficial')ofCarregar();cvLigar(telaAtual==='conversas');if(telaAtual==='indicacoes')inCarregar();nmLigar(telaAtual==='numeros'||telaAtual==='maturador');}
irPara(telaAtual);
atualizar();agendar();
</script>
