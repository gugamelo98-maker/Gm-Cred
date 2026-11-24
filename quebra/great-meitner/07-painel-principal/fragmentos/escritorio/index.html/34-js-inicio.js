// ═════════════ INÍCIO ═════════════
// consulta 1x por minuto; pausa quando a aba está escondida e atualiza na hora quando ela volta
let timer=null;
function agendar(){clearTimeout(timer);if(document.hidden)return;timer=setTimeout(async()=>{await atualizar();agendar();},demo?DEMO_MS:POLL_MS);}
document.addEventListener('visibilitychange',()=>{if(!document.hidden){atualizar();}agendar();});
const TELAS=['escritorio','hoje','clientes','conversas','campanha','numeros','maturador','mes','funil','agentes','financeiro','simulacao'];
let telaAtual=TELAS.find(t=>location.hash==='#tela-'+t)||'hoje';
// menu em grupos: WhatsApp reúne Campanha, Números e Maturador; no celular, Análise fica em "Mais"
const GRUPO_WPP=['campanha','numeros','maturador'],ANALISE=['hoje','mes','funil','agentes','financeiro','simulacao'];
let ultimaWpp=lsGet('escritorio_wpp');if(!GRUPO_WPP.includes(ultimaWpp))ultimaWpp='numeros';
function abrirMais(){document.getElementById('maisVeu').classList.add('on');}
function fecharMais(){document.getElementById('maisVeu').classList.remove('on');}
document.addEventListener('keydown',e=>{if(e.key==='Escape')fecharMais();});
function irPara(v){telaAtual=TELAS.includes(v)?v:'escritorio';lsSet('escritorio_tela',telaAtual);try{history.replaceState(null,'','#tela-'+telaAtual);}catch(e){}
  TELAS.forEach(t=>{document.getElementById('v-'+t).hidden=telaAtual!==t;});
  const ehWpp=GRUPO_WPP.includes(telaAtual);if(ehWpp){ultimaWpp=telaAtual;lsSet('escritorio_wpp',telaAtual);}
  document.getElementById('wppTabs').hidden=!ehWpp;
  document.querySelectorAll('.wseg button').forEach(b=>{const on=b.dataset.w===telaAtual;b.classList.toggle('on',on);b.setAttribute('aria-selected',on);});
  document.querySelectorAll('.mais-grid [data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===telaAtual));
  document.querySelectorAll('.nv').forEach(b=>{const on=b.dataset.v===telaAtual||(b.dataset.v==='whatsapp'&&ehWpp)||(b.dataset.v==='mais'&&ANALISE.includes(telaAtual));b.classList.toggle('on',on);b.setAttribute('aria-current',on?'page':'false');});
  fecharMais();
  window.scrollTo(0,0);if(telaAtual==='escritorio')setTimeout(posicionarClientes,30);if(telaAtual==='mes')setTimeout(renderVendas,30);if(telaAtual==='clientes')renderCrm();if(telaAtual==='agentes')renderAgentes();if(!demo&&chave&&faltaParte())atualizar();if(telaAtual==='financeiro')finCarregar();if(telaAtual==='campanha')cpCarregar();cvLigar(telaAtual==='conversas');nmLigar(telaAtual==='numeros'||telaAtual==='maturador');}
irPara(telaAtual);
atualizar();agendar();
</script>
