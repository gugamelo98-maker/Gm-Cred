// ═════════════ MODO DEMO (dados fictícios no mesmo formato da API) ═════════════
const DEMO_SETORES=[
 {id:'recepcao',nome:'Recepção',descricao:'Recebe o cliente, entende o interesse e pede o CPF',cor:'#f26b4d',ordem:1,sla_minutos:30},
 {id:'simulacao',nome:'Simulação',descricao:'Consulta a margem na V8 e monta a melhor oferta',cor:'#e0a100',ordem:2,sla_minutos:30},
 {id:'vendas',nome:'Vendas',descricao:'Apresenta a oferta, ajusta prazo e parcela e contorna objeções',cor:'#2f8fd8',ordem:3,sla_minutos:120},
 {id:'formalizacao',nome:'Formalização',descricao:'Coleta os dados, digita a proposta na V8 e cobra a assinatura',cor:'#16a36a',ordem:4,sla_minutos:1440},
 {id:'posvenda',nome:'Pós-venda',descricao:'Acompanha o pagamento, resolve pendências e pede indicação',cor:'#8a5cd6',ordem:5,sla_minutos:4320},
 {id:'gerente',nome:'Gerente',descricao:'Supervisiona todos os setores e resgata clientes parados',cor:'#6b7787',ordem:6,sla_minutos:null}];
const DEMO_N={recepcao:['Ana','Bia','Caio'],simulacao:['Bruno','Duda','Enzo'],vendas:['Carla','Fábio','Gabi'],formalizacao:['Diego','Helô','Igor'],posvenda:['Elisa','João','Lara'],gerente:['Fernando','Marta','Nico']};
const DEMO_AB={recepcao:['Direta: pede o CPF logo','Consultiva: entende a necessidade antes','Segurança: passa confiança e depois pede o CPF'],simulacao:['Valor máximo primeiro','Parcela que cabe','Três opções'],vendas:['Objetiva','Consultiva: pergunta o motivo','Urgência leve'],formalizacao:['Direto','Passo a passo','Guiado com mini-guia'],posvenda:['Proativa','Sob demanda','Relacionamento'],gerente:['Lembrete simples','Novo motivo','Pergunta aberta']};
const DEMO_AG=Object.keys(DEMO_N).flatMap((set,si)=>DEMO_N[set].map((n,i)=>({id:101+si*3+i,nome:n,setor_id:set,setor:set,versao:'ABC'[i],abordagem:DEMO_AB[set][i],papel:DEMO_AB[set][i],peso:1})));
function demoAgDe(set){return DEMO_AG[Object.keys(DEMO_N).indexOf(set)*3+rnd(0,2)].id;}
const DEMO_NOMES=['João Silva','Maria Santos','Pedro Oliveira','Carla Costa','Roberto Lima','Juliana Ferreira','Marcelo Souza','Patricia Alves','Fernando Rocha','Beatriz Mendes','André Cardoso','Camila Ribeiro','Rodrigo Nunes','Larissa Pinto','Leandro Castro','Amanda Correia','Fabio Dias','Renata Barbosa'];
const FLUXO=[['recepcao','respondeu'],['recepcao','cpf_ok'],['simulacao','simulado'],['vendas','proposta'],['vendas','negociando'],['formalizacao','fechou'],['formalizacao','link_env'],['posvenda','assinou']];
let demoState=null,demoSeq=0;
function rnd(a,b){return Math.floor(Math.random()*(b-a+1))+a;}
function demoFicha(id){const D=demoState;const l=D.leads.find(x=>x.id===id)||{id,nome:'Cliente',setor_id:'posvenda',status:'assinou'};const t0=Date.now()-50*60000;let k=0;const m=(dir,txt,set)=>({direcao:dir,conteudo:txt,setor_id:set,criado_em:new Date(t0+(k++)*3*60000).toISOString()});
  const p=primeiro(l.nome),conv=[m('entrada','Oi, quero simular meu crédito CLT'),m('saida','Olá, '+p+'! Sou a Ana 😊 Me passa seu CPF para eu verificar as condições?','recepcao'),m('entrada','123.456.789-00')];
  const et=FLUXO.findIndex(f=>f[1]===l.status);
  if(et>=2)conv.push(m('saida','Pronto, '+p+'! Você tem margem de R$ 412,00. Consigo liberar até '+brlFull(l.valor)+' em 46x. Quer seguir?','simulacao'));
  if(et>=3)conv.push(m('entrada','Quanto fica a parcela em 36x?'),m('saida','Em 36x a parcela fica R$ 389,90 e você recebe '+brlFull((l.valor||0)*.9)+'.','vendas'));
  if(et>=5)conv.push(m('entrada','Pode ser em 46x mesmo'),m('saida','Perfeito! Para gerar o contrato preciso de: CEP, nome da mãe, RG e chave PIX no seu CPF.','formalizacao'));
  if(et>=6)conv.push(m('saida','Contrato gerado ✅ Assine por aqui: https://formalizacao.v8sistema.com/...','formalizacao'));
  if(l.aguardando==='humano')conv.push(m('entrada','Quero falar com uma pessoa, por favor'));
  return{lead:{...l,cpf:'123.***.***-00',numero:'Atendimento '+(l.numero_id||1),criado_em:new Date(t0).toISOString()},conversa:conv,
    eventos:(()=>{const ev=D.eventos.filter(e=>e.lead_id===id).slice().reverse();return ev.length?ev:[{descricao:l.nome+' entrou na Recepção',criado_em:new Date(t0).toISOString()},...(et>=2?[{descricao:l.nome+' foi de Recepção para Simulação',criado_em:new Date(t0+9*60000).toISOString()}]:[]),...(et>=3?[{descricao:l.nome+' foi de Simulação para Vendas',criado_em:new Date(t0+12*60000).toISOString()}]:[]),...(et>=5?[{descricao:l.nome+' foi de Vendas para Formalização',criado_em:new Date(t0+21*60000).toISOString()}]:[])];})(),contratos:D.contratos.filter(c=>c.lead_id===id),simulacoes:[],alertas:[]};}
function demoAcao(tipo,leadId,alertaId){const D=demoState;
  if(tipo==='resolver')D.alertas=D.alertas.filter(a=>a.id!==alertaId);
  else{const l=D.leads.find(x=>x.id===leadId);if(l){l.aguardando=tipo==='assumir'?'humano':'agente';demoEvento(l,tipo==='assumir'?'humano_assumiu':'humano_devolveu',l.nome+(tipo==='assumir'?': atendimento assumido por um humano (agente pausado)':': atendimento devolvido ao agente'),l.setor_id,l.setor_id);}}
  aplicarEstado(demoTick());if(painelAberto&&painelAberto.startsWith('cliente:'))carregarFicha(Number(painelAberto.slice(8)));}
function setNome(id){const s=DEMO_SETORES.find(x=>x.id===id);return s?s.nome:id;}
function parado(l){const s=(estado.setores.length?estado.setores:DEMO_SETORES).find(x=>x.id===l.setor_id);return !!(s&&s.sla_minutos&&minDesde(l.entrou_setor_em)>s.sla_minutos);}
function demoLead(st,min){const prod=Math.random()<.65?'clt':'fgts';const valor=prod==='clt'?rnd(9000,28000):rnd(3000,11000);
  return{id:++demoSeq,nome:DEMO_NOMES[demoSeq%DEMO_NOMES.length],telefone:'55489'+rnd(10000000,99999999),setor_id:FLUXO[st][0],agente_id:demoAgDe(FLUXO[st][0]),status:FLUXO[st][1],etapa:st,produto:prod,banco:Math.random()<.5?'v8digital':'hubcredito',valor,comissao:Math.round(valor*.03),numero_id:rnd(1,2),aguardando:Math.random()<.5?'cliente':'agente',entrou_setor_em:new Date(Date.now()-min*60000).toISOString(),ultima_interacao:new Date(Date.now()-min*30000).toISOString()};}
function demoVendas(){let seed=7;const rnd2=()=>(seed=(seed*16807)%2147483647)/2147483647;const out=[],h=new Date();
  for(let i=61;i>=0;i--){const d=new Date(h.getFullYear(),h.getMonth(),h.getDate()-i),fds=d.getDay()===0||d.getDay()===6,tr=1+(61-i)/61*.8,cli=Math.round((fds?6:16)*tr+rnd2()*6),pg=Math.max(0,Math.round(cli*.17+(rnd2()-.5)*2)),lib=pg*Math.round(3200+rnd2()*1800);
    out.push({dia:dataISO(d),clientes:cli,digitados:Math.round(cli*.25),pagos:pg,liberado:lib,comissao:Math.round(lib*.068)});}
  return out;}
function demoInit(){demoBase=demoBase||demoGerar();demoState={setores:DEMO_SETORES,agentes:DEMO_AG.map(a=>({...a,status:'livre',avatar:{},fechados:0,em_andamento:0,receita_total:0})),leads:[],eventos:[],numeros:[{id:1,apelido:'Atendimento 1',telefone:'(48) 9xxxx-0001',status_conexao:'conectado'},{id:2,apelido:'Atendimento 2',telefone:'(48) 9xxxx-0002',status_conexao:'conectado'}],fechados:0,comissao:0,entraram:0,contratos:[]};
  for(let i=0;i<11;i++){demoState.leads.push(demoLead(rnd(0,FLUXO.length-1),rnd(1,200)));demoState.entraram++;}
  demoState.leads[0].aguardando='humano';
  demoState.alertas=[{id:1,tipo:'pendencia',prioridade:1,titulo:'Pendência de PIX na proposta',detalhe:'Chave PIX recusada pela V8: pedir nova chave',lead_id:demoState.leads[1].id,criado_em:new Date(Date.now()-35*60000).toISOString()},
    {id:2,tipo:'cancelamento',prioridade:1,titulo:'Cliente pediu cancelamento',detalhe:'Tentar reverter antes de cancelar na V8',lead_id:demoState.leads[2].id,criado_em:new Date(Date.now()-12*60000).toISOString()}];
  for(let i=0;i<5;i++){const c=demoContrato({id:900+i,nome:DEMO_NOMES[(i*5)%DEMO_NOMES.length]});c.etapa=['aguardando_formalizacao','formalizado','pago','pago','formalizado'][i];if(c.etapa==='pago')c.dt_pagamento=new Date().toISOString();c.criado_em=new Date(Date.now()-(i+1)*86400000).toISOString();demoState.contratos.push(c);}}
function pctComissao(seg,p){if(seg)return p>=46?9.5:p>=24?7:p===18?4.5:p===12?4.01:3.01;return p>=24?3.01:p>=12?2.01:1.01;}
function demoContrato(l){const p=[24,36,46,48,48,18][rnd(0,5)],seg=Math.random()<.7,v=rnd(1500,6000),pct=pctComissao(seg,p);
  return{id:'c'+l.id+'_'+Date.now(),lead_id:l.id,nome:l.nome,etapa:'aguardando_formalizacao',parcelas:p,com_seguro:seg,valor_liberado:v,valor_parcela:Math.round(v*(seg?1.6:1.4)/p*100)/100,percentual:pct,comissao:Math.round(v*pct)/100,criado_em:new Date().toISOString()};}
function demoEvento(l,tipo,desc,de,para){demoState.eventos.unshift({id:Date.now()+Math.random(),lead_id:l.id,tipo,descricao:desc,setor_origem:de,setor_destino:para,criado_em:new Date().toISOString()});demoState.eventos=demoState.eventos.slice(0,40);}
function demoTick(){
  const D=demoState;
  if(Math.random()<.35){const l=demoLead(0,0);D.leads.push(l);D.entraram++;demoEvento(l,'entrou',l.nome+' entrou na Recepção',null,'recepcao');}
  for(let k=0;k<rnd(1,2);k++){
    const l=D.leads[rnd(0,D.leads.length-1)];if(!l)break;if(l.aguardando==='humano')continue;
    if(Math.random()<.06&&l.etapa<4){D.leads=D.leads.filter(x=>x!==l);demoEvento(l,'perdeu',l.nome+' desistiu na etapa "'+STATUS_LABEL[l.status]+'"',l.setor_id,l.setor_id);continue;}
    if(l.etapa>=FLUXO.length-1){if(Math.random()<.3){D.leads=D.leads.filter(x=>x!==l);demoEvento(l,'status',l.nome+' concluiu o pós-venda',l.setor_id,null);}continue;}
    const de=l.setor_id;l.etapa++;l.setor_id=FLUXO[l.etapa][0];l.status=FLUXO[l.etapa][1];l.ultima_interacao=new Date().toISOString();l.aguardando=Math.random()<.5?'cliente':'agente';
    if(de!==l.setor_id){l.agente_id=demoAgDe(l.setor_id);l.entrou_setor_em=new Date().toISOString();demoEvento(l,'mudou_setor',l.nome+' foi de '+setNome(de)+' para '+setNome(l.setor_id),de,l.setor_id);}
    else demoEvento(l,'status',l.nome+': '+STATUS_LABEL[l.status],l.setor_id,l.setor_id);
    if(l.status==='link_env'&&!D.contratos.some(c=>c.lead_id===l.id)){const c=demoContrato(l);D.contratos.unshift(c);demoEvento(l,'contrato_aguardando_formalizacao',l.nome+': proposta digitada, '+brlFull(c.valor_liberado)+' · comissão '+brlFull(c.comissao),l.setor_id,l.setor_id);}
    if(l.status==='assinou'){const c=D.contratos.find(c=>c.lead_id===l.id);if(c)c.etapa='formalizado';}
    if(l.status==='assinou'){D.fechados++;D.comissao+=l.comissao;const ag=D.agentes.find(a=>a.id===l.agente_id)||D.agentes.find(a=>a.setor_id==='formalizacao');ag.fechados++;ag.receita_total+=l.comissao;demoEvento(l,'fechou',l.nome+' assinou o contrato! ('+brlFull(l.valor)+')',l.setor_id,l.setor_id);}
  }
  D.contratos.filter(c=>c.etapa==='formalizado').forEach(c=>{if(Math.random()<.12){c.etapa='pago';c.dt_pagamento=new Date().toISOString();demoEvento({id:c.lead_id},'contrato_pago',c.nome+': contrato pago! '+brlFull(c.valor_liberado)+' liberado · comissão '+brlFull(c.comissao),'posvenda','posvenda');}});
  D.agentes.forEach(a=>{const n=D.leads.filter(l=>l.agente_id===a.id).length;a.status=a.setor_id==='gerente'?(D.leads.some(parado)?'trabalhando':'livre'):(n>0?'trabalhando':'livre');a.em_andamento=n;});
  const leads=D.leads.map(l=>({...l,parado:parado(l)}));
  return demoCoerente({setores:D.setores.map(s=>({...s,leads_ativos:leads.filter(l=>l.setor_id===s.id).length,leads_parados:leads.filter(l=>l.setor_id===s.id&&l.parado).length,agentes:3,agentes_trabalhando:D.agentes.filter(a=>a.setor_id===s.id&&a.status==='trabalhando').length})),
    agentes:D.agentes.map(a=>({...a})),leads,eventos:D.eventos,numeros:D.numeros.map(n=>({...n,leads_ativos:leads.filter(l=>l.numero_id===n.id).length})),funil:[],
    resumo:{entraram_hoje:D.entraram,em_andamento:leads.length,fecharam_hoje:D.fechados,comissao_hoje:D.comissao,parados:leads.filter(l=>l.parado).length},
    financeiro:Object.keys(ETAPAS).map((k,i)=>{const cs=D.contratos.filter(c=>c.etapa===k);return{etapa:k,ordem:i+1,contratos:cs.length,valor_liberado:cs.reduce((a,c)=>a+c.valor_liberado,0),comissao:Math.round(cs.reduce((a,c)=>a+c.comissao,0)*100)/100};}),
    meta:(()=>{const h=new Date().toDateString(),cs=D.contratos.filter(c=>c.etapa==='pago'&&c.dt_pagamento&&new Date(c.dt_pagamento).toDateString()===h);return{meta_valor:7000,contratos_hoje:cs.length,valor_hoje:cs.reduce((a,c)=>a+c.valor_liberado,0),comissao_hoje:cs.reduce((a,c)=>a+c.comissao,0)};})(),
    contratos:D.contratos.slice(0,200),
    atencao:[...leads.filter(l=>l.aguardando==='humano').map(l=>({chave:'humano-'+l.id,tipo:'humano',prioridade:1,titulo:'Cliente aguardando atendimento humano',detalhe:'Setor: '+setNome(l.setor_id),lead_id:l.id,cliente:l.nome,desde:l.ultima_interacao})),
      ...D.alertas.map(a=>({chave:'alerta-'+a.id,tipo:a.tipo,prioridade:a.prioridade,titulo:a.titulo,detalhe:a.detalhe,lead_id:D.leads.some(x=>x.id===a.lead_id)?a.lead_id:null,alerta_id:a.id,cliente:(D.leads.find(x=>x.id===a.lead_id)||{}).nome,desde:a.criado_em})),
      ...leads.filter(l=>l.parado&&l.aguardando!=='humano'&&minDesde(l.entrou_setor_em)>=2*((DEMO_SETORES.find(s=>s.id===l.setor_id)||{}).sla_minutos||1e9)).slice(0,3).map(l=>({chave:'travado-'+l.id,tipo:'travado',prioridade:2,titulo:'Cliente travado há '+minDesde(l.entrou_setor_em)+' min',detalhe:'Setor: '+setNome(l.setor_id),lead_id:l.id,cliente:l.nome,desde:l.entrou_setor_em}))],
    funil:{},vendas:[],simulacao:null,
    saude:{v8:{ok:true,detalhe:'Última chamada há 1 min, sem erros'},whatsapp:{ok:true,detalhe:'2 de 2 números conectados'},n8n:{ok:true,detalhe:'Sem erros na última hora'}}});
}
// DEMONSTRAÇÃO COERENTE: uma base só (cada cliente fictício com sua jornada pelos agentes A/B/C) alimenta
// o gráfico de vendas, o funil, a simulação, o cadastro de clientes e a aba Agentes.
let demoBase=null;
function demoGerar(){let seed=11;const r=()=>(seed=(seed*16807)%2147483647)/2147483647,ri=(a,b)=>Math.floor(r()*(b-a+1))+a;
  const P={recepcao:[.62,.70,.78],simulacao:[.80,.86,.83],vendas:[.48,.62,.40],formalizacao:[.70,.82,.76],posvenda:[.92,.90,.95]};
  const ag=(set,i)=>DEMO_AG[Object.keys(DEMO_N).indexOf(set)*3+i].id,SOB=['Moura','Teixeira','Ramos','Freitas','Lopes','Vieira','Araújo','Gomes','Pires','Nogueira'];
  const h=new Date(),vendas=[],jornadas=[],crm=[];let k=0;
  for(let i=61;i>=0;i--){const d=new Date(h.getFullYear(),h.getMonth(),h.getDate()-i),fds=d.getDay()===0||d.getDay()===6,tr=1+(61-i)/61*.8;
    const cli=i===0?0:Math.round((fds?6:16)*tr+r()*6);const dia={dia:dataISO(d),clientes:cli,digitados:0,pagos:0,liberado:0,comissao:0};
    for(let c=0;c<cli;c++){const a={},e=new Date(d.getTime()+ri(8*60,21*60)*60000);let g='andamento',et=1,sit='Conversando',motivo=null,of=null;
      const v={};Object.keys(DEMO_N).forEach(x=>v[x]=ri(0,2));
      const bonus=(v.recepcao===1&&v.vendas===1)?.12:(v.recepcao===2&&v.vendas===2)?-.15:0;   // Bia+Fábio combinam bem; Caio+Gabi, mal
      const passo=(set,p)=>{const ok=r()<p;a[set]=[ag(set,v[set]),ok?'avancou':'perdeu',Math.round(5+r()*60)];return ok;};
      if(r()<.15){a.recepcao=[ag('recepcao',v.recepcao),'perdeu',8];g='sem_margem';et=2;sit='Sem margem';motivo='Sem margem disponível';}
      else if(!passo('recepcao',P.recepcao[v.recepcao])){g='perdido';et=1;sit=r()<.5?'Sumiu · sem CPF':'Desistiu';}
      else if(!passo('simulacao',P.simulacao[v.simulacao])){g='perdido';et=2;sit='Sumiu · mandou CPF';}
      else if(!passo('vendas',P.vendas[v.vendas]+bonus)){g='perdido';et=3;sit=r()<.6?'Sumiu · recebeu proposta':'Desistiu · recebeu proposta';}
      else{const val=ri(15,60)*100;of={valor:val,prazo:46,parcela:Math.round(val/16)};dia.digitados++;
        if(!passo('formalizacao',P.formalizacao[v.formalizacao])){g='perdido';if(r()<.7){et=4;sit='Não assinou o link';}else{et=5;sit='Cancelou o contrato';}}
        else{const pg=i>1&&r()<P.posvenda[v.posvenda];a.posvenda=[ag('posvenda',v.posvenda),pg?'avancou':null,600];g=pg?'pago':'andamento';et=pg?6:5;sit=pg?'Pago':'Aguardando pagamento';
          if(pg){dia.pagos++;dia.liberado+=val;dia.comissao+=Math.round(val*.068);}}}
      if(g==='perdido'&&r()<.5){const ok=r()<[.15,.22,.3][v.gerente];a.gerente=[ag('gerente',v.gerente),ok?'recuperou':'perdeu',30];}
      const id=9000+(k++);jornadas.push({l:id,t:false,e:e.toISOString(),g,et,s:sit,a});
      crm.push({id,nome:DEMO_NOMES[ri(0,DEMO_NOMES.length-1)].split(' ')[0]+' '+SOB[ri(0,SOB.length-1)],telefone:'55489'+ri(10000000,99999999),cpf:et>=2?String(ri(10000000000,99999999999)):null,situacao:sit,grupo:g,etapa:et,motivo,
        margem:et>=3?ri(250,900):null,oferta:of,entrou:e.toISOString(),ultima:new Date(e.getTime()+ri(5,300)*60000).toISOString(),teste:false});}
    vendas.push(dia);}
  return{vendas,jornadas:jornadas.reverse(),crm:crm.reverse()};}
function demoCoerente(o){const B=demoBase,hj=new Date(),soma=(a,k)=>a.reduce((s,x)=>s+x[k],0);
  // hoje vem dos clientes "ao vivo" da demonstração
  const v=B.vendas.map(x=>({...x})),t=v[v.length-1],pgH=o.contratos.filter(c=>c.etapa==='pago'&&c.dt_pagamento&&new Date(c.dt_pagamento).toDateString()===hj.toDateString());
  t.pagos=pgH.length;t.liberado=pgH.reduce((a,c)=>a+c.valor_liberado,0);t.comissao=pgH.reduce((a,c)=>a+c.comissao,0);t.clientes=demoState.entraram;o.vendas=v;
  const SIT={respondeu:['Conversando',1],cpf_ok:['Consultando CPF',2],simulado:['Recebeu a proposta',3],proposta:['Recebeu a proposta',3],negociando:['Recebeu a proposta',3],fechou:['Escolheu oferta · falta PIX',4],link_env:['Link enviado',4],assinou:['Aguardando pagamento',5]};
  const vivos=o.leads.map(l=>{const k=l.aguardando==='humano'?['Com atendente',3]:(SIT[l.status]||['Conversando',1]);return{id:l.id,nome:l.nome,telefone:l.telefone,cpf:k[1]>=2?(l._cpf=l._cpf||String(rnd(10000000000,99999999999))):null,situacao:k[0],grupo:'andamento',etapa:k[1],motivo:null,margem:k[1]>=3?412:null,oferta:k[1]>=4?{valor:l.valor,prazo:46,parcela:Math.round(l.valor/16)}:null,entrou:l.entrou||(l.entrou=new Date(Date.now()-rnd(5,300)*60000).toISOString()),ultima:l.ultima_interacao,teste:false};});
  o.crm=vivos.concat(B.crm);
  o.agentes_dados={agentes:DEMO_AG,jornadas:B.jornadas};
  const lim=Date.now()-30*86400000,C=o.crm.filter(c=>new Date(c.entrou).getTime()>=lim),n=f=>C.filter(f).length;
  o.funil={entraram:C.length,enviaram_cpf:n(c=>c.etapa>=2),com_margem:n(c=>c.etapa>=3),escolheram:n(c=>c.etapa>=4),receberam_proposta:n(c=>c.etapa>=4&&c.situacao!=='Escolheu oferta · falta PIX'),
    assinaram:n(c=>c.grupo==='pago'||c.situacao==='Aguardando pagamento'),pagos:n(c=>c.grupo==='pago'),perdidos:n(c=>c.grupo==='perdido'),motivos_perda:[]};
  const u30=v.slice(-30),pg=soma(u30,'pagos'),lib=soma(u30,'liberado'),com=soma(u30,'comissao'),mes=v.filter(x=>{const d=diaDe(x.dia);return d.getMonth()===hj.getMonth()&&d.getFullYear()===hj.getFullYear();});
  o.simulacao={dias_janela:30,clientes:C.length,pagos:o.funil.pagos,valor_medio:pg?Math.round(lib/pg):0,comissao_media:pg?Math.round(com/pg*100)/100:0,pct_seguro:.7,parcelas_media:46,
    pago_mes_valor:soma(mes,'liberado'),pago_mes_comissao:soma(mes,'comissao'),dias_mes:new Date(hj.getFullYear(),hj.getMonth()+1,0).getDate(),dia_atual:hj.getDate(),meta_dia:7000};
  const fp=o.financeiro.find(f=>f.etapa==='pago');if(fp){fp.contratos=soma(mes,'pagos');fp.valor_liberado=soma(mes,'liberado');fp.comissao=Math.round(soma(mes,'comissao')*100)/100;}
  return o;}

