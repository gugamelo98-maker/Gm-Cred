// ═════════════ SIDEBAR ═════════════
function buildSidebar(){
  const nav=document.getElementById('sidebar');nav.innerHTML='';
  estado.setores.forEach(s=>{
    const el=document.createElement('div');el.className='sb-item'+(dashAberto===s.id?' active':'');
    el.style.setProperty('--c',s.cor);el.style.background=s.cor+'10';
    el.innerHTML=`<div class="sb-dot"></div><div class="sb-cnt">${s.id==='gerente'?(estado.resumo.parados??0):s.leads_ativos}</div><div class="sb-lbl">${esc(s.nome.substring(0,6))}</div>${s.leads_parados>0?`<span class="sb-alert">${s.leads_parados}</span>`:''}`;
    el.onclick=()=>openDash(s.id);nav.appendChild(el);
    const sep=document.createElement('div');sep.className='sb-sep';nav.appendChild(sep);
  });
  const f=document.createElement('div');f.className='sb-item'+(dashAberto==='feed'?' active':'');f.style.setProperty('--c','#ffcc00');
  f.innerHTML='<div class="sb-cnt">📜</div><div class="sb-lbl">FEED</div>';f.onclick=openFeed;nav.appendChild(f);
  const n=document.createElement('div');n.className='sb-item'+(dashAberto==='numeros'?' active':'');n.style.setProperty('--c','#00ff88');
  n.innerHTML=`<div class="sb-cnt">📱${estado.numeros.length}</div><div class="sb-lbl">NÚMEROS</div>`;n.onclick=()=>{dashAberto='numeros';renderDash();abrir();};nav.appendChild(n);
}

