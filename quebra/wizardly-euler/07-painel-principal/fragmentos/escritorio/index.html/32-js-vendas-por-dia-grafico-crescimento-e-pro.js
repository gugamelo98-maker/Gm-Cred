// ═════════════ VENDAS POR DIA (gráfico, crescimento e projeção) ═════════════
let vdM=lsGet('escritorio_vd')||'liberado';
const VD={liberado:{nome:'Liberado',fmt:v=>brlFull(v),eixo:v=>v>=1000?'R$'+Math.round(v/1000)+'k':'R$'+Math.round(v)},pagos:{nome:'Contratos pagos',fmt:v=>(Math.round(v*10)/10).toString().replace('.',','),eixo:v=>String(Math.round(v*10)/10).replace('.',',')},comissao:{nome:'Comissão',fmt:v=>brlFull(v),eixo:v=>v>=1000?'R$'+(v/1000).toFixed(1).replace('.',',')+'k':'R$'+Math.round(v)}};
function vdMedida(m){vdM=m;lsSet('escritorio_vd',m);document.querySelectorAll('.seg button').forEach(b=>{b.classList.toggle('on',b.dataset.m===m);b.setAttribute('aria-selected',b.dataset.m===m);});renderVendas();}
function dataISO(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function diaDe(s){const [y,m,d]=String(s).slice(0,10).split('-').map(Number);return new Date(y,m-1,d);}
function fmtDia(s){const d=diaDe(s);return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0');}
const DSEM=['dom','seg','ter','qua','qui','sex','sáb'];
function variacao(a,b){if(!b&&!a)return'<span class="flat">— sem dados</span>';if(!b)return'<span class="up">▲ novo</span>';const v=(a-b)/b*100;const c=Math.abs(v)<.5?'flat':v>0?'up':'down';return`<span class="${c}">${v>0?'▲':v<0?'▼':'•'} ${Math.abs(v).toFixed(0)}%</span>`;}
function serieVendas(){
  const V=(estado.vendas||[]).map(x=>({...x,clientes:+x.clientes||0,digitados:+x.digitados||0,pagos:+x.pagos||0,liberado:+x.liberado||0,comissao:+x.comissao||0}));
  if(!V.length)return null;
  const hoje=V[V.length-1].dia.slice(0,10),dHoje=diaDe(hoje);
  const ult=V.slice(-30),prev7=V.slice(-8,-1);   // 7 dias completos antes de hoje
  const media={};['liberado','pagos','comissao','clientes'].forEach(k=>media[k]=prev7.reduce((a,x)=>a+x[k],0)/Math.max(1,prev7.length));
  const fimMes=new Date(dHoje.getFullYear(),dHoje.getMonth()+1,0),futuros=[];
  for(let d=new Date(dHoje.getFullYear(),dHoje.getMonth(),dHoje.getDate()+1);d<=fimMes;d.setDate(d.getDate()+1))futuros.push({dia:dataISO(d),proj:true,liberado:media.liberado,pagos:media.pagos,comissao:media.comissao});
  return{V,ult,futuros,hoje,dHoje,media};
}
function renderVendas(){
  const box=document.getElementById('vdChart');if(!box)return;
  if(typeof telaAtual!=='undefined'&&telaAtual!=='mes'){return;}
  const S=serieVendas(),m=vdM,info=VD[m],meta=Number((estado.meta&&estado.meta.meta_valor)||7000);
  document.querySelectorAll('.seg button').forEach(b=>b.classList.toggle('on',b.dataset.m===m));
  document.getElementById('vdLeg').innerHTML=`<span><i style="background:#2a78d6"></i>${info.nome} por dia</span>${m==='liberado'?'<span><i style="height:0;border-top:2px dashed #52514e;border-radius:0"></i>Meta diária</span>':''}`;
  if(!S){box.innerHTML='<div class="vazio">Sem dados de vendas.</div>';return;}
  const pts=S.ult,n=pts.length;
  // média móvel de 7 dias sobre a série real
  const mm=S.ult.map((x,i)=>{const j=S.V.length-S.ult.length+i,w=S.V.slice(Math.max(0,j-6),j+1);return w.reduce((a,y)=>a+y[m],0)/w.length;});
  const W=Math.max(320,box.clientWidth||900),H=Math.round(Math.min(320,Math.max(220,W*.32))),pl=52,pr=12,pt=14,pb=30,iw=W-pl-pr,ih=H-pt-pb;
  let max=Math.max(...pts.map(x=>x[m]),...mm,m==='liberado'?meta:0);if(!(max>0))max=m==='liberado'?meta:(m==='pagos'?3:300);max*=1.12;
  const y=v=>pt+ih-(v/max)*ih,bw=iw/n,gap=Math.max(1,Math.min(4,bw*.25)),barW=Math.max(1.5,bw-gap);
  const ticks=4,grid=[...Array(ticks+1)].map((_,i)=>max/ticks*i);
  let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${info.nome} por dia nos últimos 30 dias"><defs><pattern id="hach" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(135)"><rect width="5" height="5" fill="#e8f0fb"/><rect width="2" height="5" fill="#2a78d6"/></pattern></defs>`;
  grid.forEach(g=>{svg+=`<line x1="${pl}" x2="${W-pr}" y1="${y(g)}" y2="${y(g)}" stroke="#e8edf3" stroke-width="1"/><text x="${pl-8}" y="${y(g)+4}" text-anchor="end" font-size="10.5" fill="#8a96a5">${info.eixo(g)}</text>`;});
  pts.forEach((x,i)=>{const v=x[m],h=Math.max(0,ih-(y(v)-pt)),bx=pl+i*bw+gap/2,r=Math.min(4,barW/2,h);
    if(v>0){const top=y(v);svg+=x.proj
      ?`<path d="M${bx},${pt+ih} V${top+r} q0,-${r} ${r},-${r} H${bx+barW-r} q${r},0 ${r},${r} V${pt+ih} Z" fill="url(#hach)" stroke="#2a78d6" stroke-width="1"/>`
      :`<path d="M${bx},${pt+ih} V${top+r} q0,-${r} ${r},-${r} H${bx+barW-r} q${r},0 ${r},${r} V${pt+ih} Z" fill="#2a78d6"/>`;}
    const passo=Math.max(1,Math.ceil(n*46/iw)),iH=S.ult.length-1;
    if(i===iH)svg+=`<text x="${bx+barW/2}" y="${H-4}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#1d2733">hoje</text>`;
    else if((i-iH)%passo===0)svg+=`<text x="${bx+barW/2}" y="${H-4}" text-anchor="middle" font-size="10.5" fill="#8a96a5">${fmtDia(x.dia)}</text>`;});
  svg+=`<line x1="${pl}" x2="${W-pr}" y1="${pt+ih}" y2="${pt+ih}" stroke="#cfd8e3"/>`;
  if(m==='liberado')svg+=`<line x1="${pl}" x2="${W-pr}" y1="${y(meta)}" y2="${y(meta)}" stroke="#52514e" stroke-width="1.5" stroke-dasharray="6 5"/><text x="${W-pr}" y="${y(meta)-6}" text-anchor="end" font-size="11" font-weight="700" fill="#52514e" stroke="#ffffff" stroke-width="4" paint-order="stroke" stroke-linejoin="round">Meta ${brl(meta)}/dia</text>`;
  const lp=mm.map((v,i)=>`${i?'L':'M'}${(pl+i*bw+bw/2).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const iHoje=S.ult.length-1;svg+=`<line id="vdCross" x1="0" x2="0" y1="${pt}" y2="${pt+ih}" stroke="#8a96a5" stroke-width="1" visibility="hidden"/>`;
  svg+=`<rect x="${pl}" y="${pt}" width="${iw}" height="${ih}" fill="transparent" id="vdHit"/></svg><div class="vd-tip" id="vdTip"></div>`;
  const vazio=S.ult.every(x=>!x[m]);
  box.innerHTML=svg+(vazio?'<div class="vd-vazio">Ainda não há vendas registradas: o gráfico enche conforme os contratos forem pagos.</div>':'');
  const hit=document.getElementById('vdHit'),tip=document.getElementById('vdTip'),cr=document.getElementById('vdCross');
  const mover=ev=>{const rc=box.querySelector('svg').getBoundingClientRect(),sx=(ev.touches?ev.touches[0].clientX:ev.clientX)-rc.left,esc=W/rc.width,xv=sx*esc,i=Math.max(0,Math.min(n-1,Math.floor((xv-pl)/bw)));const x=pts[i],cx=pl+i*bw+bw/2;
    cr.setAttribute('x1',cx);cr.setAttribute('x2',cx);cr.setAttribute('visibility','visible');
    const d=diaDe(x.dia);tip.innerHTML=x.proj?`<b>${DSEM[d.getDay()]} ${fmtDia(x.dia)} · projeção</b><div><span>${info.nome}</span><span>${info.fmt(x[m])}</span></div><div><span>Base</span><span>média dos últimos 7 dias</span></div>`
      :`<b>${DSEM[d.getDay()]} ${fmtDia(x.dia)}${x.dia.slice(0,10)===S.hoje?' · hoje':''}</b><div><span>Liberado</span><span>${brlFull(x.liberado)}</span></div><div><span>Contratos pagos</span><span>${x.pagos}</span></div><div><span>Comissão</span><span>${brlFull(x.comissao)}</span></div><div><span>Clientes que entraram</span><span>${x.clientes}</span></div><div><span>Propostas digitadas</span><span>${x.digitados}</span></div>`;
    tip.style.display='block';const tw=tip.offsetWidth;let left=cx/esc+12;if(left+tw>rc.width)left=cx/esc-tw-12;tip.style.left=Math.max(0,left)+'px';tip.style.top='8px';};
  hit.addEventListener('mousemove',mover);hit.addEventListener('touchstart',mover,{passive:true});hit.addEventListener('touchmove',mover,{passive:true});
  hit.addEventListener('mouseleave',()=>{tip.style.display='none';cr.setAttribute('visibility','hidden');});
  document.getElementById('vdTabela').innerHTML=`<table><thead><tr><th>Dia</th><th>Clientes</th><th>Digitados</th><th>Pagos</th><th>Liberado</th><th>Comissão</th></tr></thead><tbody>${S.ult.slice().reverse().map(x=>`<tr><td>${DSEM[diaDe(x.dia).getDay()]} ${fmtDia(x.dia)}</td><td>${x.clientes}</td><td>${x.digitados}</td><td>${x.pagos}${x.pagos_fgts!=null?`<small style="display:block;color:var(--tx3)">CLT ${+x.pagos_clt||0} · FGTS ${+x.pagos_fgts||0}</small>`:''}</td><td>${brlFull(x.liberado)}${x.liberado_fgts!=null?`<small style="display:block;color:var(--tx3)">CLT ${brlFull(+x.liberado_clt||0)} · FGTS ${brlFull(+x.liberado_fgts||0)}</small>`:''}</td><td>${brlFull(x.comissao)}${x.comissao_fgts!=null?`<small style="display:block;color:var(--tx3)">CLT ${brlFull(+x.comissao_clt||0)} · FGTS ${brlFull(+x.comissao_fgts||0)}</small>`:''}</td></tr>`).join('')}</tbody></table>`;
  renderCrescimento(S);
}
function metaDia(){return Number((estado.meta&&estado.meta.meta_valor)||(estado.simulacao&&estado.simulacao.meta_dia)||7000);}
// projeção do mês: UMA conta só, usada em Resultados e em Simulação (realizado + média dos últimos 7 dias nos dias que faltam)
function projecaoMes(){const S=serieVendas();const hj=new Date();
  const d=S?S.dHoje:hj,diasMes=new Date(d.getFullYear(),d.getMonth()+1,0).getDate(),metaMes=metaDia()*diasMes;
  if(!S)return{realLib:0,realCom:0,realPag:0,projLib:0,projCom:0,metaMes,diasMes,diaN:d.getDate(),vazio:true};
  const soma=(a,k)=>a.reduce((s,x)=>s+(x[k]||0),0),mes=S.V.filter(x=>{const t=diaDe(x.dia);return t.getMonth()===d.getMonth()&&t.getFullYear()===d.getFullYear();});
  const realLib=soma(mes,'liberado');
  return{realLib,realCom:soma(mes,'comissao'),realPag:soma(mes,'pagos'),projLib:realLib+soma(S.futuros,'liberado'),projCom:soma(mes,'comissao')+soma(S.futuros,'comissao'),metaMes,diasMes,diaN:d.getDate(),vazio:!realLib&&!soma(S.futuros,'liberado')};}
function renderCrescimento(S){
  const V=S.V,soma=(arr,k)=>arr.reduce((a,x)=>a+x[k],0),sem=V.slice(-7),semAnt=V.slice(-14,-7);
  const el=document.getElementById('vdResumo');
  if(!soma(sem,'clientes')&&!soma(sem,'pagos')){el.innerHTML='Últimos 7 dias: ainda sem movimento.';return;}
  el.innerHTML=`<b>Últimos 7 dias:</b> ${soma(sem,'clientes')} clientes · ${soma(sem,'pagos')} contratos pagos · <b>${brl(soma(sem,'liberado'))}</b> liberados · ${brl(soma(sem,'comissao'))} de comissão${soma(semAnt,'liberado')?` <span style="white-space:nowrap">(liberado ${variacao(soma(sem,'liberado'),soma(semAnt,'liberado'))} vs semana anterior)</span>`:''}`;
}

