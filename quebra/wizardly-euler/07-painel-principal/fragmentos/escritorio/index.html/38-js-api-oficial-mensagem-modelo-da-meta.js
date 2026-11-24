// ═════════════ API OFICIAL (mensagem modelo da Meta) ═════════════
let ofD=null,ofSel=+(lsGet('escritorio_of')||0),ofEd=null,ofMsg='',ofLinhas=[],ofCxAberta=false,ofTimer=null;
const OF_CT={na_fila:['Na fila','#eef1f5','#5b6878'],enviando:['Enviando','#eaf1ff','#1e40af'],enviado:['Enviada','#eaf1ff','#1e40af'],sent:['Enviada','#eaf1ff','#1e40af'],delivered:['Entregue','#e3f7ee','#0f7a4f'],read:['Lida','#e3f7ee','#0f7a4f'],falhou:['Falhou','#fde8e8','#b42318'],teste:['Teste','#fff4dc','#8a6200'],teste_ok:['Teste enviado','#e3f7ee','#0f7a4f'],teste_falhou:['Teste falhou','#fde8e8','#b42318']};
async function ofCarregar(acao,extra){acao=acao||'ver';extra=extra||{};
  if(demo){document.getElementById('ofLista').innerHTML='<div class="vazio">Disponível só com o sistema ligado.</div>';return null;}
  if(!chave){pedirChave();return null;}
  try{const r=await fetch(BASE+'/escritorio/oficial',{method:'POST',body:new URLSearchParams({k:chave,acao,id:acao==='criar'?'':(ofSel||''),...extra})});
    if(r.status===401){pedirChave('Chave inválida ou desativada.');return null;}if(!r.ok)throw new Error('HTTP '+r.status);ofD=await r.json();}
  catch(e){ofMsg='⚠️ Não consegui falar com o servidor ('+e.message+').';ofRender();return null;}
  if(acao==='criar'&&ofD.atual){ofSel=ofD.atual;lsSet('escritorio_of',ofSel);ofEd=null;}
  if(acao==='apagar'){ofSel=0;ofEd=null;}
  
  ofMsg=ofD.erro?'⚠️ '+ofD.erro:(ofD.aviso?'✓ '+ofD.aviso:(acao==='ver'?ofMsg:''));
  ofRender();ofAgendar();return ofD;}
function ofAgendar(){clearTimeout(ofTimer);if(telaAtual!=='oficial')return;const at=(ofD&&ofD.disparos||[]).some(d=>d.status==='ativo');ofTimer=setTimeout(()=>{if(telaAtual==='oficial'&&!(ofEd&&ofEd.sujo))ofCarregar('ver');else ofAgendar();},at?15000:60000);}
function ofAtual(){return (ofD&&ofD.disparos||[]).find(d=>d.id===ofSel)||null;}
function ofEscolher(id){if(ofEd&&ofEd.sujo&&!confirm('Tem alterações não salvas. Trocar mesmo assim?'))return;ofSel=id;lsSet('escritorio_of',id);ofEd=null;ofMsg='';ofCarregar('ver');}
function ofBms(){return (ofD&&ofD.conexao&&ofD.conexao.bms)||[];}
function ofBmAtual(){const d=ofEd||ofAtual()||{},L=ofBms();return L.find(b=>+b.id===+d.bm_id)||null;}
function ofTpls(){const b=ofBmAtual();return ((b&&b.templates)||[]).filter(t=>t.status==='APPROVED');}
function ofBmNome(b){const n=b.numero||{};return b.nome+' · '+(n.telefone||b.phone_id||'sem número')+(b.ativo?'':' (desativada)');}
function ofVars(txt){const m=String(txt||'').match(/\{\{\s*(\d+)\s*\}\}/g)||[];return Math.max(0,...m.map(x=>+x.replace(/\D/g,'')));}
const OF_Q={GREEN:['Alta','#0f7a4f'],YELLOW:['Média','#8a6200'],RED:['Baixa','#b42318'],UNKNOWN:['Sem nota ainda','#5b6878'],HIGH:['Alta','#0f7a4f'],MEDIUM:['Média','#8a6200'],LOW:['Baixa','#b42318']};
function ofQ(q){const x=OF_Q[String(q||'').toUpperCase()];return x?`<b style="color:${x[1]}">${x[0]}</b>`:esc(q||'—');}
function ofLimite(t){const m={TIER_50:'50',TIER_250:'250',TIER_1K:'1.000',TIER_10K:'10.000',TIER_100K:'100.000',TIER_UNLIMITED:'ilimitado'};return m[t]?m[t]+' clientes por dia':esc(t||'—');}
function ofEvTxt(e){const v=e.valor||{},c=e.campo;
  if(c==='phone_number_quality_update')return `📶 Número ${esc(v.display_phone_number||'')}: ${({FLAGGED:'qualidade caiu (sinalizado)',UNFLAGGED:'qualidade voltou ao normal',UPGRADE:'limite aumentou',DOWNGRADE:'limite diminuiu',ONBOARDING:'em análise'})[v.event]||esc(v.event)}${v.current_limit?' · limite '+ofLimite(v.current_limit):''}`;
  if(c==='message_template_status_update')return `📝 Modelo “${esc(v.message_template_name)}”: ${({APPROVED:'aprovado',REJECTED:'reprovado',PAUSED:'pausado pela Meta',DISABLED:'desativado',PENDING_DELETION:'em exclusão',FLAGGED:'sinalizado',REINSTATED:'reativado'})[v.event]||esc(v.event)}${v.reason&&v.reason!=='NONE'?' · motivo: '+esc(v.reason):''}`;
  if(c==='message_template_quality_update')return `⭐ Modelo “${esc(v.message_template_name)}”: qualidade ${ofQ(v.previous_quality_score)} → ${ofQ(v.new_quality_score)}`;
  if(c==='template_category_update')return `🏷️ Modelo “${esc(v.message_template_name)}”: categoria ${esc(v.previous_category||'')} → ${esc(v.new_category||'')}`;
  if(c==='account_update'){const ev=v.event;
    if(ev==='DISABLED_UPDATE')return `🚫 <b style="color:#b42318">A Meta desativou a conta do WhatsApp</b>${v.ban_info&&v.ban_info.waba_ban_date?' em '+esc(v.ban_info.waba_ban_date):''}`;
    if(ev==='ACCOUNT_VIOLATION')return `⚠️ <b style="color:#b42318">Violação das regras: ${esc(({SPAM:'spam (mensagens indesejadas)',SCAM:'golpe',ADULT:'conteúdo adulto',ALCOHOL:'álcool',TOBACCO:'tabaco',GAMBLING:'apostas'})[(v.violation_info||{}).violation_type]||((v.violation_info||{}).violation_type||'não informada'))}</b>`;
    if(ev==='ACCOUNT_RESTRICTION')return `⛔ Conta com restrição${v.restriction_info?': '+esc((v.restriction_info[0]||{}).restriction_type||''):''}`;
    if(ev==='VERIFIED_ACCOUNT')return '✅ Conta verificada pela Meta';
    if(ev==='PARTNER_ADDED'||ev==='PARTNER_REMOVED')return '🤝 Parceiro '+(ev==='PARTNER_ADDED'?'adicionado':'removido');
    return `🏢 Conta: ${esc(ev||'atualização')}`;}
  if(c==='account_review_update')return `🔎 Revisão da conta: ${esc(v.decision||'')}`;
  if(c==='business_capability_update')return `📈 Limite da conta: ${v.max_daily_conversation_per_phone?esc(v.max_daily_conversation_per_phone)+' conversas/dia por número':esc(JSON.stringify(v).slice(0,120))}`;
  if(c==='messages_erro')return `⚠️ Erro da Meta: ${esc(((v.errors||[])[0]||{}).title||JSON.stringify(v).slice(0,120))}`;
  return `• ${esc(c)}: ${esc(JSON.stringify(v).slice(0,140))}`;}
function ofEvVis(L){const out=[];(L||[]).forEach(e=>{if(e.campo==='inscricao_app'||(e.campo==='account_update'&&(e.valor||{}).event==='WEBHOOK_CONFIG_UPDATED'))return;const t=ofEvTxt(e),u=out.find(x=>x.t===t);if(u)u.n++;else out.push(Object.assign({t,n:1},e));});return out;}
function ofAlerta(C){const ev=C.eventos||[],ban=(C.numero&&C.numero.status==='BANNED')||ev.some(e=>e.campo==='account_update'&&(e.valor||{}).event==='DISABLED_UPDATE'),vio=ev.find(e=>e.campo==='account_update'&&(e.valor||{}).event==='ACCOUNT_VIOLATION');
  if(!ban)return '';return `<div style="background:#fde8e8;border:1px solid #f5b5b5;color:#7a1414;border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.45"><b>🚫 Número bloqueado pela Meta</b><br>${vio?'Motivo: '+esc(({SPAM:'spam (mensagens indesejadas)'})[(vio.valor.violation_info||{}).violation_type]||(vio.valor.violation_info||{}).violation_type||'não informado')+'.<br>':''}Enquanto estiver assim, nenhuma mensagem sai por esta conta. Peça revisão no Gerenciador do WhatsApp → Visão geral da conta.</div>`;}
function ofRenderCx(){const L=ofBms(),el=document.getElementById('ofCx');if(!el)return;
  const ban=L.find(b=>b.numero&&b.numero.status==='BANNED');
  el.innerHTML=!L.length?'<div class="of-cx"><b>Nenhuma BM cadastrada</b><small>Para disparar pela API oficial, cadastre uma conexão em <a onclick="irPara(\'bms\')" style="cursor:pointer;text-decoration:underline">Configurações › BMs Meta</a>.</small></div>'
    :ban?'<div style="background:#fde8e8;border:1px solid #f5b5b5;color:#7a1414;border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.45"><b>🚫 Número bloqueado pela Meta</b><br>A BM “'+esc(ban.nome)+'” está bloqueada: nenhuma mensagem sai por ela. Veja em <a onclick="irPara(\'bms\')" style="cursor:pointer;text-decoration:underline">Configurações › BMs Meta</a>.</div>':'';}
function ofRender(){if(!ofD)return;ofRenderCx();const L=ofD.disparos||[],el=document.getElementById('ofLista');
  if(ofSel&&!L.some(d=>d.id===ofSel))ofSel=0;if(!ofSel&&L.length){ofSel=L[0].id;}
  el.innerHTML=L.length?L.map(d=>{const st=DP_ST[d.status]||DP_ST.rascunho,R=d.resumo||{},t=+R.total||0,env=+R.enviadas||0;return `<button class="dp-it ${d.id===ofSel?'on':''}" onclick="ofEscolher(${d.id})"><span class="dp-it-t"><b>${esc(d.nome)}</b><span class="cp-st" style="background:${st[1]};color:${st[2]}">${st[0]}</span></span><small>${env} de ${t} enviadas · ${R.chamaram||0} chamaram</small><i style="width:${t?Math.round(env/t*100):0}%"></i></button>`;}).join(''):'<div class="vazio">Nenhum disparo ainda. Clique em “+ Novo”.</div>';
  const det=document.getElementById('ofDet'),d=ofAtual();
  if(!d){det.innerHTML='<div class="fbox"><div class="vazio">Crie um disparo para começar.</div></div>';return;}
  if(ofD.atual!==d.id&&!ofD.contatos){ofCarregar('ver');return;}
  if(!ofEd||ofEd.id!==d.id)ofEd={id:d.id,bm_id:d.bm_id||null,nome:d.nome,template:d.template||'',idioma:d.idioma||'',corpo:(d.corpo||[]).map(v=>({tipo:v.tipo==='nome'?'nome':'texto',texto:v.texto||'',padrao:v.padrao||''})),cabecalho_imagem:d.cabecalho_imagem||'',botao_sufixo:d.botao_sufixo||'',botao_telefone:!!d.botao_telefone,por_minuto:d.por_minuto,hora_inicio:d.hora_inicio,hora_fim:d.hora_fim,sujo:false};
  if(ofEd.sujo&&det.contains(document.activeElement)){ofPintarKpi(d);return;}
  ofDesenhar(d);}
function ofPintarKpi(d){const k=document.getElementById('ofKpi');if(!k)return;const R=d.resumo||{};
  k.innerHTML=[['Na fila',R.na_fila],['Enviadas',R.enviadas],['Entregues',R.entregues],['Lidas',R.lidas],['Clicaram',R.clicaram],['Chamaram o 6775',R.chamaram],['Responderam no oficial',R.responderam],['Falharam',R.falharam]].map(x=>`<div class="dp-k"><b>${+x[1]||0}</b><span>${x[0]}</span></div>`).join('');}
function ofMudou(re){ofEd.sujo=true;const st=document.getElementById('ofSt');if(st)st.textContent='alterações não salvas';if(re)ofDesenhar(ofAtual());}
function ofEscolherTpl(v){const [nome,idioma]=String(v).split('|');const T=ofTpls().find(t=>t.nome===nome&&t.idioma===idioma);ofEd.template=nome||'';ofEd.idioma=idioma||'';
  const n=T?ofVars(T.corpo):0;ofEd.corpo=Array.from({length:n},(_,i)=>ofEd.corpo[i]||{tipo:i===0?'nome':'texto',texto:'',padrao:''});if(!(T&&T.cabecalho==='IMAGE'))ofEd.cabecalho_imagem='';ofEd.botao_telefone=!!ofBotaoVar(T);ofMudou(true);}
function ofDesenhar(d){const E=ofEd,det=document.getElementById('ofDet'),st=DP_ST[d.status]||DP_ST.rascunho,ativo=d.status==='ativo',fim=['encerrado','concluido'].includes(d.status);
  const TP=ofTpls(),T=TP.find(t=>t.nome===E.template&&t.idioma===E.idioma),C=ofD.contatos||[],R=d.resumo||{};
  let prev=T?String(T.corpo||''):'';E.corpo.forEach((v,i)=>{prev=prev.split('{{'+(i+1)+'}}').join(v.tipo==='nome'?'[primeiro nome]':(v.texto||'[texto]'));});
  det.innerHTML=`
  <div class="fbox dp-cab"><div class="dp-cab-t"><input class="dp-nome" value="${esc(E.nome)}" maxlength="60" aria-label="Nome do disparo" oninput="ofEd.nome=this.value;document.getElementById('ofSt').textContent='nome não salvo (saia do campo ou aperte Enter)'" onchange="ofSalvarNome(this)" onkeydown="if(event.key==='Enter')this.blur()"><span class="cp-st" style="background:${st[1]};color:${st[2]}">${st[0]}</span>
    <span class="dp-acoes">${ativo?`<button class="bt" onclick="ofCarregar('pausar')">Pausar</button>`:fim?'':`<button class="bt pri" onclick="ofComecar()">${d.status==='pausado'?'Continuar':'Começar disparo'}</button>`}${!fim&&d.status!=='rascunho'?`<button class="bt" onclick="if(confirm('Encerrar este disparo? Quem ainda está na fila não recebe.'))ofCarregar('encerrar')">Encerrar</button>`:''}${!(+R.enviadas)?`<button class="bt" onclick="if(confirm('Apagar este disparo?'))ofCarregar('apagar')">Apagar</button>`:''}</span></div>
    <div class="cpe-h" id="ofSt" style="margin-top:6px">${esc(ofMsg)}</div>
    <div class="of-k" id="ofKpi"></div></div>
  <div class="fbox"><h4>Enviar por</h4>
    ${ofBms().length?`<select class="of-in" style="width:100%" onchange="ofEscolherBm(this.value)"><option value="">Escolha a BM (número de envio)…</option>${ofBms().map(b=>`<option value="${b.id}" ${+b.id===+E.bm_id?'selected':''} ${b.ativo?'':'disabled'}>${esc(ofBmNome(b))}</option>`).join('')}</select>`:'<div class="vazio">Nenhuma BM cadastrada. Cadastre em Configurações › BMs Meta.</div>'}</div>
  <div class="fbox"><h4>Mensagem modelo</h4>
    ${!E.bm_id?'<div class="vazio">Escolha primeiro a BM de envio.</div>':TP.length?`<select class="of-in" style="width:100%" onchange="ofEscolherTpl(this.value)"><option value="">Escolha uma mensagem aprovada…</option>${TP.map(t=>`<option value="${esc(t.nome+'|'+t.idioma)}" ${t.nome===E.template&&t.idioma===E.idioma?'selected':''}>${esc(t.nome)} · ${esc(t.idioma)} · ${esc((t.categoria||'').toLowerCase())}${t.qualidade?' · qualidade '+esc((OF_Q[String(t.qualidade).toUpperCase()]||[t.qualidade])[0]):''}</option>`).join('')}</select>`:'<div class="vazio">Nenhuma mensagem modelo aprovada encontrada. Confira a BM em Configurações › BMs Meta e clique em “Atualizar modelos”.</div>'}
    ${T?`<small class="cpe-h" style="display:block;margin-top:8px">Qualidade desta mensagem na Meta: ${ofQ(T.qualidade||'UNKNOWN')}${T.motivo?' · '+esc(T.motivo):''}${T.metricas?`<br>Últimos 30 dias (Meta): <b>${T.metricas.enviadas}</b> enviadas · <b>${T.metricas.entregues}</b> entregues · <b>${T.metricas.lidas}</b> lidas · <b>${T.metricas.cliques}</b> cliques${T.metricas.enviadas?` (${Math.round(T.metricas.entregues/T.metricas.enviadas*100)}% entregues, ${Math.round(T.metricas.lidas/T.metricas.enviadas*100)}% lidas)`:''}<br>Hoje: ${T.metricas.hoje.enviadas} enviadas · ${T.metricas.hoje.entregues} entregues · ${T.metricas.hoje.lidas} lidas`:''}</small><div class="of-prev" id="ofPrev" style="margin-top:10px">${esc(prev)}${(T.botoes||[]).length?'\n\n'+T.botoes.map(b=>'🔘 '+esc(b.texto)).join('   '):''}</div>
      ${E.corpo.map((v,i)=>`<div class="of-var"><b>{{${i+1}}}</b><select onchange="ofEd.corpo[${i}].tipo=this.value;ofMudou(true)"><option value="nome" ${v.tipo==='nome'?'selected':''}>Primeiro nome do cliente</option><option value="texto" ${v.tipo!=='nome'?'selected':''}>Texto fixo</option></select>${v.tipo==='nome'?`<input placeholder="Se não tiver nome, usar…" value="${esc(v.padrao)}" oninput="ofEd.corpo[${i}].padrao=this.value;ofMudou()">`:`<input placeholder="Texto" value="${esc(v.texto)}" oninput="ofEd.corpo[${i}].texto=this.value;ofMudou();ofPrevMsg()">`}</div>`).join('')}
      ${T.cabecalho==='IMAGE'?`<div class="of-var"><b>Imagem</b><input style="flex:1" placeholder="https://… (link da imagem)" value="${esc(E.cabecalho_imagem)}" oninput="ofEd.cabecalho_imagem=this.value;ofMudou()"></div>`:''}
      ${ofBotaoVar(T)?`<div class="of-var"><b>Botão</b><span class="cpe-h">${esc(ofBotaoVar(T).url.replace(/\{\{\s*1\s*\}\}.*/,''))}</span><select onchange="ofEd.botao_telefone=this.value==='tel';ofMudou(true)"><option value="tel" ${E.botao_telefone?'selected':''}>Telefone do cliente (saber quem clicou)</option><option value="fixo" ${E.botao_telefone?'':'selected'}>Texto fixo</option></select>${E.botao_telefone?'':`<input style="flex:1;min-width:140px" placeholder="final do link" value="${esc(E.botao_sufixo)}" oninput="ofEd.botao_sufixo=this.value;ofMudou()">`}</div><small class="cpe-h">${E.botao_telefone?'Cada cliente recebe o link com o próprio telefone no final (ele só vê o botão). Quem clicar aparece em “Clicaram”.':'O mesmo final vai para todos (a Meta exige completar o {{1}}).'}</small>`:''}`:''}
    <div class="dp-ritmo" style="margin-top:10px">Envia a lista toda de uma vez, das <input type="number" min="0" max="23" value="${E.hora_inicio}" oninput="ofEd.hora_inicio=this.value;ofMudou()" aria-label="Hora de início">h às <input type="number" min="1" max="24" value="${E.hora_fim}" oninput="ofEd.hora_fim=this.value;ofMudou()" aria-label="Hora de fim">h.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center"><button class="bt pri" onclick="ofSalvar()">Salvar</button><input id="ofTelTeste" class="of-in" inputmode="tel" placeholder="Seu número (vazio = número do dono)" style="min-width:220px"><button class="bt" onclick="ofTeste()">Enviar teste</button></div></div>
  <div class="fbox"><h4>Lista de contatos</h4><small class="cpe-h">Cole uma linha por contato (nome e telefone) ou abra um arquivo .csv / .txt. Telefones repetidos na mesma lista entram uma vez só.</small>
    <textarea id="ofTexto" rows="5" class="cp-txt" placeholder="Maria da Silva	48999998888" oninput="ofPrevImp()"></textarea>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px"><input type="file" accept=".csv,.txt" onchange="ofArquivo(this)"><button class="bt pri" id="ofImpBt" disabled onclick="ofImportar()">Importar</button><span class="cpe-h" id="ofImpPrev"></span>${+R.na_fila?`<button class="bt" style="margin-left:auto" onclick="if(confirm('Tirar da fila os ${+R.na_fila} que ainda não receberam?'))ofCarregar('limpar_fila')">Limpar fila</button>`:''}</div></div>
  <div class="fbox"><h4>Contatos <small class="cpe-h">(últimos 300)</small></h4>${C.length?`<div style="overflow:auto"><table class="of-tab"><thead><tr><th>Telefone</th><th>Nome</th><th>Situação</th><th>Enviada</th><th>Clicou</th><th>Chamou o 6775</th><th>Resposta no oficial</th></tr></thead><tbody>${C.map(c=>{const s=OF_CT[c.lido_em?'read':c.entregue_em?'delivered':c.status]||[c.status,'#eef1f5','#5b6878'];const h=t=>t?new Date(t).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';return `<tr><td>${fmtTel(c.telefone)}</td><td>${esc(c.nome||'—')}</td><td><span class="cp-st" style="background:${s[1]};color:${s[2]}">${s[0]}</span>${c.erro?`<br><small style="color:#b42318">${esc(c.erro)}</small>`:''}</td><td>${h(c.enviado_em)}</td><td>${c.clicou_em?'✅ '+h(c.clicou_em):'—'}</td><td>${c.lead_id?'✅':'—'}</td><td>${c.resposta?esc(c.resposta):'—'}</td></tr>`;}).join('')}</tbody></table></div>`:'<div class="vazio">Nenhum contato ainda.</div>'}</div>`;
  ofPintarKpi(d);ofPrevImp();}
function ofEscolherBm(v){ofEd.bm_id=v?+v:null;ofEd.template='';ofEd.idioma='';ofEd.corpo=[];ofEd.cabecalho_imagem='';ofMudou(true);}
function ofBotaoVar(T){return ((T&&T.botoes)||[]).find(b=>b.tipo==='URL'&&/\{\{\s*1\s*\}\}/.test(b.url||''))||null;}
function ofPrevMsg(){const el=document.getElementById('ofPrev'),E=ofEd;if(!el||!E)return;const T=ofTpls().find(t=>t.nome===E.template&&t.idioma===E.idioma);if(!T)return;let p=String(T.corpo||'');E.corpo.forEach((v,i)=>{p=p.split('{{'+(i+1)+'}}').join(v.tipo==='nome'?'[primeiro nome]':(v.texto||'[texto]'));});el.textContent=p+((T.botoes||[]).length?'\n\n'+T.botoes.map(b=>'🔘 '+b.texto).join('   '):'');}
function ofPrevImp(){const t=document.getElementById('ofTexto');if(!t)return;ofLinhas=cpLer(t.value);const b=document.getElementById('ofImpBt'),p=document.getElementById('ofImpPrev');if(b)b.disabled=!ofLinhas.length;if(p)p.textContent=ofLinhas.length?ofLinhas.length+' contato(s) prontos para importar':'';}
function ofArquivo(inp){const f=inp.files&&inp.files[0];if(!f)return;const fr=new FileReader();fr.onload=()=>{document.getElementById('ofTexto').value=String(fr.result);ofPrevImp();};fr.readAsText(f);}
async function ofSalvarNome(inp){const nome=(inp.value||'').trim();
  if(!nome){inp.value=ofEd.nome=(ofAtual()||{}).nome||'';ofMsg='O nome não pode ficar vazio.';const s0=document.getElementById('ofSt');if(s0)s0.textContent=ofMsg;return;}
  const keep=ofEd;ofEd.nome=nome;const r=await ofCarregar('salvar',{nome});ofEd=keep;
  ofMsg=r&&!r.erro?'✅ Nome salvo':'⚠️ Não consegui salvar o nome';const st=document.getElementById('ofSt');if(st)st.textContent=ofMsg;}
async function ofSalvar(){const E=ofEd;if(!E)return false;{const T=ofTpls().find(t=>t.nome===E.template&&t.idioma===E.idioma);if(ofBotaoVar(T)&&!E.botao_telefone&&!(E.botao_sufixo||'').trim()){ofMsg='⚠️ Preencha o final do link do botão: a Meta exige.';document.getElementById('ofSt').textContent=ofMsg;return false;}}if(+E.hora_fim<=+E.hora_inicio){ofMsg='⚠️ O horário de fim precisa ser depois do início.';document.getElementById('ofSt').textContent=ofMsg;return false;}
  E.sujo=false;const r=await ofCarregar('salvar',{nome:E.nome.trim(),bm_id:E.bm_id||'',template:E.template,idioma:E.idioma,corpo:JSON.stringify(E.corpo),cabecalho_imagem:E.cabecalho_imagem.trim(),botao_telefone:String(!!E.botao_telefone),botao_sufixo:(E.botao_sufixo||'').trim(),hora_inicio:E.hora_inicio,hora_fim:E.hora_fim});
  if(r&&!r.erro){ofEd=null;ofRender();}return !!(r&&!r.erro);}
async function ofTeste(){if(ofEd&&ofEd.sujo){if(!await ofSalvar())return;}const tel=(document.getElementById('ofTelTeste')||{}).value||'';ofMsg='Enviando teste…';const st=document.getElementById('ofSt');if(st)st.textContent=ofMsg;await ofCarregar('teste',{telefone:tel});}
async function ofImportar(){if(!ofLinhas.length)return;if(ofEd&&ofEd.sujo){if(!await ofSalvar())return;}const b=document.getElementById('ofImpBt');if(b){b.disabled=true;b.textContent='Importando…';}
  await ofCarregar('importar',{linhas:JSON.stringify(ofLinhas.map(l=>({nome:l.nome||'',telefone:l.telefone||''})))});ofLinhas=[];}
async function ofComecar(){if(ofEd&&ofEd.sujo){if(!await ofSalvar())return;}const d=ofAtual();if(!d)return;const R=d.resumo||{};
  if(!confirm(`Começar o disparo “${d.nome}” pela API oficial?\n\n${R.na_fila||0} contatos na fila · tudo de uma vez (das ${d.hora_inicio}h às ${d.hora_fim}h).\nA Meta cobra cada mensagem enviada.`))return;ofCarregar('ativar');}

/* ===== Pipeline (kanban por etapa) ===== */
let pipeFim=false;
const PIPE_COLS=[['recepcao','Recepção'],['simulacao','Simulação'],['vendas','Vendas'],['formalizacao','Formalização'],['posvenda','Pós-venda']];
function pipeCol(c){if(c.grupo==='pago')return 'posvenda';return PIPE_COLS.some(x=>x[0]===c.setor_id)?c.setor_id:(c.setor_id==='gerente'?'recepcao':null);}
function renderPipeline(){const el=document.getElementById('pipeSec');if(!el)return;
  const T=(estado.crm||[]).filter(c=>c.setor_id!=='prospeccao'),cor=id=>(setorById(id)||(DEMO_SETORES||[]).find(x=>x.id===id)||{}).cor||'#888';
  const acabou=c=>c.grupo==='perdido'||c.grupo==='sem_margem',L=T.filter(c=>pipeFim||!acabou(c)),por={};
  L.forEach(c=>{const k=pipeCol(c);if(k)(por[k]=por[k]||[]).push(c);});
  const nFim=T.filter(acabou).length;
  const card=(c,k)=>{const v=c.oferta&&c.oferta.valor?brlFull(c.oferta.valor):(c.margem?'margem '+brlFull(c.margem):'');
    return `<button class="pipe-card ${acabou(c)?'fim':''}" style="--pc:${cor(k)}" onclick="abrirPainel('cliente:${c.id}')"><b>${esc(c.nome||'Sem nome')}</b><small>${esc(fmtTel(c.telefone)||'')}</small><small>${esc(c.situacao||'')}${v?' · '+v:''}</small><small>${c.ultima?'há '+tempo(minDesde(c.ultima)):''}</small></button>`;};
  el.innerHTML=`<div class="pipe-top"><b>${L.filter(c=>pipeCol(c)).length} cliente(s) no pipeline</b><label><input type="checkbox" ${pipeFim?'checked':''} onchange="pipeFim=this.checked;renderPipeline()"> Mostrar também quem já saiu (sem margem ou perdido · ${nFim})</label><small class="cpe-h" style="margin-left:auto">A Prospecção não entra: o cliente aparece aqui quando responde.</small></div>
    <div class="pipe-cols">${PIPE_COLS.map(([k,n])=>{const A=(por[k]||[]).slice().sort((a,b)=>new Date(b.ultima||0)-new Date(a.ultima||0));
      return `<div class="pipe-col" style="--pc:${cor(k)}"><div class="pipe-ch"><b>${n}</b><span>${A.length}</span></div>${A.length?A.slice(0,60).map(c=>card(c,k)).join('')+(A.length>60?`<div class="pipe-vazio">+ ${A.length-60} clientes (veja em Clientes)</div>`:''):'<div class="pipe-vazio">Ninguém nesta etapa agora.</div>'}</div>`;}).join('')}</div>`;}
/* ===== BMs da Meta (Configurações) ===== */
let bmD=null,bmEd=null,bmMsg='';
async function bmCarregar(acao,extra){acao=acao||'ver';extra=extra||{};
  if(demo){document.getElementById('bmLista').innerHTML='<div class="vazio">Disponível só com o sistema ligado.</div>';return null;}
  if(!chave){pedirChave();return null;}
  const bt=document.getElementById('bmMsg');if(bt&&acao!=='ver')bt.textContent=acao==='templates'||acao==='bm_salvar'?'Falando com a Meta…':'Salvando…';
  try{const r=await fetch(BASE+'/escritorio/oficial',{method:'POST',body:new URLSearchParams({k:chave,acao,...extra})});
    if(r.status===401){pedirChave('Chave inválida ou desativada.');return null;}if(!r.ok)throw new Error('HTTP '+r.status);bmD=await r.json();}
  catch(e){bmMsg='⚠️ Não consegui falar com o servidor ('+e.message+').';bmRender();return null;}
  if(ofD&&bmD.conexao)ofD.conexao=bmD.conexao;
  if((acao==='bm_salvar'&&(bmD.aviso||!bmD.erro))||(acao==='bm_remover'&&!bmD.erro))bmEd=null;
  bmMsg=bmD.erro?'⚠️ '+bmD.erro:(bmD.aviso?'✓ '+bmD.aviso:'');
  bmRender();return bmD;}
function bmNova(){bmEd={id:null};bmRender();}
function bmEditar(id){bmEd={id};bmRender();}
function bmSalvar(){const v=id=>document.getElementById(id).value.trim();
  if(!bmEd.id&&(!v('bmPh')||!v('bmWa')||!v('bmTk'))){bmMsg='⚠️ Preencha o Phone Number ID, o ID do WABA e o token da nova BM.';bmRender();return;}
  bmCarregar('bm_salvar',{bm_id:bmEd.id||'',nome:v('bmNome'),phone_id:v('bmPh'),waba_id:v('bmWa'),token:v('bmTk')});}
function bmRemover(id,nome){if(confirm('Remover a BM “'+nome+'”? Os disparos que usam ela ficam sem BM até você escolher outra.'))bmCarregar('bm_remover',{bm_id:id});}
function bmRender(){const el=document.getElementById('bmLista');if(!el)return;document.getElementById('bmMsg').textContent=bmMsg;
  const C=(bmD&&bmD.conexao)||{},L=C.bms||[];
  const dh=t=>t?new Date(t).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
  el.innerHTML=!bmD?'<div class="vazio">Carregando…</div>':L.length?L.map(b=>{const n=b.numero||{},nT=(b.templates||[]).filter(t=>t.status==='APPROVED').length,ban=n.status==='BANNED';
    return `<div class="of-cx" style="margin-bottom:10px"><b>${esc(b.nome)} ${b.ativo?'':'<span class="cp-st" style="background:#eef1f5;color:#5b6878">Desativada</span>'}</b>
      <small>📱 ${esc(n.telefone||b.phone_id||'—')}${n.nome?' · '+esc(n.nome):''}<br>Phone ID ${esc(b.phone_id||'—')} · WABA ${esc(b.waba_id||'—')}<br>Qualidade do número: ${ofQ(n.qualidade)} · Limite: ${n.limite?ofLimite(n.limite):'—'}${n.nome_status&&!['APPROVED','AVAILABLE_WITHOUT_REVIEW'].includes(n.nome_status)?'<br>Nome de exibição: '+(({DECLINED:'<b style="color:#b42318">recusado pela Meta</b>',PENDING_REVIEW:'em análise',EXPIRED:'expirado'})[n.nome_status]||esc(n.nome_status)):''}<br>${b.tem_token?nT+' mensagem(ns) modelo aprovada(s)'+(b.templates_em?' · atualizado '+dh(b.templates_em):''):'⚠️ Sem token'}</small>
      ${b.templates_erro?`<small style="color:#b42318">⚠️ ${esc(b.templates_erro)}</small>`:''}
      ${ban?'<small style="color:#b42318"><b>🚫 Número bloqueado pela Meta</b>: nenhuma mensagem sai por esta BM.</small>':''}
      <span style="display:flex;gap:6px;flex-wrap:wrap"><button class="bt" onclick="bmCarregar('templates',{bm_id:${b.id}})">Atualizar modelos</button><button class="bt" onclick="bmEditar(${b.id})">Editar</button><button class="bt" onclick="bmCarregar('bm_salvar',{bm_id:${b.id},ativo:'${b.ativo?'false':'true'}'})">${b.ativo?'Desativar':'Ativar'}</button><button class="bt" onclick="bmRemover(${b.id},'${esc(b.nome).replace(/'/g,'')}')">Remover</button></span></div>`;}).join(''):'<div class="vazio">Nenhuma BM cadastrada. Clique em “+ Nova BM”.</div>';
  const box=document.getElementById('bmEdBox');
  if(bmEd){const b=bmEd.id?L.find(x=>+x.id===+bmEd.id)||{}:{};box.hidden=false;
    box.innerHTML=`<h4>${bmEd.id?'Editar BM':'Nova BM'}</h4><div class="of-cx" style="gap:8px">
      <label>Nome da BM<input id="bmNome" value="${esc(b.nome||'')}" placeholder="Ex.: BM Gustavo 01" maxlength="60"></label>
      <label>Phone Number ID<input id="bmPh" inputmode="numeric" value="${esc(b.phone_id||'')}" placeholder="Ex.: 123456789012345"></label>
      <label>ID da conta do WhatsApp Business (WABA)<input id="bmWa" inputmode="numeric" value="${esc(b.waba_id||'')}" placeholder="Ex.: 109876543210987"></label>
      <label>Token de acesso<input id="bmTk" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore style="-webkit-text-security:disc" placeholder="${b.tem_token?'•••• termina em '+esc(b.token_fim)+' (deixe vazio para manter)':'Cole o token permanente'}"></label>
      <span style="display:flex;gap:6px;flex-wrap:wrap"><button class="bt pri" onclick="bmSalvar()">Salvar e buscar mensagens</button><button class="bt" onclick="bmEd=null;bmRender()">Cancelar</button></span></div>`;}
  else{box.hidden=true;box.innerHTML='';}
  const wb=document.getElementById('bmWebhook'),ev=ofEvVis(C.eventos);
  wb.innerHTML=!bmD?'':`<h4>🔔 Entregue / lida e avisos da Meta</h4>${C.verify_token?`<small class="cpe-h" style="display:block;line-height:1.5">Para ver entregue / lida: no app da Meta, em WhatsApp → Configuração → Webhook, cole<br>URL: <code>${esc(C.webhook_url)}</code><br>Token de verificação: <code>${esc(C.verify_token)}</code><br>e assine o campo <b>messages</b>. A mesma URL serve para todas as BMs.</small>`:'<small class="cpe-h">Cadastre a primeira BM para gerar o token de verificação.</small>'}
    <details${ev.length?'':' hidden'} style="margin-top:8px"><summary style="cursor:pointer;font-weight:600">Avisos da Meta (${ev.length})</summary><div style="display:flex;flex-direction:column;gap:5px;margin-top:6px">${ev.map(e=>`<small>${ofEvTxt(e)}${e.n>1?' <span style="color:var(--tx3)">('+e.n+'x)</span>':''}<br><span style="color:var(--tx3)">${dh(e.em)}</span></small>`).join('')}</div></details>`;}

