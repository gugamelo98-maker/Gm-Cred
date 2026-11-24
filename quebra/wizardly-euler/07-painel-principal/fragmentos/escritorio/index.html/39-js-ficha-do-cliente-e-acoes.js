// ═════════════ FICHA DO CLIENTE E AÇÕES ═════════════
async function carregarFicha(id){gTit.textContent='Carregando…';gSub.textContent='';gCorpo.innerHTML='<div class="vazio">Buscando conversa e histórico…</div>';
  try{let f;
    if(demo)f=demoFicha(id);
    else{const r=await fetch(BASE+'/escritorio/cliente?k='+encodeURIComponent(chave)+'&id='+encodeURIComponent(id),{cache:'no-store'});
      if(r.status===401){fecharPainel();pedirChave('Chave inválida ou desativada.');return;}
      if(!r.ok)throw new Error('HTTP '+r.status);f=await r.json();}
    if(painelAberto!=='cliente:'+id)return;renderFicha(f);
  }catch(e){gCorpo.innerHTML='<div class="vazio">Não foi possível carregar a ficha ('+esc(e.message)+').</div>';}}
function renderFicha(f){const l=f&&f.lead;if(!l){gTit.textContent='Cliente não encontrado';gCorpo.innerHTML='';return;}
  const s=setorById(l.setor_id),humano=l.aguardando==='humano',conv=f.conversa||[],evs=f.eventos||[],cts=f.contratos||[];
  gTit.textContent=l.nome||('Cliente #'+l.id);
  gSub.innerHTML=`${s?'<span style="color:'+s.cor+'">●</span> '+esc(s.nome)+' · ':''}${STATUS_LABEL[l.status]||esc(l.status||'')}${l.numero?' · 📱 '+esc(l.numero):''}`;
  gCorpo.innerHTML=`<div class="ficha-acoes">${humano
      ?`<button class="bt" onclick="acao('devolver',${l.id})">🤖 Devolver ao agente</button><span style="font-size:12.5px;color:var(--vermelho);font-weight:600">Agente pausado: você está atendendo</span>`
      :`<button class="bt pri" onclick="acao('assumir',${l.id})">🙋 Assumir atendimento</button><span style="font-size:12px;color:var(--tx3)">O agente para de responder este cliente</span>`}${l.status==='parou'?'':`<span style="display:inline-flex;gap:6px;align-items:center;margin-left:auto"><select id="fichaMotivo" onchange="motivoMudou('fichaMotivo','fichaMotivoOutro')" style="border:1px solid #e3e8ef;border-radius:8px;padding:6px">${motivoOpcoes()}</select><input id="fichaMotivoOutro" hidden maxlength="150" placeholder="Qual o motivo?" style="border:1px solid #e3e8ef;border-radius:8px;padding:6px"><button class="bt" onclick="fichaFinalizar(${l.id})">✔ Finalizar atendimento</button></span>`}</div>
    ${(()=>{const cpfL=String(l.cpf||l.cpf_base||'').replace(/\D/g,''),m=Number(l.margem)||0,tx=m>0?'Você tem disponível até '+brlFull(m).replace(',00','')+' de parcela. Qual valor de parcela cabe melhor no seu bolso?':'';
      return `<div class="ficha-acoes ficha-margem"><button class="bt" ${cpfL.length===11?'':'disabled title="Este cliente ainda não tem CPF"'} onclick="fichaSimular('${cpfL}')">🧮 Simular</button>
        <div class="fm-box"><label>Mandar margem ao cliente</label><textarea id="fichaMargemTx" rows="3" placeholder="${m>0?'':'Margem ainda não consultada: use Simular primeiro, ou escreva a mensagem'}">${esc(tx)}</textarea>
        <div class="fm-bt"><button class="bt pri" onclick="fichaMargemEnviar(${l.id})">Enviar</button><button class="bt" ${m>0?'':'disabled title="Sem margem registrada"'} onclick="fichaMargemIA(${l.id})">🤖 Pedir para a IA enviar</button><span id="fichaMargemSt" class="v8-msg"></span></div></div></div>`;})()}
    <div class="dados"><div><span>Telefone</span><b>${esc(l.telefone||'—')}</b></div><div><span>CPF</span><b>${esc(l.cpf||'—')}</b></div>
      <div><span>Produto</span><b>${esc((l.produto||'—').toUpperCase())}</b></div><div><span>Valor</span><b>${brlFull(l.valor)}</b></div>
      <div><span>Entrou em</span><b>${l.criado_em?new Date(l.criado_em).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—'}</b></div><div><span>No setor há</span><b>${tempo(minDesde(l.entrou_setor_em))}</b></div>
      ${l.motivo_parada?`<div style="grid-column:1/-1"><span>Motivo da perda</span><b>${esc(l.motivo_parada)}</b></div>`:''}</div>
    ${cts.length?`<div class="g-sec">Contratos</div>${cts.map(c=>itemContrato({...c,nome:l.nome})).join('')}`:''}
    <div class="g-sec">Conversa no WhatsApp · ${conv.length}</div>
    ${conv.length?`<div class="chat" id="chatBox">${conv.map(m=>{const st=m.setor_id&&setorById(m.setor_id);return `<div class="msg ${m.direcao==='entrada'?'in':'out'}">${esc(m.conteudo)}<time>${hora(m.criado_em)}${m.direcao!=='entrada'&&st?' · '+esc(st.nome):''}</time></div>`;}).join('')}</div>`:'<div class="vazio">Nenhuma mensagem registrada ainda.</div>'}
    <div class="g-sec">Linha do tempo</div>
    ${evs.length?`<div class="linha">${evs.map(e=>`<div><b style="color:var(--tx)">${new Date(e.criado_em).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</b> · ${esc(e.descricao)}</div>`).join('')}</div>`:'<div class="vazio">Sem eventos.</div>'}`;
  const cb=document.getElementById('chatBox');if(cb)cb.scrollTop=cb.scrollHeight;}
function fichaSimular(cpf){if(!cpf)return;if(typeof fecharPainel==='function')fecharPainel();irPara('v8');const i=v8$('v8Cpf');i.value=v8FmtCpf(cpf);i.dispatchEvent(new Event('input'));if(!demo)v8Consultar(null);}
async function fichaMargemEnviar(id){const t=document.getElementById('fichaMargemTx'),st=document.getElementById('fichaMargemSt');if(!t||!t.value.trim()){if(st)st.textContent='Escreva a mensagem.';return;}
  if(demo){if(st)st.textContent='Disponível só com o sistema ligado.';return;}
  if(st)st.textContent='Enviando…';const r=await cvApi('enviar',{id,texto:t.value.trim()});if(st)st.textContent=r&&r.ok?'✅ Mensagem enviada (a IA fica pausada até você devolver).':'⚠️ '+((r&&r.erro)||'Não consegui enviar.');}
async function fichaMargemIA(id){const st=document.getElementById('fichaMargemSt');
  if(demo){if(st)st.textContent='Disponível só com o sistema ligado.';return;}
  if(st)st.textContent='Pedindo à IA…';const r=await cvApi('ia_margem',{id});if(st)st.textContent=r&&r.ok?'✅ A IA vai mandar a mensagem em até 1 minuto.':'⚠️ '+((r&&r.erro)||'Não consegui pedir.');}
const MOTIVOS_FIM=[['pago (confirmar contrato)','Pago'],['venda fechada','Venda fechada'],['sem interesse','Sem interesse'],['sem margem: informado pelo atendente','Sem margem'],['número errado: não é o cliente','Número errado'],['não contatar: pediu para não chamar','Não contatar'],['mensagem automática','Mensagem automática'],['já tem empréstimo','Já tem crédito'],['atendimento concluído','Atendimento concluído'],['outro','Outro…']];
function motivoOpcoes(){return MOTIVOS_FIM.map(([v,t])=>`<option value="${esc(v)}">${t}</option>`).join('');}
function motivoValor(selId,outroId){const m=document.getElementById(selId).value;if(m!=='outro')return m;const t=((document.getElementById(outroId)||{}).value||'').trim();if(!t){alert('Escreva o motivo.');return null;}return 'outro: '+t;}
function motivoMudou(selId,outroId){const o=document.getElementById(outroId);if(o)o.hidden=document.getElementById(selId).value!=='outro';}
async function fichaFinalizar(id){const m=motivoValor('fichaMotivo','fichaMotivoOutro');if(m==null)return;if(!confirm('Finalizar o atendimento deste cliente como "'+m+'"?'))return;
  const r=await cvApi('finalizar',{id,texto:m});if(!r||!r.ok){alert('Não consegui finalizar.');return;}fecharPainel&&fecharPainel();atualizar();}
async function acao(tipo,leadId,alertaId){
  if(demo){demoAcao(tipo,leadId,alertaId);return;}
  try{const r=await fetch(BASE+'/escritorio/acao',{method:'POST',body:new URLSearchParams({k:chave,tipo,lead_id:leadId||'',alerta_id:alertaId||''})});
    const j=await r.json().catch(()=>({}));
    if(r.status===401){pedirChave('Chave inválida ou desativada.');return;}
    if(!j.ok){alert('Não foi possível concluir a ação ('+(j.erro||('HTTP '+r.status))+').');return;}
    await atualizar();if(painelAberto&&painelAberto.startsWith('cliente:'))carregarFicha(Number(painelAberto.slice(8)));
  }catch(e){alert('Erro de conexão: '+e.message);}}

