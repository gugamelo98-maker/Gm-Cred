// Mídias de exemplo para o modo demonstração, geradas no próprio navegador (nada é baixado de fora).
// As mensagens guardam só o endereço "demo://..." e ele é trocado pelo conteúdo na hora de mostrar.

let audioCache: string | null = null;

/** Áudio WAV curto (um "bip" com variação), no lugar da mensagem de voz do cliente. */
function audioDemo(): string {
  if (audioCache) return audioCache;
  const taxa = 8000, seg = 2.4, n = Math.floor(taxa * seg);
  const buf = new Uint8Array(44 + n);
  const dv = new DataView(buf.buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => (buf[o + i] = c.charCodeAt(0)));
  str(0, 'RIFF'); dv.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, taxa, true); dv.setUint32(28, taxa, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
  str(36, 'data'); dv.setUint32(40, n, true);
  for (let i = 0; i < n; i++) {
    const t = i / taxa;
    const env = Math.min(1, t * 8) * Math.min(1, (seg - t) * 8) * (0.55 + 0.45 * Math.sin(t * 9));
    buf[44 + i] = 128 + Math.round(60 * env * Math.sin(2 * Math.PI * (220 + 60 * Math.sin(t * 3)) * t));
  }
  let bin = '';
  buf.forEach(b => (bin += String.fromCharCode(b)));
  audioCache = 'data:audio/wav;base64,' + btoa(bin);
  return audioCache;
}

const CONTRACHEQUE = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="560" viewBox="0 0 420 560">
<rect width="420" height="560" fill="#f7f5ef"/><rect x="24" y="24" width="372" height="512" fill="#fff" stroke="#d9d4c7"/>
<text x="44" y="64" font-family="Arial" font-size="18" font-weight="bold" fill="#222">DEMONSTRATIVO DE PAGAMENTO</text>
<text x="44" y="88" font-family="Arial" font-size="12" fill="#666">Empresa Exemplo Ltda · Competência 10/2026</text>
${Array.from({ length: 9 }, (_, i) => `<rect x="44" y="${120 + i * 34}" width="${180 + ((i * 37) % 90)}" height="10" fill="#ddd"/><rect x="300" y="${120 + i * 34}" width="76" height="10" fill="#ccc"/>`).join('')}
<line x1="44" y1="440" x2="376" y2="440" stroke="#999"/>
<text x="44" y="470" font-family="Arial" font-size="14" fill="#222">Líquido a receber</text>
<text x="376" y="470" font-family="Arial" font-size="16" font-weight="bold" fill="#222" text-anchor="end">R$ 2.184,37</text>
<text x="210" y="515" font-family="Arial" font-size="11" fill="#aaa" text-anchor="middle">IMAGEM DE DEMONSTRAÇÃO</text></svg>`;

/** PDF mínimo válido de uma página. */
function pdfDemo(): string {
  const conteudo = 'BT /F1 18 Tf 60 760 Td (Comprovante de residencia) Tj 0 -30 Td /F1 12 Tf (Documento de demonstracao - GM Cred) Tj ET';
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const pos: number[] = [];
  objs.forEach((o, i) => { pos.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + pos.map(p => String(p).padStart(10, '0') + ' 00000 n \n').join('');
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return 'data:application/pdf;base64,' + btoa(pdf);
}

export function resolverMidia(url: string): string {
  if (url === 'demo://audio') return audioDemo();
  if (url === 'demo://contracheque') return 'data:image/svg+xml;utf8,' + encodeURIComponent(CONTRACHEQUE);
  if (url === 'demo://comprovante') return pdfDemo();
  return url;
}
