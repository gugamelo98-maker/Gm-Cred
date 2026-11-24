// ═════════════ CLIENTES (cadastro / CRM) ═════════════
const CRM_GRUPOS=[['todos','Todos'],['andamento','Em atendimento'],['com_margem','Com margem'],['perdido','Finalizados'],['sem_margem','Sem margem'],['pago','Pagos']];
const CRM_COR={andamento:['#eaf1ff','#1f55c4'],com_margem:['#fff4dc','#a15c00'],pago:['#e3f7ee','#0f7a4f'],perdido:['#fde8e8','#b42318'],sem_margem:['#eef1f5','#5b6878']};
let crmF={grupo:'todos',busca:'',motivo:'',cat:''};
function catPerda(c){if(c.etiqueta)return c.etiqueta;const t=c.situacao||'';return t.startsWith('Sumiu')?'Parou de responder':t.startsWith('Desistiu')?'Desistiu':t;}
function verCat(cat){crmF={grupo:'perdido',busca:'',motivo:'',cat};const i=document.getElementById('crmBusca');if(i)i.value='';irPara('clientes');}
function fmtCpf(c){c=String(c||'').replace(/\D/g,'');return c.length===11?c.slice(0,3)+'.'+c.slice(3,6)+'.'+c.slice(6,9)+'-'+c.slice(9):(c||'—');}
function fmtTel(t){t=String(t||'');const d=t.replace(/\D/g,'').replace(/^55(?=\d{10,11}$)/,'');if(/^\d{10,11}$/.test(d))return '('+d.slice(0,2)+') '+d.slice(2,-4)+'-'+d.slice(-4);return t||'—';}
function quando(iso){if(!iso)return'—';const d=new Date(iso),h=new Date();return dataISO(d)===dataISO(h)?'hoje '+hora(iso):d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}
function pillSit(c){const k=CRM_COR[c.grupo]||['#eef1f5','#5b6878'];const t=c.grupo==='com_margem'&&c.etiqueta?c.etiqueta:c.grupo==='perdido'&&c.etiqueta?'Finalizado · '+c.etiqueta:c.situacao;return `<span class="sit" style="background:${k[0]};color:${k[1]}">${esc(t)}</span>`;}
function crmItem(c){return `<div class="item" role="button" tabindex="0" style="cursor:pointer" onclick="abrirPainel('cliente:${c.id}')"><div class="t"><b>${esc(c.nome||fmtTel(c.telefone))}${c.teste?' <span class="pill" style="background:#eef1f5;color:#5b6878">teste</span>':''}</b><span>${fmtTel(c.telefone)} · entrou ${quando(c.entrou)}</span></div><div class="d">${pillSit(c)}</div></div>`;}
function crmFiltrados(){const b=crmF.busca.trim().toLowerCase(),bd=b.replace(/\D/g,'');
  return (estado.crm||[]).filter(c=>(crmF.grupo==='todos'||c.grupo===crmF.grupo)&&(!crmF.cat||catPerda(c)===crmF.cat)&&(!crmF.motivo||(c.motivo||'Sem motivo informado')===crmF.motivo)
    &&(!b||String(c.nome||'').toLowerCase().includes(b)||(bd.length>=3&&(String(c.telefone||'').replace(/\D/g,'').includes(bd)||String(c.cpf||'').includes(bd)))));}
function crmGrupo(g){crmF.grupo=g;crmF.motivo='';crmF.cat='';renderCrm();}

function renderCrm(){const el=document.getElementById('crmLista');if(!el)return;const T=estado.crm||[];
  const n=g=>g==='todos'?T.length:T.filter(c=>c.grupo===g).length;
  document.getElementById('crmChips').innerHTML=CRM_GRUPOS.map(([g,t])=>`<button class="chip ${crmF.grupo===g&&!crmF.motivo&&!crmF.cat?'on':''}" onclick="crmGrupo('${g}')">${t} <b>${n(g)}</b></button>`).join('')+(crmF.motivo?`<button class="chip on" onclick="crmF.motivo='';renderCrm()">Motivo: ${esc(crmF.motivo)} ✕</button>`:'')+(crmF.grupo==='perdido'?'<div class="crm-etq">'+Object.entries(T.filter(c=>c.grupo==='perdido').reduce((m,c)=>{const e=catPerda(c);m[e]=(m[e]||0)+1;return m;},{})).sort((a,b)=>b[1]-a[1]).map(([e,q])=>`<button class="chip ${crmF.cat===e?'on':''}" onclick="crmF.cat=crmF.cat==='${e}'?'':'${e}';renderCrm()">🏷️ ${esc(e)} <b>${q}</b></button>`).join('')+'</div>':(crmF.cat?`<button class="chip on" onclick="crmF.cat='';renderCrm()">${esc(crmF.cat)} ✕</button>`:''));
  const L=crmFiltrados();
  if(estado.crm==null){el.innerHTML='<div class="vazio">Carregando clientes…</div>';return;}
  if(!T.length){el.innerHTML='<div class="vazio">Nenhum cliente ainda. Todo cliente que entrar no escritório fica guardado aqui, com nome, número, CPF e onde parou.</div>';return;}
  if(!L.length){el.innerHTML='<div class="vazio">Nenhum cliente com esse filtro.</div>';return;}
  const off=(e)=>e.stopPropagation();
  el.innerHTML=`<div class="crm-tab"><div class="crm-l crm-h"><span>Cliente</span><span>Telefone</span><span>CPF</span><span>Situação</span><span>Oferta</span><span>Última conversa</span></div>
    ${L.slice(0,300).map(c=>`<div class="crm-l" role="button" tabindex="0" onclick="abrirPainel('cliente:${c.id}')" onkeydown="if(event.key==='Enter')abrirPainel('cliente:${c.id}')">
      <span class="c-nome"><b>${esc(c.nome||'Sem nome')}</b>${c.teste?' <span class="pill" style="background:#eef1f5;color:#5b6878">teste</span>':''}</span>
      <span class="c-tel">${fmtTel(c.telefone)}</span><span class="c-cpf">${fmtCpf(c.cpf)}${c.cpf_da_base?' <small style="color:#8a94a3" title="CPF da planilha, ainda não confirmado pelo cliente">(base)</small>':''}</span><span class="c-sit">${pillSit(c)}</span>
      <span class="c-of">${c.oferta?brl(c.oferta.valor)+' em '+c.oferta.prazo+'x':c.margem?'margem '+brl(c.margem):'—'}</span><span class="c-ult">${quando(c.ultima)}</span></div>`).join('')}</div>
    ${L.length>300?`<div class="vazio" style="margin-top:8px">Mostrando 300 de ${L.length}. Use a busca ou baixe a planilha para ver todos.</div>`:''}`;}
function crmCsv(){const L=crmFiltrados(),q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const linhas=[['Nome','Telefone','CPF','Situação','Motivo','Margem','Valor da oferta','Prazo','Parcela','Entrou em','Última conversa','Teste']].concat(L.map(c=>[c.nome,fmtTel(c.telefone),fmtCpf(c.cpf),c.situacao,c.motivo,c.margem,c.oferta&&c.oferta.valor,c.oferta&&c.oferta.prazo,c.oferta&&c.oferta.parcela,c.entrou&&new Date(c.entrou).toLocaleString('pt-BR'),c.ultima&&new Date(c.ultima).toLocaleString('pt-BR'),c.teste?'sim':'']));
  const blob=new Blob(['﻿'+linhas.map(r=>r.map(q).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='clientes-gmcred-'+hojeISO()+'.csv';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}
function verMotivo(m){crmF={grupo:'todos',busca:'',motivo:m,cat:''};const i=document.getElementById('crmBusca');if(i)i.value='';irPara('clientes');}
function itemContrato(c){const e=ETAPAS[c.etapa]||{cor:'#999'};
  return `<div class="item"><div class="av" style="display:grid;place-items:center;font-size:16px;background:${e.cor}22">${(ETAPAS[c.etapa]||{}).icone||'📄'}</div>
    <div class="t"><b>${esc(c.nome||'Cliente')}</b><span>${c.parcelas||'?'}x de ${brlFull(c.valor_parcela)} · ${c.com_seguro?'com seguro':'sem seguro'} · ${c.percentual!=null?String(c.percentual).replace('.',',')+'%':'—'}</span></div>
    <div class="d"><b style="color:${e.cor}">${brlFull(c.comissao)}</b><span>${brlFull(c.valor_liberado)} liberado</span></div></div>`;}

// clientes: cada um é um bonequinho posicionado na "zona do chão" da sala do seu setor
const cliEls=new Map();
function posicionarClientes(){
  if(typeof telaAtual!=='undefined'&&telaAtual!=='escritorio')return;
  const camada=document.getElementById('clientes'),base=document.getElementById('escritorio').getBoundingClientRect();
  const porSetor={};estado.leads.forEach(l=>{(porSetor[l.setor_id]=porSetor[l.setor_id]||[]).push(l);});
  const vivos=new Set(),OFF=[-30,30,-46,46];
  camada.querySelectorAll('.mais').forEach(m=>m.remove());
  Object.entries(porSetor).forEach(([sid,lista])=>{
    const sala=document.getElementById('sala-'+sid);if(!sala)return;
    const r=sala.querySelector('.cena').getBoundingClientRect(),ags=agentesDe(sid),pos=POSTOS[ags.length]||[50];
    lista.sort((a,b)=>a.id-b.id);
    const fila={};let escondidos=0;
    lista.forEach(l=>{
      vivos.add(l.id);
      let pi=ags.findIndex(a=>a.id===l.agente_id);if(pi<0)pi=ags.length?hash(l.id)%ags.length:0;
      const i=(fila[pi]=(fila[pi]||0)+1)-1,vis=i<OFF.length;if(!vis)escondidos++;
      let el=cliEls.get(l.id),novo=false;
      if(!el){el=document.createElement('div');el.className='cli';el.dataset.id=l.id;camada.appendChild(el);cliEls.set(l.id,el);novo=true;
        el.addEventListener('click',e=>{e.stopPropagation();abrirPainel('cliente:'+el.dataset.id);});
        el.addEventListener('mouseenter',e=>mostrarTip(Number(el.dataset.id),e.clientX,e.clientY));el.addEventListener('mouseleave',()=>{tip.style.display='none';});}
      const sig=(l.parado?1:0)+'';if(el.dataset.sig!==sig){el.innerHTML=pessoaEmPe(l.id,l.parado)+(l.parado?'<span class="exc">!</span>':'');el.dataset.sig=sig;}
      const cx=r.left-base.left+r.width*pos[pi]/100;
      const xx=Math.min(Math.max(cx+OFF[Math.min(i,OFF.length-1)]-15,r.left-base.left+4),r.right-base.left-34);
      const y=r.bottom-base.top-76-(i>1?5:0);
      if(novo){const rec=document.getElementById('sala-recepcao');const rr=rec?rec.querySelector('.cena').getBoundingClientRect():r;el.style.left=(rr.left-base.left+4)+'px';el.style.top=(rr.bottom-base.top-76)+'px';el.style.opacity='0';el.getBoundingClientRect();}
      const chave=sid+':'+pi,mudou=el.dataset.setor&&el.dataset.setor!==chave;el.dataset.setor=chave;
      const antes=el.style.left+el.style.top;
      el.style.left=xx+'px';el.style.top=y+'px';el.style.opacity=vis?'1':'0';el.style.zIndex=3+i;
      if(antes!==el.style.left+el.style.top&&(mudou||novo)){el.classList.add('andando');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('andando'),2600);}
    });
    if(escondidos){const m=document.createElement('span');m.className='mais';m.textContent='+'+escondidos+' clientes';m.style.left=(r.left-base.left+8)+'px';m.style.top=(r.top-base.top+8)+'px';camada.appendChild(m);}
  });
  for(const [id,el] of cliEls){if(!vivos.has(id)){el.style.opacity='0';setTimeout(()=>el.remove(),500);cliEls.delete(id);}}
}
function festa(leadId){const el=cliEls.get(leadId);if(el){el.classList.remove('festa');void el.offsetWidth;el.classList.add('festa');}}
window.addEventListener('resize',()=>{clearTimeout(window._rz);window._rz=setTimeout(()=>{posicionarClientes();renderVendas();},120);});

// tooltip do cliente
const tip=document.getElementById('tip');
function mostrarTip(id,x,y){
  const l=estado.leads.find(v=>v.id===id);if(!l)return;const s=setorById(l.setor_id);
  tip.innerHTML=`<b>${esc(l.nome||'Cliente #'+l.id)}</b>
    <div><span>Setor</span><span style="color:${s?s.cor:''}">${esc(s?s.nome:l.setor_id)}</span></div>
    <div><span>Etapa</span><span>${STATUS_LABEL[l.status]||esc(l.status)}</span></div>
    <div><span>Produto</span><span>${esc((l.produto||'—').toUpperCase())}</span></div>
    <div><span>Valor</span><span>${brlFull(l.valor)}</span></div>
    <div><span>No setor há</span><span style="color:${l.parado?'var(--vermelho)':''}">${tempo(minDesde(l.entrou_setor_em))}${l.parado?' ⚠':''}</span></div>
    <div><span>Aguardando</span><span>${l.aguardando==='cliente'?'resposta do cliente':l.aguardando==='humano'?'você':'o agente'}</span></div>`;
  tip.style.display='block';const w=tip.offsetWidth,h=tip.offsetHeight;
  tip.style.left=Math.min(x+12,innerWidth-w-8)+'px';tip.style.top=Math.max(8,Math.min(y-h-10,innerHeight-h-8))+'px';
  clearTimeout(tip._t);tip._t=setTimeout(()=>tip.style.display='none',3500);
}
document.addEventListener('click',()=>{tip.style.display='none';});

