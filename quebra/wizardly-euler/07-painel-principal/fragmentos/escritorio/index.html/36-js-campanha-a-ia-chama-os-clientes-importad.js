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
function cvRenderNums(){const N=(cvD&&cvD.numeros)||[];document.getElementById('cvNums').innerHTML=N.map(n=>`<div class="cv-num ${n.estado==='open'?'ok':'mal'}" title="${esc(n.nome)}${n.caiu_em&&n.estado!=='open'?' · caiu em '+quando(n.caiu_em):''}"><b>${fmtTel(n.numero)}</b>${esc(n.situacao)} · ${n.enviadas_hoje} enviadas · ${n.entregues_hoje||0} entregues hoje${n.falhas_hoje?` · <span style="color:#b42318">${n.falhas_hoje} falhas</span>`:''}</div>`).join('');}
function cvRenderLista(){const L=(cvD&&cvD.conversas)||[],b=(document.getElementById('cvBusca').value||'').toLowerCase(),bd=b.replace(/\D/g,'');
  const F=L.filter(c=>!b||String(c.nome||'').toLowerCase().includes(b)||(bd.length>=3&&String(c.telefone).includes(bd)));
  const esp=L.filter(c=>c.sem_resposta>0).length,bd2=document.getElementById('cvBadge');bd2.hidden=!esp;bd2.textContent=esp;
  document.getElementById('cvLista').innerHTML=F.length?F.map(c=>`<div class="cv-it ${cvSel===c.id?'on':''}" onclick="cvAbrir(${c.id})"><div class="t"><b>${esc(c.nome||fmtTel(c.telefone))}</b><p>${c.ultima_dir==='entrada'?'':'↪ '}${esc(c.ultima||'')}</p><small>📱 ${esc(cvNumDe(c.instancia))} · ${esc(c.situacao||'')}${c.aguardando==='humano'?' · 🧑 com você':''}</small></div><div style="text-align:right"><small>${cvHora(c.ultima_em)}</small>${c.sem_resposta?`<div><span class="n">${c.sem_resposta}</span></div>`:''}</div></div>`).join(''):'<div class="vazio">Nenhuma conversa.</div>';}
function cvRenderChat(rolar){const el=document.getElementById('cvChat');if(!cvConv||!cvConv.lead)return;const l=cvConv.lead,M=cvConv.msgs||[];
  if(el.dataset.lead!==String(l.id)){el.dataset.lead=l.id;rolar=true;
    el.innerHTML=`<div class="cv-top"></div><div class="cv-msgs"></div>
    <div class="cv-env"><textarea placeholder="Escreva sua resposta…" title="Enter envia, Shift+Enter quebra linha" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();cvEnviar();}"></textarea><button class="bt pri" onclick="cvEnviar()">Enviar</button></div>
    <div class="cv-fim"><span>Finalizar atendimento:</span><select id="cvMotivo" onchange="motivoMudou('cvMotivo','cvMotivoOutro')">${motivoOpcoes()}</select><input id="cvMotivoOutro" hidden maxlength="150" placeholder="Qual o motivo?" style="border:1px solid #e3e8ef;border-radius:8px;padding:6px"><button class="bt" onclick="cvFinalizar()">✔ Finalizar</button></div>`;}
  el.querySelector('.cv-top').innerHTML=`<div><button class="bt cv-volta" onclick="cvFechar()">← voltar</button><b>${esc(l.nome||fmtTel(l.telefone))}</b><br><span>${fmtTel(l.telefone)} · ${esc(l.situacao||'')} · <b style="color:#0f7a4f">📱 falando pelo ${esc(cvNumDe(l.instancia))}</b></span></div>
     <div>${l.humano?`<span style="color:#1f55c4;font-weight:700">🧑 Você está atendendo (IA pausada)</span> <button class="bt" onclick="cvDevolver()">Devolver para a IA</button>`:'<span>🤖 A IA está atendendo. Se você responder, ela pausa.</span>'}</div>`;
  const box=el.querySelector('.cv-msgs'),fim=box.scrollTop+box.clientHeight>=box.scrollHeight-40,html=M.map(m=>`<div class="cv-b ${m.dir==='entrada'?'in':'out'} ${m.modo==='humano'?'hum':''}">${esc(m.txt)}<small>${m.dir==='entrada'?'cliente':esc(MODO_TX[m.modo]||'IA')} · ${hora(m.em)}${m.dir==='saida'?(m.erro||m.st==='ERROR'?' · ❌ não entregou':(m.st==='READ'||m.st==='PLAYED')?' <span style="color:#1d9bf0" title="lida">✓✓</span>':m.st==='DELIVERY_ACK'?' <span title="entregue">✓✓</span>':m.enviado?' <span title="enviada (ainda não entregue)">✓</span>':' · enviando…'):''}</small></div>`).join('')||'<div class="vazio">Sem mensagens.</div>';
  if(box.dataset.h!==html){box.dataset.h=html;box.innerHTML=html;if(rolar||fim)box.scrollTop=box.scrollHeight;}}
async function cvFinalizar(){if(!cvSel)return;const m=motivoValor('cvMotivo','cvMotivoOutro');if(m==null)return;if(!confirm('Finalizar o atendimento deste cliente como "'+m+'"?'))return;
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
function nmRender(){const N=(nmD&&nmD.numeros)||[],mal=N.filter(n=>n.estado!=='open'||n.trava_ate).length,bd=document.getElementById('nmBadge');bd.hidden=!mal;bd.textContent=mal;
  const cpn=N.filter(n=>n.campanha&&n.estado==='open').length,cpe=document.getElementById('nmCamp');if(cpe)cpe.textContent=`📤 Campanha: ${cpn} número(s) conectados e marcados = ${cpn} mensagem(ns) ao mesmo tempo a cada 5 min.`;const el=document.getElementById('nmLista');if(el)el.innerHTML=N.map(n=>{const ok=n.estado==='open';return `<div class="nm-c ${ok?'':'mal'}"><b>${fmtTel(n.numero)}</b> <small style="display:inline">${esc(n.nome)} · ${n.motor==='waha'?'GM Cred Zap':'Evolution'}</small><br>
    <span class="nm-st" style="background:${ok?'#e3f7ee':'#fde8e8'};color:${ok?'#0f7a4f':'#b42318'}">${ok?'🟢':'🔴'} ${esc(n.situacao)}</span>${!ok&&n.caiu_em?`<small>caiu ${quando(n.caiu_em)}</small>`:''}${n.trava_ate?`<span class="nm-st" style="background:#fff4e5;color:#b54708" title="O WhatsApp travou esse número para iniciar conversa com quem não é contato. Ele fica fora da campanha sozinho até lá.">⚠️ Restrito pelo WhatsApp até ${new Date(n.trava_ate).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>`:''}
    <input type="text" value="${esc(n.aparelho||'')}" placeholder="Onde está? ex.: Motorola · slot 2" onchange="nmCarregar('salvar',{nome:'${n.nome}',aparelho:this.value})">
    <small>${n.enviadas_hoje} enviadas · ${n.entregues_hoje||0} entregues hoje${n.falhas_hoje?` · <span style="color:#b42318">${n.falhas_hoje} falhas</span>`:''} · ${n.maturadas_hoje} no maturador</small>
    <label class="nm-fn">Função <select onchange="nmCarregar('salvar',{nome:'${n.nome}',funcao:this.value})"><option value="disparo" ${(n.funcao||'disparo')==='disparo'?'selected':''}>Disparo (campanha)</option><option value="atendimento" ${n.funcao==='atendimento'?'selected':''}>Atendimento (não dispara)</option><option value="reserva" ${n.funcao==='reserva'?'selected':''}>Reserva / avisos</option></select></label>
    ${(n.funcao||'disparo')==='disparo'?`<label style="display:flex;gap:6px;align-items:center;margin-top:6px;font-size:13px"><input type="checkbox" ${n.campanha?'checked':''} onchange="nmCarregar('salvar',{nome:'${n.nome}',campanha:this.checked})"> 📤 usar na campanha</label>`:''}
    <label style="display:flex;gap:6px;align-items:center;margin-top:6px;font-size:13px"><input type="checkbox" ${n.maturar?'checked':''} onchange="nmCarregar('salvar',{nome:'${n.nome}',maturar:this.checked})"> usar no maturador</label>
    ${ok?`<button class="bt" style="margin-top:8px" onclick="nmTeste('${n.nome}','${fmtTel(n.numero)}')">✉️ Testar envio</button>`:`<button class="bt pri" style="margin-top:8px" onclick="nmQr('${n.nome}','${fmtTel(n.numero)}')">Conectar (QR code)</button>`} <button class="bt" style="margin-top:8px" title="Tirar do painel" onclick="nmExcluir('${n.nome}','${fmtTel(n.numero)}')">🗑️ Excluir</button></div>`;}).join('')||'<div class="vazio">Nenhum número.</div>';
  const M=(nmD&&nmD.maturador)||{},cf=document.getElementById('mtCfg'),mats=N.filter(n=>n.maturar);
  if(cf)cf.innerHTML=`<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><button class="bt ${M.ativo?'':'pri'}" onclick="nmCarregar('maturador',{ativo:${!M.ativo}})">${M.ativo?'⏸️ Pausar maturador':'▶️ Ligar maturador'}</button>
    <span>${M.ativo?'🟢 ligado':'⏸️ pausado'} · 1 mensagem a cada ~<input type="number" min="3" max="120" value="${M.intervalo_min||8}" style="width:60px" onchange="nmCarregar('maturador',{intervalo_min:this.value})"> min</span>
    <span>${mats.length} número(s) marcados: ${mats.map(n=>fmtTel(n.numero)).join(', ')||'nenhum — marque na aba Números'}${mats.length===1?' (precisa de pelo menos 2)':''}</span></div>`;
  const U=(nmD&&nmD.ultimas)||[],ul=document.getElementById('mtUlt');if(ul)ul.innerHTML=U.length?`<div class="rs-tab"><table><tr><th>Hora</th><th>De</th><th>Para</th><th style="text-align:left">Mensagem</th><th>Enviada</th></tr>${U.map(u=>`<tr><td>${quando(u.em)}</td><td>${esc(u.de)}</td><td>${esc(u.para)}</td><td style="text-align:left">${esc(u.texto)}</td><td>${u.ok?'✓':'…'}</td></tr>`).join('')}</table></div>`:'<div class="vazio">Nenhuma mensagem ainda.</div>';}
async function nmNovo(){const ap=prompt('Onde vai ficar esse chip? (ex.: Motorola · slot 4)');if(ap===null)return;
  const q=document.getElementById('nmQr');document.getElementById('nmQrT').textContent='Novo número';document.getElementById('nmQrImg').innerHTML='<div class="vazio">Criando o número…</div>';q.hidden=false;
  const r=await nmApi('criar',{aparelho:ap});
  if(r&&r.criado){nmCarregar();nmQr(r.criado,r.criado+(ap?' · '+ap:''));}
  else document.getElementById('nmQrImg').innerHTML='<div class="vazio">Não consegui criar o número agora. Tente de novo.</div>';}
async function nmTeste(nome,tel){const destino=prompt('Enviar teste a partir do '+tel+'.\nPara qual número? (com DDD)',lsGet('escritorio_teste_dest')||'48996077545');if(!destino)return;
  const mensagem=prompt('Escreva a mensagem de teste:','Teste de envio pelo '+tel);if(!mensagem)return;lsSet('escritorio_teste_dest',destino);
  const r=await nmApi('testar',{nome,destino:destino.replace(/\D/g,'').replace(/^(?!55)/,'55'),mensagem});
  alert(r&&r.ok?'✅ O WhatsApp aceitou o envio. Confira se a mensagem chegou no celular de destino.':'❌ Não consegui enviar: '+((r&&r.detalhe)||'erro'));}
function nmExcluir(nome,tel){if(!confirm('Excluir o número '+(tel||nome)+' do painel?\n\nEle sai da campanha e do maturador e para de gerar alerta. Para usar de novo depois, é só criar um novo número.'))return;nmCarregar('excluir',{nome});}
let nmQrVez=0;
async function nmQr(nome,tel,vez){const q=document.getElementById('nmQr'),img=document.getElementById('nmQrImg');
  if(!vez){vez=1;nmQrVez++;document.getElementById('nmQrT').textContent='Conectar '+tel;img.innerHTML='<div class="vazio">Gerando QR… (pode levar uns 20 segundos)</div>';q.hidden=false;}
  const eu=nmQrVez,r=await nmApi('qr',{nome,reiniciar:(vez===1||vez===8)?'true':'false'});if(q.hidden||eu!==nmQrVez)return;
  if(r&&r.estado==='open'){img.innerHTML='<div class="vazio">✅ Número conectado!</div>';nmCarregar();return;}
  if(r&&r.qr)img.innerHTML=`<img alt="QR code" src="${r.qr.startsWith('data:')?r.qr:'data:image/png;base64,'+r.qr}"><small style="display:block;margin-top:6px">No celular: WhatsApp → Aparelhos conectados → Conectar aparelho. O QR se atualiza sozinho.</small>`;
  else if(vez>=12){img.innerHTML='<div class="vazio">Não consegui gerar o QR agora. Feche e tente de novo.</div>';return;}
  setTimeout(()=>nmQr(nome,tel,vez+1),r&&r.qr?15000:3000);}
function nmLigar(on){clearInterval(nmTimer);nmTimer=null;if(on){nmCarregar();nmTimer=setInterval(()=>{if(!document.hidden&&document.getElementById('nmQr').hidden)nmCarregar();},10000);}}

let inD=null;
async function inApi(acao,extra){if(demo)return null;if(!chave){pedirChave();return null;}
  const r=await fetch(BASE+'/escritorio/indicacoes',{method:'POST',body:new URLSearchParams({k:chave,acao,...(extra||{})})});
  if(r.status===401){pedirChave('Chave inválida ou desativada.');return null;}return r.ok?r.json():null;}
async function inCarregar(acao,extra){const r=await inApi(acao||'ver',extra);if(r&&r.erro){alert(r.erro);}if(r&&r.indicadores){inD=r;inRender();}}
async function inNovo(){const nome=prompt('Nome completo de quem vai indicar:');if(!nome)return;const cpf=prompt('CPF:');if(!cpf)return;const pix=prompt('Chave PIX:');if(!pix)return;const tel=prompt('Telefone com DDD (opcional):')||'';
  await inCarregar('cadastrar',{nome,cpf,pix,telefone:tel});}
async function inPagar(id,nome,v){if(!confirm('Confirmar que você pagou '+brlFull(v)+' para '+nome+'? O valor vai para o Financeiro.'))return;await inCarregar('pagar',{id});}
function inCopiar(t){try{navigator.clipboard.writeText(t);}catch(e){}}
const IN_ST={aberta:['Em andamento','#eaf1ff','#1f55c4'],creditada:['Fechou · creditada','#e3f7ee','#0f7a4f']};
function inRender(){const D=inD||{},I=D.indicadores||[],X=D.indicacoes||[],pagar=I.filter(i=>+i.saldo>0);
  document.getElementById('inResumo').innerHTML=`<div><b>${I.length}</b><span>Indicadores</span></div><div><b>${X.length}</b><span>Indicações</span></div><div><b>${X.filter(x=>x.status==='creditada').length}</b><span>Fecharam</span></div><div><b style="color:var(--verde)">${brlFull(pagar.reduce((a,i)=>a+ +i.saldo,0))}</b><span>A pagar · pago no mês ${brlFull(D.pago_mes||0)}</span></div>`;
  document.getElementById('inPagar').innerHTML=pagar.length?`<div class="rs-tab"><table><tr><th>Indicador</th><th>Chave PIX</th><th>Saldo</th><th></th></tr>${pagar.map(i=>`<tr><td>${esc(i.nome)} <small>${esc(i.codigo)}</small></td><td style="text-align:left">${esc(i.pix||'—')} <button class="bt" onclick="inCopiar('${esc(i.pix||'')}')">copiar</button></td><td><b>${brlFull(i.saldo)}</b></td><td><button class="bt pri" onclick="inPagar(${i.id},'${esc(i.nome)}',${+i.saldo})">Marcar como pago</button></td></tr>`).join('')}</table></div><div class="rs-nota">Saldo entra aqui quando o contrato do indicado é pago. No fim do mês, pague todos os saldos.</div>`:'<div class="vazio">Nada a pagar agora.</div>';
  document.getElementById('inLista').innerHTML=I.length?`<div class="rs-tab"><table><tr><th>Nome</th><th>Código</th><th>Link</th><th>Indicações</th><th>Fecharam</th><th>Ganho</th><th>Saldo</th></tr>${I.map(i=>`<tr><td>${esc(i.nome)}<br><small>${fmtTel(i.telefone||'')}</small></td><td><b>${esc(i.codigo)}</b></td><td><button class="bt" onclick="inCopiar('${esc(i.link)}')">copiar link</button></td><td>${i.indicacoes}</td><td>${i.fechadas}</td><td>${brlFull(i.ganho)}</td><td>${brlFull(i.saldo)}</td></tr>`).join('')}</table></div>`:'<div class="vazio">Ninguém cadastrado ainda. A Ana oferece o programa sozinha; você também pode cadastrar aqui.</div>';
  document.getElementById('inInd').innerHTML=X.length?`<div class="rs-tab"><table><tr><th>Indicado</th><th>Quem indicou</th><th>Como chegou</th><th>Situação</th><th>Status</th><th>Valor</th></tr>${X.map(x=>{const st=IN_ST[x.status]||[x.status,'#eef1f5','#5b6878'];return `<tr><td>${esc(x.nome||'—')}<br><small>${fmtTel(x.telefone||'')}</small></td><td>${esc(x.indicador)} <small>${esc(x.codigo)}</small></td><td>${x.origem==='link'?'🔗 link/código':'📇 contato passado'}</td><td>${esc(x.situacao||'—')}</td><td><span class="sit" style="background:${st[1]};color:${st[2]}">${st[0]}</span></td><td>${x.valor!=null?brlFull(x.valor):'—'}</td></tr>`;}).join('')}</table></div>`:'<div class="vazio">Nenhuma indicação ainda.</div>';}
async function cpCarregar(acao,extra){acao=acao||'ver';extra=extra||{};
  try{if(demo)cpDados=cpDemoApi(acao,extra);
    else{if(!chave){pedirChave();return;}const r=await fetch(BASE+'/escritorio/campanha',{method:'POST',body:new URLSearchParams({k:chave,acao,...extra})});
      if(r.status===401){pedirChave('Chave inválida ou desativada.');return;}if(!r.ok)throw new Error('HTTP '+r.status);cpDados=await r.json();}
    if(cpDados.aviso&&['importar','remover'].includes(acao))document.getElementById('cpAviso').textContent='✅ '+cpDados.aviso;
  }catch(e){document.getElementById('cpAviso').textContent='Não consegui falar com o servidor ('+e.message+').';return;}
  renderCampanha();}
async function cpImportar(){if(!cpLinhas.length)return;const b=document.getElementById('cpImp');b.disabled=true;await cpCarregar('importar',{linhas:JSON.stringify(cpLinhas)});document.getElementById('cpTexto').value='';cpAtualizarPrev();}
function cpSalvarMsg(){const m=document.getElementById('cpMsg').value.trim();if(m.length<20){document.getElementById('cpMsgOk').textContent='Mensagem muito curta.';return;}cpCarregar('mensagem',{mensagem:m}).then(()=>{document.getElementById('cpMsgOk').textContent='✅ Salva';});}
function cpAlternar(){if(!cpDados)return;const at=!(cpDados.config||{}).ativa;if(at&&!confirm('Começar a enviar? Será 1 mensagem a cada '+((cpDados.config||{}).intervalo_min||5)+' minutos, das '+((cpDados.config||{}).hora_inicio||8)+'h às '+((cpDados.config||{}).hora_fim||20)+'h.'))return;cpCarregar(at?'ativar':'pausar');}
let cpSel=lsGet('escritorio_cpnum')||'',cpEd=null,cpEdMsg='';
function cpRenderPlacar(){const P=(cpDados&&cpDados.placar)||[],tabs=document.getElementById('cpTabs'),ed=document.getElementById('cpEditor');if(!tabs||!ed)return;
  if(!P.length){tabs.innerHTML='';ed.innerHTML='<div class="vazio">Nenhum número marcado para a campanha. Marque em Configurações › Números.</div>';return;}
  if(!P.some(x=>x.nome===cpSel))cpSel=(P.find(x=>x.ativo)||P[0]).nome;
  tabs.innerHTML=P.map(x=>{const e=+x.enviadas||0;return `<button role="tab" aria-selected="${x.nome===cpSel}" class="${x.nome===cpSel?'on':''}" onclick="cpEscolher('${x.nome}')"><b>${fmtTel(x.numero)||x.nome}</b><small>${x.funcao==='atendimento'?'atendimento · ':x.funcao==='reserva'?'reserva · ':x.ativo?'':'fora da campanha · '}${e} enviadas · ${x.responderam} resp.${e?' ('+Math.round(x.responderam/e*100)+'%)':''}${x.atendimento?' · '+x.atendimento+' no atend.':''}</small></button>`;}).join('');
  if(cpEd&&cpEd.nome===cpSel&&ed.contains(document.activeElement))return;
  if(!cpEd||cpEd.nome!==cpSel){const x=P.find(y=>y.nome===cpSel),xe=x.extra||{};cpEd={nome:x.nome,botoes_ok:!!x.botoes,mensagem:x.mensagem||'',imagem:xe.imagem||'',rodape:xe.rodape||'',botoes:(xe.botoes||[]).map(b=>({tipo:['link','atendimento'].includes(b.tipo)?b.tipo:'resposta',texto:b.texto||'',url:b.url||''})),sujo:false};}
  cpDesenharEditor();}
function cpEscolher(n){if(cpEd&&cpEd.sujo&&!confirm('Tem alterações não salvas nesse número. Trocar mesmo assim?'))return;cpSel=n;lsSet('escritorio_cpnum',n);cpEd=null;cpEdMsg='';cpRenderPlacar();}
function cpDesenharEditor(){const E=cpEd,ed=document.getElementById('cpEditor');if(!E)return;
  const T=(cpDados&&cpDados.testes||[]).filter(t=>t.instancia===E.nome).slice(0,2);
  ed.innerHTML=`<div class="cpe">
  <div class="cpe-form">
    ${(()=>{const x=(cpDados.placar||[]).find(y=>y.nome===E.nome)||{},A=cpDados.atendimento||{};return x.funcao==='atendimento'?'<div class="cpe-cap">Este é o número de <b>atendimento</b>: ele não dispara. A mensagem abaixo só vale para testes.</div>':'';})()}
    <div class="cpe-cap ${E.botoes_ok?'ok':''}">${E.botoes_ok?'✓ Este número envia imagem e botões.':'Este número ainda não envia botões nem imagem: os botões de <b>link</b> vão como link no fim do texto, e imagem e respostas rápidas não vão. Funciona nos números do servidor novo.'}</div>
    <label class="cpe-l">Texto<textarea id="cpeTxt" rows="5" class="cp-txt" maxlength="600" oninput="cpEd.mensagem=this.value;cpMudou()">${esc(E.mensagem)}</textarea><small class="cpe-h">*negrito* · _itálico_ · {nome} vira o primeiro nome · pule linha normalmente</small></label>
    <div class="cpe-l">Imagem <small class="cpe-h">(vai junto com os botões, no topo da mensagem)</small>
      <div class="cpe-img">${E.imagem?`<img src="${esc(E.imagem)}" alt="Imagem da mensagem"><button class="bt" onclick="cpEd.imagem='';cpMudou(true)">Remover</button>`:''}<label class="bt" style="cursor:pointer">${E.imagem?'Trocar':'+ Escolher imagem'}<input type="file" accept="image/*" hidden onchange="cpSubirImagem(this)"></label><span class="cp-prev" id="cpeImgSt"></span></div></div>
    <label class="cpe-l">Rodapé <small class="cpe-h">(opcional, texto cinza pequeno)</small><input id="cpeRod" class="cpe-in" maxlength="60" value="${esc(E.rodape)}" placeholder="GM Cred · crédito CLT" oninput="cpEd.rodape=this.value;cpMudou()"></label>
    <div class="cpe-l">Botões <small class="cpe-h">(até 3 · texto do botão com até 20 letras)</small>
      ${E.botoes.map((b,i)=>`<div class="cpe-bt"><select aria-label="Tipo do botão ${i+1}" onchange="cpEd.botoes[${i}].tipo=this.value;cpMudou(true)"><option value="resposta" ${b.tipo==='resposta'?'selected':''}>Resposta rápida</option>${b.tipo==='atendimento'?'<option value="atendimento" selected>Chamar no atendimento</option>':''}<option value="link" ${b.tipo==='link'?'selected':''}>Abrir link</option></select>
        <input class="cpe-in" maxlength="20" placeholder="${b.tipo==='resposta'?'Ex.: Não tenho interesse':'Ex.: Quero simular'}" value="${esc(b.texto)}" aria-label="Texto do botão ${i+1}" oninput="cpEd.botoes[${i}].texto=this.value;cpMudou()">
        ${b.tipo==='link'?`<input class="cpe-in cpe-url" placeholder="https://wa.me/55..." value="${esc(b.url)}" aria-label="Link do botão ${i+1}" oninput="cpEd.botoes[${i}].url=this.value;cpMudou()">`:''}
        <button class="bt cpe-x" title="Tirar botão" aria-label="Tirar botão ${i+1}" onclick="cpEd.botoes.splice(${i},1);cpMudou(true)">✕</button></div>`).join('')}
      ${E.botoes.length<3?`<button class="bt" onclick="cpEd.botoes.push({tipo:'resposta',texto:'',url:''});cpMudou(true)">+ Adicionar botão</button>`:''}</div>
    <div class="cp-linha"><button class="bt pri" onclick="cpSalvarEd()">Salvar mensagem</button><button class="bt" onclick="cpTestarEd()">Enviar teste para mim</button><span class="cp-prev" id="cpeSt">${esc(cpEdMsg)}</span></div>
    ${T.length?`<div class="cpe-testes">${T.map(t=>`<span>Teste das ${new Date(t.criado_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}: ${t.enviado_em?'<b style="color:#0f7a4f">enviado ✓</b>':t.erro?'<b style="color:#b42318">não saiu</b> <small>'+esc(t.erro)+'</small>':'na fila…'}</span>`).join('')}</div>`:''}
  </div>
  <div class="cpe-prev" aria-label="Prévia no WhatsApp"><div class="wa"><div class="wa-bal" id="cpePrev"></div></div><small class="cpe-h">Prévia aproximada · {nome} aparece como “Maria”</small></div>
  </div>`;
  cpPrevia();}
function cpMudou(redesenhar){cpEd.sujo=true;cpEdMsg='alterações não salvas';const st=document.getElementById('cpeSt');if(st)st.textContent=cpEdMsg;if(redesenhar)cpDesenharEditor();else cpPrevia();}
function cpFmtWa(t){return esc(t).replace(/\*([^*\n]+)\*/g,'<b>$1</b>').replace(/_([^_\n]+)_/g,'<i>$1</i>').replace(/\n/g,'<br>');}
function cpPrevia(){const E=cpEd,el=document.getElementById('cpePrev');if(!E||!el)return;const ok=E.botoes_ok,bts=E.botoes.filter(b=>b.texto.trim());
  let txt=E.mensagem.replace(/\{nome\}/g,'Maria');if(!ok){const at=(cpDados.atendimento||{}).link||'',L=bts.filter(b=>(b.tipo==='link'&&b.url.trim())||(b.tipo==='atendimento'&&at));if(L.length)txt+='\n\n'+L.map(b=>'👉 '+b.texto+': '+(b.tipo==='atendimento'?at.split('?')[0]:b.url)).join('\n');}
  const comBt=ok&&bts.length;
  el.innerHTML=`${comBt&&E.imagem?`<img src="${esc(E.imagem)}" alt="">`:''}<div class="wa-tx">${cpFmtWa(txt)||'<span style="color:#98a2b3">Escreva a mensagem…</span>'}</div>${comBt&&E.rodape.trim()?`<div class="wa-rod">${esc(E.rodape)}</div>`:''}<div class="wa-hora">12:00</div>${comBt?bts.map(b=>`<div class="wa-bt">${b.tipo!=='resposta'?'<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>':'<svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>'}${esc(b.texto)}</div>`).join(''):''}`;}
function cpValidarEd(){const E=cpEd;if(E.mensagem.trim().length<15)return 'A mensagem está muito curta.';
  for(const b of E.botoes){if(!b.texto.trim())return 'Tem botão sem texto. Preencha ou tire o botão.';if(b.tipo==='link'&&!/^https?:\/\/\S+$/.test(b.url.trim()))return 'O link do botão “'+b.texto+'” precisa começar com https://';}
  if(E.imagem&&!E.botoes.length)return 'A imagem só vai junto com pelo menos 1 botão.';return '';}
async function cpSalvarEd(){const erro=cpValidarEd();if(erro){cpEdMsg='⚠️ '+erro;document.getElementById('cpeSt').textContent=cpEdMsg;return;}
  const E=cpEd,extra={imagem:E.imagem,rodape:E.rodape.trim(),botoes:E.botoes.map(b=>({tipo:b.tipo,texto:b.texto.trim(),url:b.url.trim()}))};
  document.getElementById('cpeSt').textContent='Salvando…';E.sujo=false;
  await cpCarregar('msg_salvar',{nome:E.nome,mensagem:E.mensagem.trim(),extra:JSON.stringify(extra)});
  cpEdMsg=cpDados&&cpDados.erro?'⚠️ '+cpDados.erro:'✅ Salvo. As próximas mensagens desse número já saem assim.';cpEd=null;cpRenderPlacar();}
async function cpTestarEd(){if(cpEd&&cpEd.sujo){cpEdMsg='Salve antes de testar.';document.getElementById('cpeSt').textContent=cpEdMsg;return;}
  await cpCarregar('msg_teste',{nome:cpSel});cpEdMsg=cpDados&&cpDados.erro?'⚠️ '+cpDados.erro:'📲 Teste na fila: chega no seu WhatsApp em até 2 minutos.';cpEd=null;cpRenderPlacar();if(cpDados&&!cpDados.erro)cpAcompanharTeste(0);}
function cpAcompanharTeste(i){setTimeout(async()=>{if(telaAtual!=='campanha'||(cpEd&&cpEd.sujo))return;await cpCarregar('ver');const t=(cpDados&&cpDados.testes||[])[0];if(t&&!t.enviado_em&&!t.erro&&i<12)cpAcompanharTeste(i+1);else if(t&&t.enviado_em){cpEdMsg='✅ Teste enviado: confira no seu WhatsApp.';const st=document.getElementById('cpeSt');if(st)st.textContent=cpEdMsg;}},15000);}
function cpSubirImagem(inp){const f=inp.files&&inp.files[0];if(!f)return;const st=document.getElementById('cpeImgSt');st.textContent='Preparando…';
  const img=new Image(),u=URL.createObjectURL(f);img.onload=async()=>{URL.revokeObjectURL(u);const m=1080,k=Math.min(1,m/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
    const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(img,0,0,c.width,c.height);const d=c.toDataURL('image/jpeg',.85).split(',')[1];st.textContent='Enviando…';
    const nome=cpEd.nome,keep=cpEd;await cpCarregar('imagem',{dados:d});if(cpDados&&cpDados.imagem_url){cpEd=keep;cpEd.imagem=cpDados.imagem_url;cpMudou(true);}else{const s2=document.getElementById('cpeImgSt');if(s2)s2.textContent='⚠️ '+((cpDados&&cpDados.erro)||'não consegui enviar a imagem');}};
  img.onerror=()=>{st.textContent='⚠️ Arquivo de imagem inválido.';};img.src=u;}
function renderCampanha(){const D=cpDados;if(!D)return;cpRenderPlacar();const C=D.config||{},fila=Number(D.na_fila||0),iv=Number(C.intervalo_min||5),nAt=Math.max(1,((D.placar||[]).filter(x=>x.ativo).length));
  const b=document.getElementById('cpBtn');b.textContent=C.ativa?'Pausar envios':'Começar envios';b.className='bt cp-liga '+(C.ativa?'':'pri');
  const m=document.getElementById('cpMsg');if(m&&document.activeElement!==m)m.value=C.mensagem||'';
  const horas=fila*iv/60/nAt;
  document.getElementById('cpResumo').innerHTML=`
    <div><span class="big">${fila}</span>na fila · ${fila?`termina em ~${horas<1?Math.ceil(fila*iv/nAt)+' min':horas.toFixed(1).replace('.',',')+' h'} de envio (${nAt} ao mesmo tempo a cada ${iv} min, das ${C.hora_inicio||8}h às ${C.hora_fim||20}h)`:'importe clientes ao lado'}</div>
    <div><span class="big" style="color:#0f7a4f">${D.enviados||0}</span>mensagens enviadas · <b>${D.responderam||0}</b> responderam${D.erros?` · <span style="color:#b42318">${D.erros} com erro</span>`:''}</div>
    <div><span class="big" style="color:${C.ativa?'#0f7a4f':'#8a6200'}">${C.ativa?'Enviando':'Pausada'}</span>${C.instancia?'por '+nAt+' número'+(nAt>1?'s':'')+' ao mesmo tempo':'⚠️ nenhum número de WhatsApp ligado à campanha ainda'}</div>`;
  const L=D.contatos||[];
  document.getElementById('cpLista').innerHTML=`<h4>👥 Clientes da campanha · ${L.length}</h4>${L.length?`<div class="crm-tab"><div class="crm-l crm-h"><span>Cliente</span><span>Telefone</span><span>CPF</span><span>Situação</span><span>Margem</span><span>Enviado</span></div>${L.map(c=>{const st=c.status==='enviado'&&c.situacao?[c.situacao,...(/^(Número errado|Não contatar)|não entregue/.test(c.situacao)?['#fde8e8','#b42318']:/^Prospecção · (entregue|lida)/.test(c.situacao)?['#e3f7ee','#0f7a4f']:/^Prospecção/.test(c.situacao)?['#eef1f5','#5b6878']:['#fff4dc','#a15c00'])]:c.status==='erro'&&c.erro?[c.erro,'#fde8e8','#b42318']:(CP_ST[c.status]||['—','#eef1f5','#5b6878']);
      return `<div class="crm-l" ${c.lead_id?`onclick="abrirPainel('cliente:${c.lead_id}')"`:'style="cursor:default"'}><span class="c-nome"><b>${esc(c.nome||'Sem nome')}</b></span><span class="c-tel">${fmtTel(c.telefone)}</span><span class="c-cpf">${esc(c.cpf||'—')}</span><span class="c-sit"><span class="cp-st" style="background:${st[1]};color:${st[2]}" title="${esc(c.erro||'')}">${st[0]}</span>${c.status==='na_fila'?` <button class="lnk-a" style="font-size:11.5px" onclick="event.stopPropagation();cpCarregar('remover',{id:'${c.id}'})">remover</button>`:''}</span><span class="c-of">${c.margem?brlFull(c.margem):'—'}</span><span class="c-ult">${c.enviado_em?quando(c.enviado_em):'—'}</span></div>`;}).join('')}</div>`:'<div class="vazio">Nenhum cliente importado ainda.</div>'}`;}


