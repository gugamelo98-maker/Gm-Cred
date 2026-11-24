// ═════════════ ESTADO ═════════════
let estado = {setores:[],agentes:[],leads:[],eventos:[],resumo:{},numeros:[],funil:[]};
let conectado = false, ultimoErro = null;

function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function brl(v){v=Number(v)||0;return v>=1000?'R$'+(v/1000).toFixed(v>=10000?0:1).replace('.',',')+'k':'R$'+Math.round(v);}
function brlFull(v){return v==null?'—':'R$ '+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
function minDesde(iso){return iso?Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/60000)):0;}
function tempo(m){return m<60?m+'min':m<1440?Math.floor(m/60)+'h'+String(m%60).padStart(2,'0'):Math.floor(m/1440)+'d';}
function hora(iso){const d=new Date(iso);return d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});}
function setorById(id){return estado.setores.find(s=>s.id===id);}
function hash(n){n=(n|0)*2654435761;return (n>>>0)%997;}

