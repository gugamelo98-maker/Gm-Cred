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
      :`<button class="bt pri" onclick="acao('assumir',${l.id})">🙋 Assumir atendimento</button><span style="font-size:12px;color:var(--tx3)">O agente para de responder este cliente</span>`}${l.status==='parou'?'':`<span style="display:inline-flex;gap:6px;align-items:center;margin-left:auto"><select id="fichaMotivo" style="border:1px solid #e3e8ef;border-radius:8px;padding:6px">${MOTIVOS_FIM.map(([v,t])=>`<option value="${esc(v)}">${t}</option>`).join('')}</select><button class="bt" onclick="fichaFinalizar(${l.id})">✔ Finalizar atendimento</button></span>`}</div>
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
const MOTIVOS_FIM=[['sem interesse','Sem interesse'],['já tem empréstimo','Já tem empréstimo'],['número errado: não é o cliente','Número errado'],['não contatar: pediu para não chamar','Não contatar'],['sem margem: informado pelo atendente','Sem margem'],['atendimento concluído','Atendimento concluído']];
async function fichaFinalizar(id){const m=document.getElementById('fichaMotivo').value;if(!confirm('Finalizar o atendimento deste cliente como "'+m+'"?'))return;
  const r=await cvApi('finalizar',{id,texto:m});if(!r||!r.ok){alert('Não consegui finalizar.');return;}fecharPainel&&fecharPainel();atualizar();}
async function acao(tipo,leadId,alertaId){
  if(demo){demoAcao(tipo,leadId,alertaId);return;}
  try{const r=await fetch(BASE+'/escritorio/acao',{method:'POST',body:new URLSearchParams({k:chave,tipo,lead_id:leadId||'',alerta_id:alertaId||''})});
    const j=await r.json().catch(()=>({}));
    if(r.status===401){pedirChave('Chave inválida ou desativada.');return;}
    if(!j.ok){alert('Não foi possível concluir a ação ('+(j.erro||('HTTP '+r.status))+').');return;}
    await atualizar();if(painelAberto&&painelAberto.startsWith('cliente:'))carregarFicha(Number(painelAberto.slice(8)));
  }catch(e){alert('Erro de conexão: '+e.message);}}

