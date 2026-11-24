// ═════════════ PESSOAS EM VETOR ═════════════
function cabeloFrente(est,c){
  switch(est){
    case 'longo':return `<path d="M38 52 Q36 26 60 24 Q84 26 82 52 Q80 38 70 34 Q58 40 44 38 Q40 44 38 52Z" fill="${c}"/>`;
    case 'coque':return `<circle cx="60" cy="22" r="9" fill="${c}"/><path d="M39 50 Q38 27 60 26 Q82 27 81 50 Q78 36 60 34 Q44 35 39 50Z" fill="${c}"/>`;
    case 'raspado':return `<path d="M40 46 Q41 28 60 27 Q79 28 80 46 Q76 34 60 33 Q44 34 40 46Z" fill="${c}" opacity=".9"/>`;
    case 'ondulado':return `<path d="M37 54 Q33 30 50 25 Q60 20 72 25 Q87 30 83 54 Q82 40 74 36 Q66 41 56 37 Q46 41 41 38 Q38 45 37 54Z" fill="${c}"/>`;
    default:return `<path d="M39 48 Q38 26 60 25 Q82 26 81 48 Q79 35 68 33 Q58 37 48 34 Q42 38 39 48Z" fill="${c}"/>`;
  }
}
function cabeloTras(est,c){
  if(est==='longo')return `<path d="M37 50 Q34 80 40 98 L80 98 Q86 80 83 50Z" fill="${c}"/>`;
  if(est==='ondulado')return `<path d="M36 52 Q30 78 38 92 Q48 96 60 94 Q72 96 82 92 Q90 78 84 52Z" fill="${c}"/>`;
  return '';
}
function rosto(v){
  return `<ellipse cx="38.5" cy="55" rx="3" ry="5" fill="${v.pele}"/><ellipse cx="81.5" cy="55" rx="3" ry="5" fill="${v.pele}"/>
  <ellipse cx="60" cy="52" rx="21" ry="25" fill="${v.pele}"/>
  <ellipse cx="60" cy="58" rx="21" ry="19" fill="#000" opacity=".03"/>
  <path d="M47 46 Q51 44 55 46" stroke="${shade(v.cabelo,-10)}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M65 46 Q69 44 73 46" stroke="${shade(v.cabelo,-10)}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <ellipse cx="51" cy="52" rx="2.4" ry="2.8" fill="#2b2420"/><ellipse cx="69" cy="52" rx="2.4" ry="2.8" fill="#2b2420"/>
  <circle cx="51.8" cy="51.2" r=".8" fill="#fff"/><circle cx="69.8" cy="51.2" r=".8" fill="#fff"/>
  <path d="M60 55 Q58 61 61 62" stroke="${shade(v.pele,-35)}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M53 67 Q60 71 67 67" stroke="#a8554f" stroke-width="2" fill="none" stroke-linecap="round"/>
  <ellipse cx="47" cy="62" rx="4" ry="2.4" fill="#e88" opacity=".18"/><ellipse cx="73" cy="62" rx="4" ry="2.4" fill="#e88" opacity=".18"/>
  ${v.barba?`<path d="M41 58 Q42 76 60 78 Q78 76 79 58 Q76 70 60 72 Q44 70 41 58Z" fill="${v.cabelo}" opacity=".75"/>`:''}
  ${v.oculos?`<g fill="none" stroke="#2b2b2b" stroke-width="1.8"><rect x="44" y="47" width="13" height="10" rx="3"/><rect x="63" y="47" width="13" height="10" rx="3"/><path d="M57 51 L63 51"/></g>`:''}`;
}
// agente sentado (busto), viewBox 0 0 120 130
function pessoaSentada(v){
  const g=v.gravata?`<path d="M60 92 L56 98 L60 122 L64 98Z" fill="${v.detalhe}"/>`:'';
  return `<svg viewBox="0 0 120 130"><g class="respira">
    ${cabeloTras(v.estilo,v.cabelo)}
    <rect x="53" y="70" width="14" height="16" rx="5" fill="${shade(v.pele,-18)}"/>
    <path d="M18 132 Q18 96 42 88 L60 96 L78 88 Q102 96 102 132Z" fill="${v.roupa}"/>
    <path d="M42 88 L60 108 L78 88 L72 85 L60 96 L48 85Z" fill="${v.gravata?'#fff':shade(v.roupa,-14)}"/>
    ${g}
    <path d="M18 132 Q18 100 34 92 L38 132Z" fill="#000" opacity=".06"/>
    ${rosto(v)}
    ${cabeloFrente(v.estilo,v.cabelo)}
  </g></svg>`;
}
// cliente em pé, viewBox 0 0 30 74
const CAMISAS=['#4f7cac','#c7724f','#5a9e7c','#8a6fb5','#d0a23f','#4a5568','#b85c7a','#3f8fa3'];
const PELES=['#f1c9a5','#d9a77c','#b9825a','#8d5a3b','#f3d2b8','#e0b48e'];
const CABELOS=['#2a1a12','#121212','#5a3825','#a0522d','#6b6b6b','#3b2219'];
function pessoaEmPe(id,parado){
  const h=hash(id),cam=parado?'#d95c5c':CAMISAS[h%CAMISAS.length],pele=PELES[(h>>3)%PELES.length],cab=CABELOS[(h>>5)%CABELOS.length],calca=['#2d3748','#344a6b','#4a4a4a'][(h>>2)%3];
  const longo=(h>>4)%3===0;
  return `<svg viewBox="0 0 30 74">
    <ellipse cx="15" cy="72" rx="9" ry="2.2" fill="#000" opacity=".12"/>
    <g class="pe"><rect x="9.5" y="44" width="5" height="25" rx="2.4" fill="${calca}"/><rect x="8.5" y="67" width="7" height="4" rx="2" fill="#222"/></g>
    <g class="pd"><rect x="15.5" y="44" width="5" height="25" rx="2.4" fill="${shade(calca,-12)}"/><rect x="14.5" y="67" width="7" height="4" rx="2" fill="#1a1a1a"/></g>
    <path d="M7 24 Q7 18 15 18 Q23 18 23 24 L24 46 L6 46Z" fill="${cam}"/>
    <rect x="3.5" y="22" width="4.5" height="19" rx="2.2" fill="${shade(cam,-12)}"/><rect x="22" y="22" width="4.5" height="19" rx="2.2" fill="${shade(cam,-12)}"/>
    <circle cx="5.8" cy="41.5" r="2.2" fill="${pele}"/><circle cx="24.2" cy="41.5" r="2.2" fill="${pele}"/>
    <rect x="13" y="14" width="4" height="5" fill="${shade(pele,-15)}"/>
    ${longo?`<path d="M8 10 Q8 22 10 24 L20 24 Q22 22 22 10Z" fill="${cab}"/>`:''}
    <ellipse cx="15" cy="9.5" rx="6.2" ry="7" fill="${pele}"/>
    <path d="M8.6 9 Q8.5 2 15 2 Q21.5 2 21.4 9 Q19 5 15 5.5 Q11 5 8.6 9Z" fill="${cab}"/>
    <circle cx="12.7" cy="10" r=".9" fill="#2b2420"/><circle cx="17.3" cy="10" r=".9" fill="#2b2420"/>
    <path d="M13 13 Q15 14.3 17 13" stroke="#a8554f" stroke-width=".8" fill="none" stroke-linecap="round"/>
  </svg>`;
}
function shade(hex,a){const n=parseInt(String(hex).replace('#',''),16);if(isNaN(n))return hex;return'#'+[n>>16,n>>8&255,n&255].map(c=>Math.min(255,Math.max(0,c+a)).toString(16).padStart(2,'0')).join('');}
function visualAgente(ag){const base=VISUAL[ag.setor_id]||VISUAL.recepcao;const a=ag.avatar||{};let v={...base};
  if(ag.versao&&ag.versao!=='A'){const h=hash(ag.id*7+3);   // B e C ganham outra aparência para dar para distinguir na sala
    v={...v,pele:PELES[h%PELES.length],cabelo:CABELOS[(h>>2)%CABELOS.length],estilo:['curto','longo','coque','ondulado','raspado'][(h>>4)%5],roupa:shade(base.roupa,ag.versao==='B'?-28:26),oculos:h%4===0,barba:false,gravata:base.gravata&&h%2===0};}
  return{...v,...(a.pele?{pele:a.pele}:{}),...(a.cabelo?{cabelo:a.cabelo}:{}),...(a.estilo?{estilo:a.estilo}:{}),...(a.roupa?{roupa:a.roupa}:{}),foto:a.foto};}
function agentesDe(setorId){const L=estado.agentes.filter(a=>a.setor_id===setorId);const V=L.filter(a=>a.versao);return (V.length?V:L).slice().sort((x,y)=>String(x.versao||'').localeCompare(String(y.versao||''))||x.id-y.id).slice(0,3);}
const POSTOS={1:[50],2:[30,70],3:[19,50,81]};
function avatarAgente(ag,classe){const v=visualAgente(ag);if(v.foto)return `<img src="${esc(v.foto)}" alt="${esc(ag.nome)}" style="width:100%;height:100%;object-fit:cover;border-radius:50% 50% 16px 16px">`;return pessoaSentada(v);}

