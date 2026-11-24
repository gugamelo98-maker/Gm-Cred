// ═════════════ CENÁRIO DE CADA SALA ═════════════
function cenaFundo(s){
  const c=CENA[s.id]||{};const tinta=s.cor;
  const janela=c.janela?`<g transform="translate(26,22)"><rect x="16" y="22" width="92" height="78" rx="6" fill="url(#ceu)"/>
      <g fill="#c9d6e6"><rect x="22" y="62" width="12" height="38"/><rect x="36" y="50" width="14" height="50"/><rect x="52" y="70" width="10" height="30"/><rect x="64" y="44" width="16" height="56"/><rect x="82" y="58" width="12" height="42"/><rect x="96" y="66" width="10" height="34"/></g>
      <g fill="#e3ebf5" opacity=".9"><rect x="39" y="56" width="3" height="3"/><rect x="44" y="56" width="3" height="3"/><rect x="68" y="50" width="3" height="3"/><rect x="73" y="50" width="3" height="3"/><rect x="68" y="58" width="3" height="3"/></g>
      <rect x="16" y="22" width="92" height="78" rx="6" fill="none" stroke="#cfd8e3" stroke-width="3"/><line x1="62" y1="22" x2="62" y2="100" stroke="#cfd8e3" stroke-width="2.5"/></g>`:'';
  const quadro=c.quadro?`<g transform="translate(${c.janela?390:60},48)"><rect width="84" height="58" rx="5" fill="#fff" stroke="#d5dde7" stroke-width="2"/>
      ${c.quadro==='graf'?`<rect x="12" y="34" width="9" height="16" rx="2" fill="${tinta}" opacity=".5"/><rect x="26" y="26" width="9" height="24" rx="2" fill="${tinta}" opacity=".7"/><rect x="40" y="18" width="9" height="32" rx="2" fill="${tinta}"/><rect x="54" y="28" width="9" height="22" rx="2" fill="${tinta}" opacity=".6"/><path d="M12 22 L30 16 L44 12 L68 8" stroke="#16a36a" stroke-width="2" fill="none"/>`
      :`<text x="10" y="18" font-size="8" font-weight="700" fill="#5b6878" font-family="Inter">META DO DIA</text><rect x="10" y="26" width="64" height="7" rx="3.5" fill="#eef2f6"/><rect x="10" y="26" width="44" height="7" rx="3.5" fill="${tinta}"/><rect x="10" y="40" width="50" height="4" rx="2" fill="#e3e9f0"/><rect x="10" y="47" width="36" height="4" rx="2" fill="#e3e9f0"/>`}</g>`:'';
  const arquivo=c.arquivo?`<g transform="translate(${c.janela&&c.quadro?300:400},92)"><rect width="40" height="74" rx="4" fill="#cfd8e3"/><rect x="4" y="6" width="32" height="18" rx="2" fill="#e3e9f0"/><rect x="4" y="28" width="32" height="18" rx="2" fill="#e3e9f0"/><rect x="4" y="50" width="32" height="18" rx="2" fill="#e3e9f0"/><rect x="15" y="13" width="10" height="3" rx="1.5" fill="#9aa8b8"/><rect x="15" y="35" width="10" height="3" rx="1.5" fill="#9aa8b8"/><rect x="15" y="57" width="10" height="3" rx="1.5" fill="#9aa8b8"/></g>`:'';
  const planta=c.planta?`<g transform="translate(${c.arquivo?150:420},104)"><path d="M10 40 L30 40 L27 62 L13 62Z" fill="#e8e1d7"/><path d="M20 40 Q4 30 6 10 Q18 22 20 40Z" fill="#3f9b5f"/><path d="M20 40 Q34 26 34 6 Q22 20 20 40Z" fill="#4fb070"/><path d="M20 40 Q16 18 22 0 Q28 18 20 40Z" fill="#2f8a50"/></g>`:'';
  return `<svg class="fundo" viewBox="0 0 520 230" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="ceu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe0ff"/><stop offset="1" stop-color="#eef6ff"/></linearGradient>
    <linearGradient id="parede-${s.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(tinta,90)}" stop-opacity=".22"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs>
    <rect width="520" height="170" fill="url(#parede-${s.id})"/>
    <rect y="160" width="520" height="70" fill="#f1f4f8"/><rect y="160" width="520" height="3" fill="#e2e8ef"/>
    ${janela}${quadro}${arquivo}${planta}
  </svg>`;
}
function mesaSvg(s,ligado){
  return `<svg viewBox="0 0 230 70" preserveAspectRatio="xMidYMax meet" style="width:100%;height:100%">
    <rect x="76" y="0" width="78" height="46" rx="5" fill="#1e2530"/>
    <rect x="80" y="4" width="70" height="38" rx="3" fill="${ligado?'#eaf3ff':'#2a3442'}"/>
    ${ligado?`<rect x="85" y="10" width="34" height="4" rx="2" fill="${s.cor}"/><rect x="85" y="18" width="56" height="3" rx="1.5" fill="#c3d3e8"/><rect x="85" y="24" width="48" height="3" rx="1.5" fill="#c3d3e8"/><rect x="85" y="30" width="52" height="3" rx="1.5" fill="#c3d3e8"/>`:''}
    <rect x="108" y="46" width="14" height="6" fill="#2b3440"/>
    <rect x="4" y="50" width="222" height="10" rx="4" fill="#f7f3ee"/>
    <rect x="4" y="58" width="222" height="12" rx="2" fill="#e4dbd0"/>
    <rect x="24" y="44" width="30" height="6" rx="1.5" fill="#dfe6ee"/><rect x="170" y="38" width="12" height="13" rx="3" fill="#fff" stroke="#d5dde7"/><path d="M182 42 Q187 44 182 47" stroke="#d5dde7" fill="none" stroke-width="1.5"/>
    <rect x="90" y="46" width="50" height="5" rx="2" fill="#cfd8e3"/>
  </svg>`;
}

