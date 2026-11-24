// ═════════════ MODO DEMO (dados fictícios no mesmo formato da API) ═════════════
const DEMO_SETORES=[
 {id:'recepcao',nome:'Recepção',descricao:'Recebe o cliente, entende o interesse e pede o CPF',cor:'#ff6644',ordem:1,sla_minutos:30},
 {id:'simulacao',nome:'Simulação',descricao:'Consulta V8 Digital e Hub Crédito e monta a melhor oferta',cor:'#ffcc00',ordem:2,sla_minutos:15},
 {id:'vendas',nome:'Vendas',descricao:'Apresenta a oferta, contorna objeções e decide CLT ou FGTS',cor:'#00ccff',ordem:3,sla_minutos:120},
 {id:'formalizacao',nome:'Formalização',descricao:'Envia o link de assinatura e cobra quem não assinou',cor:'#44ff88',ordem:4,sla_minutos:1440},
 {id:'posvenda',nome:'Pós-venda',descricao:'Confirma liberação, oferece FGTS (upsell) e pede indicação',cor:'#cc44ff',ordem:5,sla_minutos:4320},
 {id:'gerente',nome:'Gerente',descricao:'Supervisiona todos os setores e resgata clientes parados',cor:'#aaaaaa',ordem:6,sla_minutos:null}];
const DEMO_AG=[['Ana','recepcao','Recepcionista'],['Bruno','simulacao','Analista de crédito'],['Carla','vendas','Consultora de vendas'],['Diego','formalizacao','Especialista em contratos'],['Elisa','posvenda','Relacionamento'],['Fernando','gerente','Gerente geral']];
const DEMO_NOMES=['João Silva','Maria Santos','Pedro Oliveira','Carla Costa','Roberto Lima','Juliana Ferreira','Marcelo Souza','Patricia Alves','Fernando Rocha','Beatriz Mendes','André Cardoso','Camila Ribeiro','Rodrigo Nunes','Larissa Pinto','Leandro Castro','Amanda Correia','Fabio Dias','Renata Barbosa'];
const FLUXO=[['recepcao','respondeu'],['recepcao','cpf_ok'],['simulacao','simulado'],['vendas','proposta'],['vendas','negociando'],['formalizacao','fechou'],['formalizacao','link_env'],['posvenda','assinou']];
let demoState=null, demoSeq=0;
function rnd(a,b){return Math.floor(Math.random()*(b-a+1))+a;}
function demoInit(){
  const agentes=DEMO_AG.map((a,i)=>({id:i+1,nome:a[0],setor_id:a[1],papel:a[2],status:'livre',avatar:{},fechados:0,em_andamento:0,receita_total:0}));
  const leads=[];const eventos=[];
  for(let i=0;i<12;i++){const st=rnd(0,FLUXO.length-1);leads.push(demoLead(st,rnd(1,200)));}
  demoState={setores:DEMO_SETORES,agentes,leads,eventos,numeros:[{id:1,apelido:'Atendimento 1',status_conexao:'conectado',leads_ativos:0},{id:2,apelido:'Atendimento 2',status_conexao:'conectado',leads_ativos:0}],fechados:0,comissao:0,entraram:12};
}
function demoLead(st,min){
  const prod=Math.random()<.65?'clt':'fgts';const valor=prod==='clt'?rnd(9000,28000):rnd(3000,11000);
  return{id:++demoSeq,nome:DEMO_NOMES[demoSeq%DEMO_NOMES.length],telefone:'55489'+rnd(10000000,99999999),setor_id:FLUXO[st][0],status:FLUXO[st][1],etapa:st,produto:prod,banco:Math.random()<.5?'v8digital':'hubcredito',valor,comissao:Math.round(valor*.03),numero_id:rnd(1,2),aguardando:Math.random()<.5?'cliente':'agente',entrou_setor_em:new Date(Date.now()-min*60000).toISOString(),ultima_interacao:new Date(Date.now()-min*30000).toISOString()};
}
function demoEvento(l,tipo,desc,de,para){demoState.eventos.unshift({id:Date.now()+Math.random(),lead_id:l.id,tipo,descricao:desc,setor_origem:de,setor_destino:para,criado_em:new Date().toISOString()});demoState.eventos=demoState.eventos.slice(0,40);}
function demoTick(){
  const D=demoState;
  if(Math.random()<.35){const l=demoLead(0,0);D.leads.push(l);D.entraram++;demoEvento(l,'entrou',l.nome+' entrou na Recepção',null,'recepcao');}
  for(let k=0;k<rnd(1,2);k++){
    const l=D.leads[rnd(0,D.leads.length-1)];if(!l)break;
    if(Math.random()<.06&&l.etapa<4){D.leads=D.leads.filter(x=>x!==l);demoEvento(l,'perdeu',l.nome+' desistiu ('+STATUS_LABEL[l.status]+')',l.setor_id,l.setor_id);continue;}
    if(l.etapa>=FLUXO.length-1){if(Math.random()<.3){D.leads=D.leads.filter(x=>x!==l);demoEvento(l,'status',l.nome+' concluiu o pós-venda',l.setor_id,null);}continue;}
    const de=l.setor_id;l.etapa++;l.setor_id=FLUXO[l.etapa][0];l.status=FLUXO[l.etapa][1];l.ultima_interacao=new Date().toISOString();l.aguardando=Math.random()<.5?'cliente':'agente';
    if(de!==l.setor_id){l.entrou_setor_em=new Date().toISOString();demoEvento(l,'mudou_setor',l.nome+' foi de '+setNome(de)+' para '+setNome(l.setor_id),de,l.setor_id);}
    if(l.status==='assinou'){D.fechados++;D.comissao+=l.comissao;const ag=D.agentes.find(a=>a.setor_id==='formalizacao');ag.fechados++;ag.receita_total+=l.comissao;demoEvento(l,'fechou',l.nome+' assinou! ('+brlFull(l.valor)+')',l.setor_id,l.setor_id);}
  }
  D.agentes.forEach(a=>{const n=D.leads.filter(l=>l.setor_id===a.setor_id).length;a.status=a.setor_id==='gerente'?(D.leads.some(l=>parado(l))?'trabalhando':'livre'):(n>0&&Math.random()<.8?'trabalhando':'livre');a.em_andamento=n;});
  return demoSnapshot();
}
function setNome(id){const s=DEMO_SETORES.find(x=>x.id===id);return s?s.nome:id;}
function parado(l){const s=(estado.setores.length?estado.setores:DEMO_SETORES).find(x=>x.id===l.setor_id);return !!(s&&s.sla_minutos&&minDesde(l.entrou_setor_em)>s.sla_minutos);}
function demoSnapshot(){
  const D=demoState;const leads=D.leads.map(l=>({...l,parado:parado(l)}));
  const setores=D.setores.map(s=>({...s,leads_ativos:leads.filter(l=>l.setor_id===s.id).length,leads_parados:leads.filter(l=>l.setor_id===s.id&&l.parado).length,agentes:1,agentes_trabalhando:D.agentes.filter(a=>a.setor_id===s.id&&a.status==='trabalhando').length}));
  return{gerado_em:new Date().toISOString(),setores,agentes:D.agentes.map(a=>({...a})),leads,eventos:D.eventos,numeros:D.numeros,funil:[],
    resumo:{entraram_hoje:D.entraram,em_andamento:leads.length,fecharam_hoje:D.fechados,comissao_hoje:D.comissao,volume_hoje:0,parados:leads.filter(l=>l.parado).length,perdidos_hoje:0}};
}

