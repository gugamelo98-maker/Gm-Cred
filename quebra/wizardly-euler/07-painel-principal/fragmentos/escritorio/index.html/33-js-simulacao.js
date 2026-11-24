// ═════════════ SIMULAÇÃO ═════════════
const SIM_EXEMPLO={cli:20,conv:11,val:2500,seg:50,parc:46,dias:22};
const SIM_CAMPOS=[['cli','Clientes novos por dia',1,300,1,''],['conv','Viram contrato pago',0.5,40,0.5,'%'],['val','Valor médio liberado',300,25000,100,'R$'],['seg','Vendidos com seguro',0,100,5,'%']];
const SIM_AV=[['dias','Dias de operação no mês',1,31,1,'']];
let simVals=(()=>{try{const v=JSON.parse(lsGet('escritorio_sim')||'null');return v&&typeof v==='object'?{...SIM_EXEMPLO,...v}:{...SIM_EXEMPLO};}catch(e){return{...SIM_EXEMPLO};}})();
let simOrigem=lsGet('escritorio_sim_origem')||'exemplo',simMontado=false,simAuto=false;
function pctTabela(seg,p){if(seg)return p>=46?9.5:p>=24?7:p===18?4.5:p===12?4.01:3.01;return p>=24?3.01:p>=12?2.01:1.01;}
function div(a,b){a=Number(a||0);b=Number(b||0);return b>0?a/b:0;}
function dadosReais(){const F=(estado.funil&&!Array.isArray(estado.funil))?estado.funil:{},S=estado.simulacao||{};
  return{F,S,temAlgo:Number(F.entraram||0)>0&&Number(F.pagos||S.pagos||0)>0,poucos:Number(F.entraram||0)<50||Number(F.pagos||S.pagos||0)<5};}
function renderSimulacao(){
  const {temAlgo}=dadosReais(),el=document.getElementById('simPrev'),P=projecaoMes(),bate=P.projLib>=P.metaMes;
  el.innerHTML=`<div class="fbox"><h4>🔮 Projeção do mês</h4>${P.vazio
    ?`<div class="vazio">Ainda sem vendas este mês. A projeção aparece com os primeiros contratos pagos. Enquanto isso, use o simulador abaixo.</div>`
    :`<div class="sim-cards">
      <div class="sc"><span>Liberado até hoje</span><b>${brlFull(P.realLib)}</b><small>${P.realPag} contratos pagos em ${P.diaN} dias</small></div>
      <div class="sc ${bate?'ok':'ruim'}"><span>Fecha o mês em</span><b>${brlFull(P.projLib)}</b><small>${bate?'✅ bate a':'❌ abaixo da'} meta do mês (${brl(P.metaMes)}), no ritmo dos últimos 7 dias</small></div>
      <div class="sc"><span>Comissão no mês</span><b>${brlFull(P.projCom)}</b><small>projetada · ${brlFull(P.realCom)} já recebida</small></div></div>`}</div>`;
  const bt=document.getElementById('btReais');bt.hidden=!temAlgo;
  if(!simMontado){montarSim();syncSim();}
  if(temAlgo&&!simAuto&&simOrigem!=='ajustado'){simAuto=true;simUsarReais();return;}
  calcSim();
}
function campoSim([k,n,mi,ma,st]){return `<div class="campo"><label for="s_${k}">${n}<b id="v_${k}"></b></label><input type="range" id="s_${k}" min="${mi}" max="${ma}" step="${st}" value="${simVals[k]}" oninput="simVals['${k}']=Number(this.value);simOrigem='ajustado';calcSim()"></div>`;}
function montarSim(){simMontado=true;
  document.getElementById('simCampos').innerHTML=SIM_CAMPOS.map(campoSim).join('');
  document.getElementById('simAv').innerHTML=SIM_AV.map(campoSim).join('')
   +`<div class="campo"><label for="s_parc">Prazo mais vendido</label><select id="s_parc" onchange="simVals.parc=Number(this.value);simOrigem='ajustado';calcSim()">${[6,8,10,12,18,24,36,38,46].map(x=>`<option value="${x}">${x} parcelas</option>`).join('')}</select></div>`;}
function syncSim(){[...SIM_CAMPOS,...SIM_AV].forEach(([k])=>{const i=document.getElementById('s_'+k);if(i&&Number(i.value)!==simVals[k])i.value=simVals[k];});const sp=document.getElementById('s_parc');if(sp)sp.value=String(simVals.parc);}
function calcSim(){const v=simVals;
  [...SIM_CAMPOS,...SIM_AV].forEach(([k,,,,,u])=>{const e=document.getElementById('v_'+k);if(e)e.textContent=u==='R$'?brlFull(v[k]):String(v[k]).replace('.',',')+(u||'');});
  const taxa=v.conv/100,pagosDia=v.cli*taxa,libDia=pagosDia*v.val;
  const pctC=(v.seg/100)*pctTabela(true,v.parc)+(1-v.seg/100)*pctTabela(false,v.parc),comCt=v.val*pctC/100;
  const meta=metaDia(),nec=taxa*v.val>0?Math.ceil(meta/(taxa*v.val)):0,bate=libDia>=meta;
  const {poucos}=dadosReais();
  document.getElementById('simOrigem').textContent=simOrigem==='reais'?(poucos?'(Começa com os seus números reais, mas ainda são poucos dados: podem variar bastante.)':'(Começa com os seus números reais dos últimos 30 dias.)'):simOrigem==='exemplo'?'(Valores de exemplo.)':'';
  document.getElementById('simRes').innerHTML=`
    <div class="sc"><span>Contratos pagos no mês</span><b>${Math.round(pagosDia*v.dias)}</b><small>${pagosDia.toFixed(1).replace('.',',')} por dia · ${brlFull(libDia*v.dias)} liberados</small></div>
    <div class="sc ok"><span>Comissão no mês</span><b>${brlFull(comCt*pagosDia*v.dias)}</b><small>${brlFull(comCt)} por contrato (${pctC.toFixed(2).replace('.',',')}%)</small></div>
    <div class="sc ${bate?'ok':'ruim'}"><span>Meta de ${brl(meta)} por dia</span><b>${bate?'✅ Bate':(nec||'—')+' clientes/dia'}</b><small>${bate?brlFull(libDia)+' liberados por dia':'é o que precisa entrar por dia para bater (hoje: '+v.cli+')'}</small></div>`;
  lsSet('escritorio_sim',JSON.stringify(simVals));lsSet('escritorio_sim_origem',simOrigem);}
function simExemplo(){simVals={...SIM_EXEMPLO};simOrigem='exemplo';syncSim();calcSim();}
function simUsarReais(){const {F,S}=dadosReais();if(!(Number(F.entraram||0)>0))return;
  const conv=Math.max(.5,Math.min(40,Math.round(div(F.pagos||S.pagos,F.entraram)*200)/2));
  const parc=[6,8,10,12,18,24,36,38,46].reduce((a,b)=>Math.abs(b-Number(S.parcelas_media||46))<Math.abs(a-Number(S.parcelas_media||46))?b:a,46);
  simVals={...simVals,cli:Math.max(1,Math.round(div(F.entraram,S.dias_janela||30))),conv,
    val:Math.max(300,Math.round(Number(S.valor_medio||simVals.val)/100)*100),seg:Math.round(Number(S.pct_seguro!=null?S.pct_seguro:simVals.seg/100)*20)*5,parc};
  simOrigem='reais';syncSim();calcSim();}

