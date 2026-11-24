// ═════════════ CONFIG ═════════════
const QS = new URLSearchParams(location.search);
const ENDPOINT = QS.get('api') || 'https://rarelookingorca-n8n.cloudfy.live/webhook/escritorio/estado';
const POLL_MS = 5000;
function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
let demo = QS.get('demo')==='1' || lsGet('escritorio_demo')==='1';

const STATUS_LABEL={disparado:'DISPARADO',respondeu:'RESPONDEU',cpf_ok:'CPF ENVIADO',simulado:'SIMULADO',proposta:'PROPOSTA',negociando:'NEGOCIANDO',fechou:'FECHOU',link_env:'LINK ENVIADO',assinou:'ASSINOU',upsell:'UPSELL',parou:'DESISTIU'};
const AG_COLOR={trabalhando:'#00cc44',livre:'#334455',pausado:'#ffaa00'};
const AG_LABEL={trabalhando:'TRABALHANDO',livre:'LIVRE',pausado:'PAUSADO'};

