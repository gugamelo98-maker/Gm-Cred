// ═════════════ UTIL ═════════════
let estado={setores:[],agentes:[],leads:[],eventos:[],resumo:{},numeros:[],funil:[],financeiro:[],meta:null,contratos:[]};
const ETAPAS={aguardando_formalizacao:{nome:'Aguardando formalização',cor:'#e0a100',icone:'✍️',desc:'Proposta digitada, esperando o cliente assinar'},formalizado:{nome:'Formalizado',cor:'#2f6fed',icone:'📄',desc:'Cliente assinou; em análise ou processando o pagamento'},pago:{nome:'Pago',cor:'#16a36a',icone:'✅',desc:'Dinheiro liberado na conta do cliente (mês atual)'}};
let conectado=false,ultimoErro=null;
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function brl(v){v=Number(v)||0;return v>=1000?'R$'+(v/1000).toFixed(v>=10000?0:1).replace('.',',')+'k':'R$'+Math.round(v);}
function brlFull(v){return v==null?'—':'R$ '+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
function minDesde(iso){return iso?Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/60000)):0;}
function tempo(m){return m<60?m+' min':m<1440?Math.floor(m/60)+'h'+String(m%60).padStart(2,'0'):Math.floor(m/1440)+'d';}
function hora(iso){return new Date(iso).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});}
function setorById(id){return estado.setores.find(s=>s.id===id);}
function hash(n){let h=(Number(n)||0)*2654435761;return (h>>>0)%9973;}
function primeiro(n){return String(n||'Cliente').split(' ')[0];}

