/** Bancos (código COMPE) para a digitação: o vendedor escolhe pelo nome e o código vai automático. */
export const BANCOS: [string, string][] = [
  ['001', 'Banco do Brasil'], ['104', 'Caixa Econômica Federal'], ['237', 'Bradesco'], ['341', 'Itaú Unibanco'], ['033', 'Santander'],
  ['260', 'Nubank (Nu Pagamentos)'], ['077', 'Banco Inter'], ['336', 'C6 Bank'], ['290', 'PagBank (PagSeguro)'], ['323', 'Mercado Pago'],
  ['380', 'PicPay'], ['735', 'Neon'], ['212', 'Banco Original'], ['280', 'Will Bank'], ['403', 'Cora'], ['197', 'Stone'], ['461', 'Asaas'],
  ['364', 'Efí (Gerencianet)'], ['332', 'Acesso Soluções de Pagamento'], ['121', 'Agibank'], ['756', 'Sicoob'], ['748', 'Sicredi'],
  ['085', 'Ailos'], ['133', 'Cresol'], ['136', 'Unicred'], ['084', 'Uniprime'], ['097', 'Credisis'], ['041', 'Banrisul'], ['070', 'BRB (Banco de Brasília)'],
  ['004', 'Banco do Nordeste'], ['003', 'Banco da Amazônia'], ['021', 'Banestes'], ['037', 'Banpará'], ['047', 'Banese'], ['389', 'Mercantil do Brasil'],
  ['422', 'Safra'], ['655', 'Banco BV (Votorantim)'], ['623', 'Banco Pan'], ['318', 'Banco BMG'], ['707', 'Daycoval'], ['208', 'BTG Pactual'],
  ['102', 'XP Investimentos'], ['746', 'Modal'], ['637', 'Sofisa'], ['654', 'Digimais'], ['633', 'Rendimento'], ['218', 'Banco BS2'], ['069', 'Crefisa'],
  ['025', 'Banco Alfa'], ['739', 'Cetelem'], ['741', 'Banco Ribeirão Preto'], ['329', 'QI Sociedade de Crédito'], ['274', 'Money Plus (BMP)'],
];
export const nomeBanco = (codigo?: string) => {
  const c = String(codigo ?? '').replace(/\D/g, '');
  return BANCOS.find(([b]) => Number(b) === Number(c))?.[1] ?? '';
};
/** "260 · Nubank (Nu Pagamentos)" */
export const rotuloBanco = ([c, n]: [string, string]) => `${c} · ${n}`;
