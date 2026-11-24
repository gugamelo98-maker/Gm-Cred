// ═════════════ CONFIG ═════════════
const QS=new URLSearchParams(location.search);
const ENDPOINT=QS.get('api')||'https://rarelookingorca-n8n.cloudfy.live/webhook/escritorio/estado';
const BASE=ENDPOINT.replace(/\/escritorio\/estado.*$/,'');
lsSet('escritorio_chave','');
let chave=lsGet('escritorio_token')||'';   // token de sessão (a chave mestra não fica salva)
let ultimaAtualizacao=0;
const POLL_MS=60000;   // dados reais: consulta o n8n 1x por minuto
const DEMO_MS=3000;    // modo demonstração: não usa o n8n, pode ser rápido
function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
let demo=QS.get('demo')==='1'||(QS.get('demo')!=='0'&&lsGet('escritorio_demo')==='1');

const STATUS_LABEL={disparado:'Disparado',respondeu:'Respondeu',cpf_ok:'CPF enviado',simulado:'Simulado',proposta:'Proposta enviada',negociando:'Negociando',fechou:'Fechou',link_env:'Link enviado',assinou:'Assinou',upsell:'Upsell',parou:'Desistiu'};
const AG_LABEL={trabalhando:'TRABALHANDO',livre:'DISPONÍVEL',pausado:'EM PAUSA'};
// visual padrão de cada agente (cabelo, roupa, estilo) — o banco pode sobrescrever via avatar
const VISUAL={
  recepcao:{pele:'#f1c9a5',cabelo:'#3b2219',estilo:'longo',roupa:'#e8eef6',detalhe:'#c94f4f'},
  simulacao:{pele:'#d9a77c',cabelo:'#1f1a17',estilo:'curto',roupa:'#2f4b7c',detalhe:'#ffffff',oculos:true},
  vendas:{pele:'#b9825a',cabelo:'#2a1a12',estilo:'coque',roupa:'#1f2937',detalhe:'#e8eef6'},
  formalizacao:{pele:'#8d5a3b',cabelo:'#121212',estilo:'raspado',roupa:'#f4f6f9',detalhe:'#2f6fed',gravata:true},
  posvenda:{pele:'#f3d2b8',cabelo:'#a0522d',estilo:'ondulado',roupa:'#7c5cbf',detalhe:'#ffffff'},
  gerente:{pele:'#e0b48e',cabelo:'#6b6b6b',estilo:'curto',roupa:'#2b3440',detalhe:'#ffffff',gravata:true,barba:true}
};
const CENA={recepcao:{janela:true,planta:true},simulacao:{quadro:'graf'},vendas:{janela:true,quadro:'meta'},formalizacao:{arquivo:true,planta:true},posvenda:{janela:true,planta:true},gerente:{janela:true,quadro:'graf',arquivo:true}};

