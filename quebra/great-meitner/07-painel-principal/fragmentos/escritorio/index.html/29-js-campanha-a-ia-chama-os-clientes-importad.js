// ═════════════ CAMPANHA (a IA chama os clientes importados) ═════════════
let cpDados=null,cpLinhas=[],cpDemo=null;
const CP_ST={na_fila:['Na fila','#eaf1ff','#1f55c4'],enviado:['Enviado','#e3f7ee','#0f7a4f'],erro:['Erro','#fde8e8','#b42318']};
function cpCpfOk(c){c=String(c).replace(/\D/g,'');if(c.length!==11||/^(\d)\1+$/.test(c))return false;for(const t of [9,10]){let x=0;for(let i=0;i<t;i++)x+=Number(c[i])*(t+1-i);if((x*10)%11%10!==Number(c[t]))return false;}return true;}
function cpLer(txt){const L=String(txt||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);if(!L.length)return[];
  const sep=L[0].includes('\t')?'\t':(L[0].split(';').length>=L[0].split(',').length?';':',');
  const cab=L[0].toLowerCase().split(sep).map(x=>x.trim().replace(/"/g,''));const temCab=cab.some(x=>/nome|tel|fone|celular|whats|cpf|margem/.test(x));
  const idx=k=>temCab?cab.findIndex(x=>k.test(x)):-1;
  const H={n:idx(/nome/),t:idx(/tel|fone|celular|whats|n[uú]mero/),c:idx(/cpf/),m:idx(/margem|parcela|valor/)};
  const out=[];
  for(const l of (temCab?L.slice(1):L)){const c=l.split(sep).map(x=>x.trim().replace(/^"|"$/g,''));
    let nome=H.n>=0?c[H.n]||'':'',tel=H.t>=0?c[H.t]||'':'',cpf=H.c>=0?c[H.c]||'':'',mar=H.m>=0?c[H.m]||'':'';
    // reconhece pelo conteúdo o que não veio pelo título (colunas em qualquer ordem)
    c.forEach((v,i)=>{if([H.n,H.t,H.c,H.m].includes(i))return;const d=v.replace(/\D/g,'');
      if(!cpf&&d.length===11&&cpCpfOk(d)&&(d.length!==v.replace(/[\s()+-]/g,'').length||/[.-]/.test(v)||!tel))cpf=v;
      else if(!tel&&d.length>=10&&d.length<=13&&!/[a-z]/i.test(v)&&!(d.length===11&&cpCpfOk(d)&&/\d{3}\.\d{3}/.test(v)))tel=v;
      else if(!mar&&/^R?\$?\s*\d{1,6}([.,]\d{2})?$/.test(v)&&d.length<=8)mar=v;
      else if(!nome&&/[a-zà-ú]{2}/i.test(v))nome=v;});
    if(!tel&&cpf&&String(cpf).replace(/\D/g,'').length===11&&!cpCpfOk(cpf)){tel=cpf;cpf='';}
    if(!tel){   // linha "Nome 48999998888" (separada só por espaço): procura o telefone dentro do texto
      const resto=l.replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/,x=>{if(!cpf)cpf=x;return ' ';});
      const f=resto.match(/(?:\+?55[\s-]?)?\(?\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}/);
      if(f){tel=f[0];{const n=resto.replace(f[0],' ').replace(/[\t;,]+/g,' ').replace(/R?\$?\s*\d+([.,]\d+)?/g,' ').replace(/\s+/g,' ').trim();nome=/[a-zà-ú]{2}/i.test(n)?n:'';}}}
    const m=String(mar).replace(/[^\d,.]/g,'');
    if(String(tel).replace(/\D/g,'').length>=10)out.push({nome,telefone:tel,cpf,margem:m.includes(',')?m.replace(/\./g,'').replace(',','.'):m});}
  return out;}
function cpAtualizarPrev(){cpLinhas=cpLer(document.getElementById('cpTexto').value);const tx=document.getElementById('cpTexto').value.trim();document.getElementById('cpPrev').textContent=cpLinhas.length?cpLinhas.length+' cliente(s) com telefone encontrados':(tx?'⚠️ Nenhum telefone encontrado. Confira se a lista tem uma coluna com DDD + número.':'');document.getElementById('cpImp').disabled=!cpLinhas.length;}
document.addEventListener('input',e=>{if(e.target&&e.target.id==='cpTexto')cpAtualizarPrev();});
function cpLerArquivo(inp){const f=inp.files&&inp.files[0];if(!f)return;const fr=new FileReader();fr.onload=()=>{document.getElementById('cpTexto').value=String(fr.result);cpAtualizarPrev();};fr.readAsText(f,'utf-8');inp.value='';}
function cpDemoApi(acao,extra){if(!cpDemo)cpDemo={config:{ativa:false,intervalo_min:5,instancia:null,hora_inicio:8,hora_fim:20,mensagem:'Oi {nome}, tudo bem? Aqui é a Ana, da GM Cred 😊 Vi que você tem crédito CLT disponível pela carteira assinada. Quer que eu veja quanto consigo liberar pra você? É rapidinho e sem compromisso.'},contatos:[]};
  let aviso=null;if(acao==='importar'){const L=JSON.parse(extra.linhas);L.forEach(l=>cpDemo.contatos.push({id:Date.now()+Math.random(),nome:l.nome,telefone:'55'+String(l.telefone).replace(/\D/g,'').replace(/^55/,''),cpf:l.cpf?'***':null,margem:l.margem||null,status:'na_fila'}));aviso=L.length+' importado(s)';}
  if(acao==='ativar'||acao==='pausar')cpDemo.config.ativa=acao==='ativar';if(acao==='mensagem')cpDemo.config.mensagem=extra.mensagem;
  const n=s=>cpDemo.contatos.filter(c=>c.status===s).length;return{aviso,config:cpDemo.config,na_fila:n('na_fila'),enviados:n('enviado'),erros:n('erro'),responderam:0,contatos:cpDemo.contatos};}

let cvD=null,cvSel=null,cvConv=null,cvTimer=null,cvEnviando=false;
async function cvApi(acao,extra){if(demo)return null;if(!chave){pedirChave();return null;}
  const r=await fetch(BASE+'/escritorio/atendimento',{method:'POST',body:new URLSearchParams({k:chave,acao,...(extra||{})})});
  if(r.status===401){pedirChave('Chave inválida ou desativada.');return null;}return r.ok?r.json():null;}
const MODO_TX={troca:'reserva',campanha:'campanha',recuperar:'recuperação',humano:'você',resposta:'IA',apresentar:'IA'};
function cvHora(iso){return quando(iso);}
function cvNumDe(inst){const N=(cvD&&cvD.numeros)||[],n=N.find(x=>x.nome===(inst||'gmcred-campanha'));return n?fmtTel(n.numero)+(n.estado==='open'?'':' ⚠️ caiu'):(inst||'');}
function cvRenderNums(){const N=(cvD&&cvD.numeros)||[];document.getElementById('cvNums').innerHTML=N.map(n=>`<div class="cv-num ${n.estado==='open'?'ok':'mal'}" title="${esc(n.nome)}${n.caiu_em&&n.estado!=='open'?' · caiu em '+quando(n.caiu_em):''}"><b>${fmtTel(n.numero)}</b>${esc(n.situacao)} · ${n.enviadas_hoje} enviadas hoje${n.falhas_hoje?` · <span style="color:#b42318">${n.falhas_hoje} falhas</span>`:''}</div>`).join('');}
function cvRenderLista(){const L=(cvD&&cvD.conversas)||[],b=(document.getElementById('cvBusca').value||'').toLowerCase(),bd=b.replace(/\D/g,'');
  const F=L.filter(c=>!b||String(c.nome||'').toLowerCase().includes(b)||(bd.length>=3&&String(c.telefone).includes(bd)));
  const esp=L.filter(c=>c.sem_resposta>0).length,bd2=document.getElementById('cvBadge');bd2.hidden=!esp;bd2.textContent=esp;
  document.getElementById('cvLista').innerHTML=F.length?F.map(c=>`<div class="cv-it ${cvSel===c.id?'on':''}" onclick="cvAbrir(${c.id})"><div class="t"><b>${esc(c.nome||fmtTel(c.telefone))}</b><p>${c.ultima_dir==='entrada'?'':'↪ '}${esc(c.ultima||'')}</p><small>📱 ${esc(cvNumDe(c.instancia))} · ${esc(c.situacao||'')}${c.aguardando==='humano'?' · 🧑 com você':''}</small></div><div style="text-align:right"><small>${cvHora(c.ultima_em)}</small>${c.sem_resposta?`<div><span class="n">${c.sem_resposta}</span></div>`:''}</div></div>`).join(''):'<div class="vazio">Nenhuma conversa.</div>';}
function cvRenderChat(rolar){const el=document.getElementById('cvChat');if(!cvConv||!cvConv.lead)return;const l=cvConv.lead,M=cvConv.msgs||[];
  if(el.dataset.lead!==String(l.id)){el.dataset.lead=l.id;rolar=true;
    el.innerHTML=`<div class="cv-top"></div><div class="cv-msgs"></div>
    <div class="cv-env"><textarea placeholder="Escreva sua resposta…" title="Enter envia, Shift+Enter quebra linha" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();cvEnviar();}"></textarea><button class="bt pri" onclick="cvEnviar()">Enviar</button></div>
    <div class="cv-fim"><span>Finalizar atendimento:</span><select id="cvMotivo"><option value="sem interesse">Sem interesse</option><option value="já tem empréstimo">Já tem empréstimo</option><option value="número errado: não é o cliente">Número errado</option><option value="não contatar: pediu para não chamar">Não contatar</option><option value="sem margem: informado pelo atendente">Sem margem</option><option value="atendimento concluído">Atendimento concluído</option></select><button class="bt" onclick="cvFinalizar()">✔ Finalizar</button></div>`;}
  el.querySelector('.cv-top').innerHTML=`<div><button class="bt cv-volta" onclick="cvFechar()">← voltar</button><b>${esc(l.nome||fmtTel(l.telefone))}</b><br><span>${fmtTel(l.telefone)} · ${esc(l.situacao||'')} · <b style="color:#0f7a4f">📱 falando pelo ${esc(cvNumDe(l.instancia))}</b></span></div>
     <div>${l.humano?`<span style="color:#1f55c4;font-weight:700">🧑 Você está atendendo (IA pausada)</span> <button class="bt" onclick="cvDevolver()">Devolver para a IA</button>`:'<span>🤖 A IA está atendendo. Se você responder, ela pausa.</span>'}</div>`;
  const box=el.querySelector('.cv-msgs'),fim=box.scrollTop+box.clientHeight>=box.scrollHeight-40,html=M.map(m=>`<div class="cv-b ${m.dir==='entrada'?'in':'out'} ${m.modo==='humano'?'hum':''}">${esc(m.txt)}<small>${m.dir==='entrada'?'cliente':esc(MODO_TX[m.modo]||'IA')} · ${hora(m.em)}${m.dir==='saida'?(m.erro?' · ❌ não saiu':m.enviado?' ✓':' · enviando…'):''}</small></div>`).join('')||'<div class="vazio">Sem mensagens.</div>';
  if(box.dataset.h!==html){box.dataset.h=html;box.innerHTML=html;if(rolar||fim)box.scrollTop=box.scrollHeight;}}
async function cvFinalizar(){if(!cvSel)return;const m=document.getElementById('cvMotivo').value;if(!confirm('Finalizar o atendimento deste cliente como "'+m+'"?'))return;
  const r=await cvApi('finalizar',{id:cvSel,texto:m});if(!r||!r.ok){alert('Não consegui finalizar.');return;}await cvCarregar();}
function cvFechar(){cvSel=null;const w=document.querySelector('.cv-wrap');if(w)w.classList.remove('aberta');document.getElementById('v-conversas').classList.remove('aberta');cvRenderLista();}
async function cvAbrir(id){cvSel=id;const w=document.querySelector('.cv-wrap');if(w)w.classList.add('aberta');document.getElementById('v-conversas').classList.add('aberta');const cc=((cvD&&cvD.conversas)||[]).find(x=>x.id===id);if(cc)cc.sem_resposta=0;cvRenderLista();const r=await cvApi('conversa',{id});if(r&&r.ok&&cvSel===id){const novo=!cvConv||!cvConv.lead||cvConv.lead.id!==id;cvConv=r;cvRenderChat(novo);}}
async function cvEnviar(){const t=document.querySelector('#cvChat textarea');if(!t||!t.value.trim()||cvEnviando||!cvSel)return;cvEnviando=true;const txt=t.value;t.value='';
  try{const r=await cvApi('enviar',{id:cvSel,texto:txt});if(!r||!r.ok){t.value=txt;alert((r&&r.erro)||'Não consegui enviar.');}await cvAbrir(cvSel);}finally{cvEnviando=false;}}
async function cvDevolver(){if(!cvSel)return;await cvApi('devolver',{id:cvSel});await cvAbrir(cvSel);}
async function cvCarregar(){const r=await cvApi('lista');if(r){cvD=r;cvRenderNums();cvRenderLista();}if(cvSel)await cvAbrir(cvSel);}
function cvLigar(on){clearInterval(cvTimer);cvTimer=null;if(on){cvCarregar();cvTimer=setInterval(()=>{if(!document.hidden)cvCarregar();},4000);}}

let nmD=null,nmTimer=null;
async function nmApi(acao,extra){if(demo)return null;if(!chave){pedirChave();return null;}
  const r=await fetch(BASE+'/escritorio/numeros',{method:'POST',body:new URLSearchParams({k:chave,acao,...(extra||{})})});
  if(r.status===401){pedirChave('Chave inválida ou desativada.');return null;}return r.ok?r.json():null;}
async function nmCarregar(acao,extra){const r=await nmApi(acao||'ver',extra);if(r&&r.numeros){nmD=r;nmRender();}}
function nmRender(){const N=(nmD&&nmD.numeros)||[],mal=N.filter(n=>n.estado!=='open').length,bd=document.getElementById('nmBadge');bd.hidden=!mal;bd.textContent=mal;
  const cpn=N.filter(n=>n.campanha&&n.estado==='open').length,cpe=document.getElementById('nmCamp');if(cpe)cpe.textContent=`📤 Campanha: ${cpn} número(s) conectados e marcados = ${cpn} mensagem(ns) ao mesmo tempo a cada 5 min.`;const el=document.getElementById('nmLista');if(el)el.innerHTML=N.map(n=>{const ok=n.estado==='open';return `<div class="nm-c ${ok?'':'mal'}"><b>${fmtTel(n.numero)}</b> <small style="display:inline">${esc(n.nome)}</small><br>
    <span class="nm-st" style="background:${ok?'#e3f7ee':'#fde8e8'};color:${ok?'#0f7a4f':'#b42318'}">${ok?'🟢':'🔴'} ${esc(n.situacao)}</span>${!ok&&n.caiu_em?`<small>caiu ${quando(n.caiu_em)}</small>`:''}
    <input type="text" value="${esc(n.aparelho||'')}" placeholder="Onde está? ex.: Motorola · slot 2" onchange="nmCarregar('salvar',{nome:'${n.nome}',aparelho:this.value})">
    <small>${n.enviadas_hoje} enviadas hoje${n.falhas_hoje?` · <span style="color:#b42318">${n.falhas_hoje} falhas</span>`:''} · ${n.maturadas_hoje} no maturador</small>
    <label style="display:flex;gap:6px;align-items:center;margin-top:6px;font-size:13px"><input type="checkbox" ${n.campanha?'checked':''} onchange="nmCarregar('salvar',{nome:'${n.nome}',campanha:this.checked})"> 📤 usar na campanha</label>
    <label style="display:flex;gap:6px;align-items:center;margin-top:6px;font-size:13px"><input type="checkbox" ${n.maturar?'checked':''} onchange="nmCarregar('salvar',{nome:'${n.nome}',maturar:this.checked})"> usar no maturador</label>
    ${ok?'':`<button class="bt pri" style="margin-top:8px" onclick="nmQr('${n.nome}','${fmtTel(n.numero)}')">Conectar (QR code)</button>`}</div>`;}).join('')||'<div class="vazio">Nenhum número.</div>';
  const M=(nmD&&nmD.maturador)||{},cf=document.getElementById('mtCfg'),mats=N.filter(n=>n.maturar);
  if(cf)cf.innerHTML=`<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><button class="bt ${M.ativo?'':'pri'}" onclick="nmCarregar('maturador',{ativo:${!M.ativo}})">${M.ativo?'⏸️ Pausar maturador':'▶️ Ligar maturador'}</button>
    <span>${M.ativo?'🟢 ligado':'⏸️ pausado'} · 1 mensagem a cada ~<input type="number" min="3" max="120" value="${M.intervalo_min||8}" style="width:60px" onchange="nmCarregar('maturador',{intervalo_min:this.value})"> min</span>
    <span>${mats.length} número(s) marcados: ${mats.map(n=>fmtTel(n.numero)).join(', ')||'nenhum — marque na aba Números'}${mats.length===1?' (precisa de pelo menos 2)':''}</span></div>`;
  const U=(nmD&&nmD.ultimas)||[],ul=document.getElementById('mtUlt');if(ul)ul.innerHTML=U.length?`<div class="rs-tab"><table><tr><th>Hora</th><th>De</th><th>Para</th><th style="text-align:left">Mensagem</th><th>Enviada</th></tr>${U.map(u=>`<tr><td>${quando(u.em)}</td><td>${esc(u.de)}</td><td>${esc(u.para)}</td><td style="text-align:left">${esc(u.texto)}</td><td>${u.ok?'✓':'…'}</td></tr>`).join('')}</table></div>`:'<div class="vazio">Nenhuma mensagem ainda.</div>';}
async function nmNovo(){const ap=prompt('Onde vai ficar esse chip? (ex.: Motorola · slot 4)');if(ap===null)return;
  const q=document.getElementById('nmQr');document.getElementById('nmQrT').textContent='Novo número';document.getElementById('nmQrImg').innerHTML='<div class="vazio">Criando o número e gerando o QR…</div>';q.hidden=false;
  const r=await nmApi('criar',{aparelho:ap});
  if(r&&r.criado){document.getElementById('nmQrT').textContent='Conectar '+r.criado+(ap?' · '+ap:'');document.getElementById('nmQrImg').innerHTML=r.qr?`<img alt="QR code" src="${r.qr.startsWith('data:')?r.qr:'data:image/png;base64,'+r.qr}">`:`<div class="vazio">Número criado, mas o QR não veio. Feche e use "Conectar (QR code)" no cartão dele.</div>`;nmCarregar();}
  else document.getElementById('nmQrImg').innerHTML='<div class="vazio">Não consegui criar o número agora. Tente de novo.</div>';}
async function nmQr(nome,tel){const q=document.getElementById('nmQr');document.getElementById('nmQrT').textContent='Conectar '+tel;document.getElementById('nmQrImg').innerHTML='<div class="vazio">Gerando QR…</div>';q.hidden=false;
  const r=await nmApi('qr',{nome});document.getElementById('nmQrImg').innerHTML=r&&r.qr?`<img alt="QR code" src="${r.qr.startsWith('data:')?r.qr:'data:image/png;base64,'+r.qr}">`:`<div class="vazio">${r&&r.estado==='open'?'Esse número já está conectado.':'Não consegui gerar o QR agora. Tente de novo.'}</div>`;}
function nmLigar(on){clearInterval(nmTimer);nmTimer=null;if(on){nmCarregar();nmTimer=setInterval(()=>{if(!document.hidden&&document.getElementById('nmQr').hidden)nmCarregar();},10000);}}
async function cpCarregar(acao,extra){acao=acao||'ver';extra=extra||{};
  try{if(demo)cpDados=cpDemoApi(acao,extra);
    else{if(!chave){pedirChave();return;}const r=await fetch(BASE+'/escritorio/campanha',{method:'POST',body:new URLSearchParams({k:chave,acao,...extra})});
      if(r.status===401){pedirChave('Chave inválida ou desativada.');return;}if(!r.ok)throw new Error('HTTP '+r.status);cpDados=await r.json();}
    if(cpDados.aviso)document.getElementById('cpAviso').textContent='✅ '+cpDados.aviso;
  }catch(e){document.getElementById('cpAviso').textContent='Não consegui falar com o servidor ('+e.message+').';return;}
  renderCampanha();}
async function cpImportar(){if(!cpLinhas.length)return;const b=document.getElementById('cpImp');b.disabled=true;await cpCarregar('importar',{linhas:JSON.stringify(cpLinhas)});document.getElementById('cpTexto').value='';cpAtualizarPrev();}
function cpSalvarMsg(){const m=document.getElementById('cpMsg').value.trim();if(m.length<20){document.getElementById('cpMsgOk').textContent='Mensagem muito curta.';return;}cpCarregar('mensagem',{mensagem:m}).then(()=>{document.getElementById('cpMsgOk').textContent='✅ Salva';});}
function cpAlternar(){if(!cpDados)return;const at=!(cpDados.config||{}).ativa;if(at&&!confirm('Começar a enviar? Será 1 mensagem a cada '+((cpDados.config||{}).intervalo_min||5)+' minutos, das '+((cpDados.config||{}).hora_inicio||8)+'h às '+((cpDados.config||{}).hora_fim||20)+'h.'))return;cpCarregar(at?'ativar':'pausar');}
function renderCampanha(){const D=cpDados;if(!D)return;const C=D.config||{},fila=Number(D.na_fila||0),iv=Number(C.intervalo_min||5);
  const b=document.getElementById('cpBtn');b.textContent=C.ativa?'⏸ Pausar envios':'▶ Começar envios';b.className='bt '+(C.ativa?'':'pri');
  const m=document.getElementById('cpMsg');if(m&&document.activeElement!==m)m.value=C.mensagem||'';
  const horas=fila*iv/60;
  document.getElementById('cpResumo').innerHTML=`
    <div><span class="big">${fila}</span>na fila · ${fila?`termina em ~${horas<1?Math.ceil(fila*iv)+' min':horas.toFixed(1).replace('.',',')+' h'} de envio (1 a cada ${iv} min, das ${C.hora_inicio||8}h às ${C.hora_fim||20}h)`:'importe clientes ao lado'}</div>
    <div><span class="big" style="color:#0f7a4f">${D.enviados||0}</span>mensagens enviadas · <b>${D.responderam||0}</b> responderam${D.erros?` · <span style="color:#b42318">${D.erros} com erro</span>`:''}</div>
    <div><span class="big" style="color:${C.ativa?'#0f7a4f':'#8a6200'}">${C.ativa?'Enviando':'Pausada'}</span>${C.instancia?'pelo número '+esc(C.instancia):'⚠️ nenhum número de WhatsApp ligado à campanha ainda'}</div>`;
  const L=D.contatos||[];
  document.getElementById('cpLista').innerHTML=`<h4>👥 Clientes da campanha · ${L.length}</h4>${L.length?`<div class="crm-tab"><div class="crm-l crm-h"><span>Cliente</span><span>Telefone</span><span>CPF</span><span>Situação</span><span>Margem</span><span>Enviado</span></div>${L.map(c=>{const st=c.status==='enviado'&&c.situacao?[c.situacao,...(/^(Número errado|Não contatar)/.test(c.situacao)?['#fde8e8','#b42318']:/^Prospecção/.test(c.situacao)?['#e3f7ee','#0f7a4f']:['#fff4dc','#a15c00'])]:c.status==='erro'&&c.erro?[c.erro,'#fde8e8','#b42318']:(CP_ST[c.status]||['—','#eef1f5','#5b6878']);
      return `<div class="crm-l" ${c.lead_id?`onclick="abrirPainel('cliente:${c.lead_id}')"`:'style="cursor:default"'}><span class="c-nome"><b>${esc(c.nome||'Sem nome')}</b></span><span class="c-tel">${fmtTel(c.telefone)}</span><span class="c-cpf">${esc(c.cpf||'—')}</span><span class="c-sit"><span class="cp-st" style="background:${st[1]};color:${st[2]}" title="${esc(c.erro||'')}">${st[0]}</span>${c.status==='na_fila'?` <button class="lnk-a" style="font-size:11.5px" onclick="event.stopPropagation();cpCarregar('remover',{id:'${c.id}'})">remover</button>`:''}</span><span class="c-of">${c.margem?brlFull(c.margem):'—'}</span><span class="c-ult">${c.enviado_em?quando(c.enviado_em):'—'}</span></div>`;}).join('')}</div>`:'<div class="vazio">Nenhum cliente importado ainda.</div>'}`;}

