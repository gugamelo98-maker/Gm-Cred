// ═════════════ CANVAS ═════════════
const cv=document.getElementById('c');const ctx=cv.getContext('2d');
let W,H,S=2;
const TW=32,TH=16,WALL_H=44,WALL_HOME=20,ROOM=5,GAP=2;
function resize(){const dpr=1;W=cv.width=Math.floor((window.innerWidth-56)*dpr);H=cv.height=Math.floor((window.innerHeight-48-26)*dpr);cv.style.height=(window.innerHeight-48-26)+'px';}
resize();window.addEventListener('resize',()=>{resize();layoutMudou=true;});
let layoutMudou=true;

function iso(c,r,ox,oy){return{x:ox+(c-r)*TW/2,y:oy+(c+r)*TH/2};}
function poly(pts,col){ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(pts[0][0]*S,pts[0][1]*S);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0]*S,pts[i][1]*S);ctx.closePath();ctx.fill();}
function shade(hex,a){const n=parseInt(hex.replace('#',''),16);return'#'+[n>>16,n>>8&255,n&255].map(c=>Math.min(255,Math.max(0,c+a)).toString(16).padStart(2,'0')).join('');}
function drawTile(x,y,col){poly([[x,y],[x+TW/2,y+TH/2],[x,y+TH],[x-TW/2,y+TH/2]],col);ctx.strokeStyle='rgba(0,0,0,.2)';ctx.lineWidth=S*.4;ctx.beginPath();ctx.moveTo(x*S,(y+TH)*S);ctx.lineTo((x+TW/2)*S,(y+TH/2)*S);ctx.stroke();}
function drawWall(x,y,fc,sc,wh){wh=wh||WALL_H;poly([[x,y-wh],[x+TW/2,y+TH/2-wh],[x+TW/2,y+TH/2],[x,y]],fc);poly([[x,y-wh],[x,y],[x-TW/2,y+TH/2],[x-TW/2,y+TH/2-wh]],sc);poly([[x-TW/2,y+TH/2-wh],[x,y-wh],[x+TW/2,y+TH/2-wh],[x,y+TH-wh]],'#e0d0b0');}
function drawDesk(x,y,cor,on){
  poly([[x,y-10],[x+13,y-6],[x,y-2],[x-13,y-6]],'#c8a870');poly([[x-13,y-6],[x-13,y-2],[x,y+2],[x,y-2]],'#a08050');poly([[x+13,y-6],[x+13,y-2],[x,y+2],[x,y-2]],'#886840');
  ctx.fillStyle='#0a0a14';ctx.fillRect((x+1)*S,(y-22)*S,10*S,9*S);ctx.fillStyle=on?'#002a10':'#001200';ctx.fillRect((x+2)*S,(y-21)*S,8*S,7*S);
  if(on){ctx.fillStyle=cor;for(let i=0;i<3;i++)ctx.fillRect((x+3)*S,(y-20+i*2)*S,(3+((tick+i*7)%5))*S,Math.max(1,S*.8));}
}
function drawPlant(x,y){ctx.fillStyle='#7a3810';ctx.fillRect((x-3)*S,(y-5)*S,6*S,5*S);ctx.fillStyle='#1a5c1a';ctx.beginPath();ctx.arc(x*S,(y-11)*S,6*S,0,Math.PI*2);ctx.fill();ctx.fillStyle='#3aaa3a';ctx.beginPath();ctx.arc((x+3)*S,(y-12)*S,5*S,0,Math.PI*2);ctx.fill();ctx.fillStyle='#44cc44';ctx.beginPath();ctx.arc(x*S,(y-15)*S,3*S,0,Math.PI*2);ctx.fill();}
function label(txt,x,y,cor,fs,bg){ctx.font=`bold ${fs}px Arial,sans-serif`;ctx.textAlign='center';const w=ctx.measureText(txt).width;ctx.fillStyle=bg||'rgba(0,0,0,.88)';ctx.fillRect(x-w/2-5,y-fs,w+10,fs+6);if(cor){ctx.strokeStyle=cor;ctx.lineWidth=Math.max(1.5,S*.8);ctx.strokeRect(x-w/2-5,y-fs,w+10,fs+6);}ctx.fillStyle=cor||'#fff';ctx.fillText(txt,x,y);return w;}

// boneco: tipo 'agente' (com setor) ou 'cliente'
function drawPessoa(p,opts){
  const ax=Math.round(p.x),ay=Math.round(p.y),sc=opts.escala||1;
  const bob=p.walking?Math.sin(p.t*.25)*1.5:Math.sin(p.t*.05)*.6;const jmp=p.celebT>0?-Math.abs(Math.sin(p.celebT/5))*7:0;const by=ay+bob+jmp;
  const roupa=opts.roupa,escura=shade(roupa,-50),pele=opts.pele||'#ffcc99',cab=opts.cabelo||'#3b2219';
  const R=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect((ax+x*sc)*S,(by+y*sc)*S,w*sc*S,h*sc*S);};
  ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(ax*S,(ay+1)*S,5*sc*S,2*sc*S,0,0,Math.PI*2);ctx.fill();
  const ls=p.walking?Math.sin(p.t*.25)*2:0;
  R(-2,-2,2,4,'#334');R(1,-2+ls/sc,2,4,'#334');R(-3,-8,7,6,roupa);R(-2,-7,5,2,escura);
  const ar=p.walking?Math.sin(p.t*.25)*2:0;R(-5,-8+ar/sc,2,4,roupa);R(4,-8-ar/sc,2,4,roupa);
  R(-1,-9,3,2,pele);R(-3,-16,7,7,pele);R(-3,-16,7,2,cab);R(-4,-16,1,3,cab);R(-2,-13,1,1,'#180800');R(2,-13,1,1,'#180800');
  if(opts.nome){label(opts.nome,ax*S,(by-19*sc)*S,opts.corNome||roupa,Math.max(9,S*4.5));}
  if(opts.statusCor){ctx.fillStyle=opts.statusCor;ctx.beginPath();ctx.arc((ax+6*sc)*S,(by-15*sc)*S,Math.max(2.5,S*1.6),0,Math.PI*2);ctx.fill();}
  if(opts.alerta){const fs=Math.max(9,S*5);ctx.font=`bold ${fs}px Arial`;ctx.textAlign='center';ctx.fillStyle='#ff2244';ctx.fillRect(ax*S-fs*.45,(by-18*sc)*S-fs*1.25-(Math.sin(tick*.15)*2),fs*.9,fs*1.1);ctx.fillStyle='#fff';ctx.fillText('!',ax*S,(by-18*sc)*S-fs*.35-(Math.sin(tick*.15)*2));}
}

// ── geometria ──
let geo={home:null,det:null};
// Paisagem: grade nos eixos isométricos (diagonal). Retrato: grade alinhada à tela (2 colunas).
function calcHome(){
  const n=Math.max(1,estado.setores.length),retrato=W<H*0.9;
  const G0={modo:retrato?'tela':'iso',cols:Math.min(retrato?(H/W>1.9?1:2):3,n)};
  let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
  for(let i=0;i<n;i++){const o=salaOff(i,G0);[[0,0],[ROOM,0],[0,ROOM],[ROOM,ROOM]].forEach(([dc,dr])=>{const p=iso(o.c+dc,o.r+dr,0,0);minX=Math.min(minX,p.x-TW/2);maxX=Math.max(maxX,p.x+TW/2);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);});}
  const top=WALL_HOME+34;
  const s=Math.max(.3,Math.min(W/(maxX-minX),H/(maxY-minY+top+10))*.95);
  const sw=W/s,sh=H/s;
  return{...G0,S:s,ox:sw/2-(minX+maxX)/2,oy:top+(sh-top-(maxY-minY))/2-minY};
}
function salaOff(idx,G){
  const k=ROOM+GAP,col=idx%G.cols,row=Math.floor(idx/G.cols);
  if(G.modo==='tela'){const kk=Math.ceil(k*0.75);return{c:(row+col)*kk,r:(row-col)*kk};}
  return{c:col*k,r:row*k};
}
// vagas para clientes dentro da sala (exclui mesa do agente em 1,1 e planta em 4,4)
const VAGAS=[];for(let r=0;r<ROOM;r++)for(let c=0;c<ROOM;c++){if(!((c===1&&r===1)||(c===ROOM-1&&r===ROOM-1)||(c===1&&r===2)))VAGAS.push({c,r});}
function posCliente(setorId,slot,G){
  const idx=estado.setores.findIndex(s=>s.id===setorId);if(idx<0)return null;
  const o=salaOff(idx,G);const v=VAGAS[slot%VAGAS.length];
  const p=iso(o.c+v.c,o.r+v.r,G.ox,G.oy);return{x:p.x+((slot*7)%5-2),y:p.y+TH*.5};
}
function posAgente(setorId,G){const idx=estado.setores.findIndex(s=>s.id===setorId);const o=salaOff(idx,G);const p=iso(o.c+1,o.r+2,G.ox,G.oy);return{x:p.x,y:p.y+TH*.5};}

// ── sprites dos clientes (persistem entre atualizações para animar a caminhada) ──
const leadSprites=new Map();
function sincronizarSprites(){
  const G=calcHome();geo.home=G;
  const vivos=new Set();const ocup={};
  estado.leads.forEach(l=>{
    vivos.add(l.id);ocup[l.setor_id]=(ocup[l.setor_id]||0)+1;
    const slot=(hash(l.id)+ocup[l.setor_id])%VAGAS.length;
    const alvo=posCliente(l.setor_id,slot,G);if(!alvo)return;
    let sp=leadSprites.get(l.id);
    if(!sp){const ent=posCliente('recepcao',0,G)||alvo;sp={x:ent.x,y:ent.y,t:hash(l.id),walking:false,celebT:0,setor:null};leadSprites.set(l.id,sp);}
    if(sp.setor!==l.setor_id||layoutMudou){sp.tx=alvo.x;sp.ty=alvo.y;sp.walking=true;sp.setor=l.setor_id;}
    sp.lead=l;
  });
  for(const [id,sp] of leadSprites){if(!vivos.has(id))leadSprites.delete(id);}
  layoutMudou=false;
}
function celebrar(ev){const sp=leadSprites.get(ev.lead_id);if(sp)sp.celebT=80;confete=90;}
let confete=0,tick=0,vista='home',hits=[];

function desenharHome(){
  const G=calcHome();geo.home=G;S=G.S;if(layoutMudou)sincronizarSprites();
  ctx.fillStyle='#080310';ctx.fillRect(0,0,W,H);hits=[];
  // desenha as salas de trás para frente (profundidade isométrica = c + r)
  const ordem=estado.setores.map((s,idx)=>({s,idx,o:salaOff(idx,G)})).sort((a,b)=>(a.o.c+a.o.r)-(b.o.c+b.o.r)||a.o.c-b.o.c);
  ordem.forEach(({s,idx,o})=>{
    const itens=[];
    const f1=shade(s.cor,-150),f2=shade(s.cor,-165);
    for(let r=0;r<ROOM;r++)for(let c=0;c<ROOM;c++){const p=iso(o.c+c,o.r+r,G.ox,G.oy);drawTile(p.x,p.y,((c+r)%2===0)?f1:f2);}
    for(let c=0;c<ROOM;c++){const p=iso(o.c+c,o.r,G.ox,G.oy);drawWall(p.x,p.y,shade(s.cor,-70),shade(s.cor,-95),WALL_HOME);}
    for(let r=1;r<ROOM;r++){const p=iso(o.c,o.r+r,G.ox,G.oy);drawWall(p.x,p.y,shade(s.cor,-70),shade(s.cor,-95),WALL_HOME);}
    const ag=estado.agentes.find(a=>a.setor_id===s.id);
    const dk=iso(o.c+1,o.r+1,G.ox,G.oy);itens.push({d:dk.y,f:()=>drawDesk(dk.x,dk.y+TH/2,s.cor,ag&&ag.status==='trabalhando')});
    const pl=iso(o.c+ROOM-1,o.r+ROOM-1,G.ox,G.oy);itens.push({d:pl.y,f:()=>drawPlant(pl.x,pl.y+TH/2)});
    if(ag){const pa=posAgente(s.id,G);const sp=agSprite(ag,pa);itens.push({d:sp.y,f:()=>drawPessoa(sp,{roupa:s.cor,pele:ag.avatar&&ag.avatar.pele,cabelo:ag.avatar&&ag.avatar.cabelo,nome:ag.nome,statusCor:AG_COLOR[ag.status]})});}
    const tl=iso(o.c,o.r,G.ox,G.oy),br=iso(o.c+ROOM-1,o.r+ROOM-1,G.ox,G.oy),tr2=iso(o.c+ROOM-1,o.r,G.ox,G.oy),bl=iso(o.c,o.r+ROOM-1,G.ox,G.oy);
    hits.push({tipo:'sala',s,minX:(bl.x-TW/2)*S,maxX:(tr2.x+TW/2)*S,minY:(tl.y-WALL_HOME-20)*S,maxY:(br.y+TH)*S});
    s._placa=iso(o.c+ROOM/2-.5,o.r,G.ox,G.oy);
    for(const sp of leadSprites.values()){if(sp.setor===s.id)itens.push({d:sp.y,f:()=>drawPessoa(sp,{roupa:sp.lead.parado?'#aa4455':'#7788aa',escala:.8,alerta:sp.lead.parado})});}
    itens.sort((a,b)=>a.d-b.d).forEach(i=>i.f());
  });
  estado.setores.forEach(s=>{
    const p=s._placa;const fs=Math.max(9,Math.min(14,S*5));const y=(p.y-WALL_HOME-6)*S;label(s.nome.toUpperCase(),p.x*S,y,s.cor,fs);
    const txt=s.id==='gerente'?`${estado.resumo.parados??0} parados`:`${s.leads_ativos} clientes${s.leads_parados?' · ⚠'+s.leads_parados:''}`;
    label(txt,p.x*S,y+fs+7,s.leads_parados?'#ff4466':null,Math.max(8,Math.min(11,S*3.6)),'rgba(0,0,0,.7)');
  });
  if(!estado.setores.length){ctx.font="10px 'Press Start 2P',monospace";ctx.textAlign='center';ctx.fillStyle='#553388';ctx.fillText(conectado||demo?'carregando escritório...':'conectando...',W/2,H/2);}
}
const agSprites=new Map();
function agSprite(ag,pos){let sp=agSprites.get(ag.id);if(!sp){sp={x:pos.x,y:pos.y,t:ag.id*13,walking:false,celebT:0};agSprites.set(ag.id,sp);}sp.x=pos.x;sp.y=pos.y;return sp;}

// ── vista detalhada de um setor ──
let setorVista=null;const DC=7,DR=6;
function desenharDetalhe(){
  const s=setorById(setorVista);if(!s){vista='home';return;}
  const fw=W/((DC+DR)*TW/2),fh=H/((DC+DR)*TH/2+WALL_H+20);S=Math.max(.35,Math.min(fw,fh)*.95);
  const sw=W/S,sh=H/S,gh=(DC+DR)*TH/2,ox=sw/2+(DR-DC)*TW/4,oy=WALL_H+10+(sh-WALL_H-10-gh)/2;
  ctx.fillStyle='#080310';ctx.fillRect(0,0,W,H);hits=[];
  const f1=shade(s.cor,-150),f2=shade(s.cor,-165);
  for(let r=0;r<DR;r++)for(let c=0;c<DC;c++){const p=iso(c,r,ox,oy);drawTile(p.x,p.y,((c+r)%2===0)?f1:f2);}
  for(let c=0;c<DC;c++){const p=iso(c,0,ox,oy);drawWall(p.x,p.y,shade(s.cor,-70),shade(s.cor,-95));}
  for(let r=1;r<DR;r++){const p=iso(0,r,ox,oy);drawWall(p.x,p.y,shade(s.cor,-70),shade(s.cor,-95));}
  const itens=[];const ag=estado.agentes.find(a=>a.setor_id===s.id);
  const dk=iso(2,1,ox,oy);itens.push({d:dk.y,f:()=>drawDesk(dk.x,dk.y+TH/2,s.cor,ag&&ag.status==='trabalhando')});
  [[DC-1,0],[DC-1,DR-1]].forEach(([c,r])=>{const p=iso(c,r,ox,oy);itens.push({d:p.y,f:()=>drawPlant(p.x,p.y+TH/2)});});
  if(ag){const p=iso(2,2,ox,oy);const sp=agSprite(ag,{x:p.x,y:p.y+TH/2});itens.push({d:sp.y,f:()=>drawPessoa(sp,{roupa:s.cor,pele:ag.avatar&&ag.avatar.pele,cabelo:ag.avatar&&ag.avatar.cabelo,nome:ag.nome+' · '+(AG_LABEL[ag.status]||''),statusCor:AG_COLOR[ag.status]})});
    hits.push({tipo:'agente',ag,s,x:p.x*S,y:(p.y)*S});}
  const leads=s.id==='gerente'?estado.leads.filter(l=>l.parado):estado.leads.filter(l=>l.setor_id===s.id);
  const vagas=[];for(let r=1;r<DR;r++)for(let c=1;c<DC;c++){if(!((c===2&&(r===1||r===2))))vagas.push({c,r});}
  leads.slice(0,vagas.length).forEach((l,i)=>{
    const v=vagas[i];const p=iso(v.c,v.r,ox,oy);
    let sp=detSprites.get(l.id);if(!sp){sp={x:p.x,y:p.y+TH/2,t:hash(l.id),walking:false,celebT:0};detSprites.set(l.id,sp);}
    sp.x=p.x;sp.y=p.y+TH/2;
    const nome=(l.nome||'Cliente').split(' ')[0];
    itens.push({d:sp.y,f:()=>drawPessoa(sp,{roupa:l.parado?'#aa4455':'#7788aa',nome,corNome:l.parado?'#ff4466':'#aabbcc',alerta:l.parado})});
    hits.push({tipo:'lead',l,x:sp.x*S,y:(sp.y-8)*S});
  });
  itens.sort((a,b)=>a.d-b.d).forEach(i=>i.f());
  const pl=iso(DC/2-.5,0,ox,oy);label(s.nome.toUpperCase(),pl.x*S,(pl.y-WALL_H*.7)*S,s.cor,Math.max(12,S*6.5));
  if(leads.length>vagas.length)label('+'+(leads.length-vagas.length)+' clientes',W/2,H-60,s.cor,12);
  if(!leads.length)label(s.id==='gerente'?'Nenhum cliente parado':'Sala vazia no momento',W/2,H/2+40,null,12,'rgba(0,0,0,.6)');
  desenharVoltar(s.cor);
}
const detSprites=new Map();
let voltarRect={x:0,y:0,w:0,h:0};
function desenharVoltar(cor){
  const fs=Math.max(11,Math.min(15,W/30));ctx.font=`bold ${fs}px Arial,sans-serif`;const t='◀ VOLTAR';const w=ctx.measureText(t).width+32,h=fs+18,x=(W-w)/2,y=H-h-10;
  voltarRect={x,y,w,h};ctx.fillStyle='#150330';ctx.fillRect(x,y,w,h);ctx.strokeStyle=cor;ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText(t,x+w/2,y+h/2+fs/3);
}

// ── animação ──
function passo(){
  for(const sp of leadSprites.values()){sp.t++;if(sp.celebT>0)sp.celebT--;
    if(sp.walking&&sp.tx!=null){const dx=sp.tx-sp.x,dy=sp.ty-sp.y,d=Math.hypot(dx,dy);if(d<.8){sp.x=sp.tx;sp.y=sp.ty;sp.walking=false;}else{const v=Math.min(1.6,.5+d/60);sp.x+=dx/d*v;sp.y+=dy/d*v;}}}
  for(const sp of agSprites.values())sp.t++;for(const sp of detSprites.values())sp.t++;
}
function desenharConfete(){if(confete<=0)return;confete--;for(let i=0;i<30;i++){ctx.fillStyle=['#ffcc00','#ff6644','#44ff88','#00ccff','#cc44ff'][i%5];ctx.fillRect(Math.random()*W,Math.random()*H*(1-confete/90)+0,4,4);}
  label('🎉 CONTRATO ASSINADO!',W/2,40,'#ffcc00',14);}
function loop(){requestAnimationFrame(loop);tick++;passo();if(vista==='home')desenharHome();else desenharDetalhe();desenharConfete();}

// ── interação ──
const tip=document.getElementById('tip');
function mostrarTip(html,cor,sx,sy){tip.innerHTML=html;tip.style.borderColor=cor;let x=sx+12,y=sy-20;if(x+250>innerWidth)x=sx-250;if(y+200>innerHeight)y=innerHeight-204;tip.style.left=x+'px';tip.style.top=y+'px';tip.style.display='block';}
function clique(mx,my,sx,sy){
  tip.style.display='none';
  if(vista!=='home'){
    const b=voltarRect;if(mx>=b.x&&mx<=b.x+b.w&&my>=b.y&&my<=b.y+b.h){vista='home';document.getElementById('logoTxt').textContent='★ CLT & FGTS';detSprites.clear();return;}
    for(const h of hits){
      if(Math.abs(mx-h.x)<14*S&&Math.abs(my-h.y)<18*S){
        if(h.tipo==='lead'){const l=h.l,st=setorById(l.setor_id);
          mostrarTip(`<div class="tn">${esc(l.nome||'Cliente #'+l.id)}</div>
            <div class="tr2"><span>SETOR</span><span class="tv" style="color:${st?st.cor:'#fff'}">${esc(st?st.nome:l.setor_id)}</span></div>
            <div class="tr2"><span>ETAPA</span><span class="tv">${STATUS_LABEL[l.status]||esc(l.status)}</span></div>
            <div class="tr2"><span>PRODUTO</span><span class="tv">${esc((l.produto||'—').toUpperCase())}</span></div>
            <div class="tr2"><span>VALOR</span><span class="tv">${brlFull(l.valor)}</span></div>
            <div class="tr2"><span>NO SETOR HÁ</span><span class="tv" style="color:${l.parado?'#ff4466':'#ddd'}">${tempo(minDesde(l.entrou_setor_em))}${l.parado?' ⚠':''}</span></div>
            <div class="tr2"><span>AGUARDANDO</span><span class="tv">${esc(l.aguardando||'—')}</span></div>`,st?st.cor:'#ffcc00',sx,sy);return;}
        if(h.tipo==='agente'){const a=h.ag;
          mostrarTip(`<div class="tn">${esc(a.nome)} · ${esc(h.s.nome)}</div>
            <div class="tr2"><span>FUNÇÃO</span><span class="tv">${esc(a.papel||'')}</span></div>
            <div class="tr2"><span>STATUS</span><span class="tv" style="color:${AG_COLOR[a.status]}">${AG_LABEL[a.status]||esc(a.status)}</span></div>
            <div class="tr2"><span>ATENDENDO</span><span class="tv">${a.em_andamento||0}</span></div>
            <div class="tr2"><span>FECHADOS</span><span class="tv">${a.fechados||0}</span></div>`,h.s.cor,sx,sy);return;}
      }
    }
    return;
  }
  for(const h of hits){if(h.tipo==='sala'&&mx>=h.minX&&mx<=h.maxX&&my>=h.minY&&my<=h.maxY){vista='setor';setorVista=h.s.id;document.getElementById('logoTxt').textContent='★ '+h.s.nome.toUpperCase();return;}}
}
cv.addEventListener('click',e=>{const r=cv.getBoundingClientRect();clique(e.clientX-r.left,e.clientY-r.top,e.clientX,e.clientY);});
cv.addEventListener('touchend',e=>{e.preventDefault();const t=e.changedTouches[0],r=cv.getBoundingClientRect();clique(t.clientX-r.left,t.clientY-r.top,t.clientX,t.clientY);},{passive:false});

// ── início ──
atualizar();setInterval(atualizar,POLL_MS);loop();
</script>
