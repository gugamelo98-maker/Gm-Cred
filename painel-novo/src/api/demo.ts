// Implementação de DEMONSTRAÇÃO da Api: dados fictícios, guardados só neste navegador.
// Não fala com nenhum servidor, não manda mensagem e não consulta banco de verdade.
import type { Api } from './contrato';
import type {
  Anexo, Banco, Cliente, Disparo, Estado, Etapa, Gasto, Indicador, Mensagem, Numero, Oferta, Origem, ResultadoBanco, Usuario, RespostaPronta, TipoMidia,
} from './tipos';
import { soDigitos, validaCpf } from '@/util/formato';
import { resolverMidia } from './demo-midia';

const CHAVE = 'gm_painel_demo_v2';
const CHAVE_CONVERSAS = 'gm_painel_demo_conversas_v2';
const DIA = 86400000;

// gerador pseudoaleatório com semente, para os dados de demonstração serem sempre os mesmos
function rng(semente: number) {
  let a = semente >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const id = () => Math.random().toString(36).slice(2, 10);
const iso = (ms: number) => new Date(ms).toISOString();

const NOMES = ['Maria', 'José', 'Ana', 'João', 'Francisca', 'Antônio', 'Adriana', 'Carlos', 'Juliana', 'Paulo', 'Márcia', 'Lucas', 'Aline', 'Pedro', 'Sandra', 'Rafael', 'Patrícia', 'Marcos', 'Fernanda', 'Luiz', 'Camila', 'Bruno', 'Daniela', 'Diego', 'Vanessa', 'Thiago', 'Luciana', 'Rodrigo', 'Simone', 'Felipe'];
const SOBRENOMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes', 'Soares', 'Vieira'];

function cpfValido(r: () => number): string {
  const n = Array.from({ length: 9 }, () => Math.floor(r() * 10));
  for (const pesoIni of [10, 11]) {
    const s = n.reduce((acc, d, i) => acc + d * (pesoIni - i), 0);
    const dv = (s * 10) % 11 % 10;
    n.push(dv);
  }
  return n.join('');
}

function gerar(): Estado {
  const r = rng(20261124);
  const agora = Date.now();
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];

  const usuarios: Usuario[] = [
    { id: 'u1', escopo: 'todos', nome: 'Dono', email: 'dono@gmcred.com.br', papel: 'admin', ativo: true, ultimoAcesso: iso(agora - 3600e3) },
    { id: 'u2', escopo: 'todos', nome: 'Larissa', email: 'larissa@gmcred.com.br', papel: 'gestor', ativo: true, ultimoAcesso: iso(agora - 2 * DIA) },
    { id: 'u3', escopo: 'proprios', nome: 'Bianca', email: 'bianca@gmcred.com.br', papel: 'atendente', ativo: true, ultimoAcesso: iso(agora - 5 * 3600e3) },
    { id: 'u4', escopo: 'proprios', nome: 'Rafael', email: 'rafael@gmcred.com.br', papel: 'atendente', ativo: false, ultimoAcesso: iso(agora - 20 * DIA) },
  ];

  const numeros: Numero[] = [
    { sessao: 'gmcred-campanha', telefone: '5548900000001', funcao: 'atendimento', estado: 'conectado', aparelho: 'Moto G (escritório)' },
    { sessao: 'gmcred-2', telefone: '5548900000002', funcao: 'disparo', estado: 'conectado', aparelho: 'Samsung A15' },
    { sessao: 'gmcred-3', telefone: '5548900000003', funcao: 'disparo', estado: 'conectado', aparelho: 'Samsung A15' },
    { sessao: 'gmcred-4', telefone: '5548900000004', funcao: 'disparo', estado: 'caiu', aparelho: 'Redmi 13C' },
    { sessao: 'gmcred-5', telefone: '5548900000005', funcao: 'reserva', estado: 'conectado', aparelho: 'Redmi 13C' },
    { sessao: 'gmcred-6', telefone: '', funcao: 'disparo', estado: 'aguardando_qr', aparelho: 'Chip novo' },
  ].map((n, i) => ({
    id: 'n' + (i + 1), nomePerfil: 'Ana Gm Cred', maturar: i > 0 && i < 5, ...n, funcao: n.funcao as Numero['funcao'], estado: n.estado as Numero['estado'],
    enviadasHoje: n.estado === 'conectado' ? Math.floor(r() * 180) : 0, entreguesHoje: 0, falhasHoje: n.estado === 'caiu' ? 7 : Math.floor(r() * 3),
    travaAte: i === 3 ? iso(agora + 5 * 3600e3) : null, conectadoDesde: n.estado === 'conectado' ? iso(agora - Math.floor(r() * 20) * DIA) : null,
  }));
  numeros.forEach(n => (n.entreguesHoje = Math.floor(n.enviadasHoje * 0.93)));

  const disparos: Disparo[] = [
    ['Base CLT novembro · lista 1', 'encerrado', 22], ['Base CLT novembro · lista 2', 'ativo', 9], ['Com margem · repescagem', 'pausado', 4], ['Base FGTS aniversariantes', 'rascunho', 1],
  ].map(([nome, status, dias], i) => {
    const contatos = status === 'rascunho' ? 0 : 900 + Math.floor(r() * 1500);
    const enviadas = status === 'encerrado' ? contatos : status === 'rascunho' ? 0 : Math.floor(contatos * (0.3 + r() * 0.4));
    const entregues = Math.floor(enviadas * 0.94), responderam = Math.floor(entregues * (0.08 + r() * 0.06));
    return {
      id: 'd' + (i + 1), nome: nome as string, status: status as Disparo['status'], numeros: ['n2', 'n3', 'n4'].slice(0, 2 + (i % 2)),
      mensagens: [{ texto: 'Oi {nome}, tudo bem? Aqui é a Ana da GM Cred. Consta no seu CPF uma margem de até {margem} para empréstimo CLT. Quer que eu simule pra você?', variacoes: ['Olá {nome}! Sou a Ana, da GM Cred. Vi que você tem margem de até {margem} no consignado CLT. Posso simular?'], rodape: 'GM Cred', botoes: [{ tipo: 'resposta', texto: 'Quero simular' }, { tipo: 'resposta', texto: 'BLOQUEAR' }] }],
      intervaloSeg: 45, horaInicio: 8, horaFim: 22, criadoEm: iso(agora - (dias as number) * DIA), contatos, naFila: contatos - enviadas,
      enviadas, entregues, responderam, mandaramCpf: Math.floor(responderam * 0.55), bloquearam: Math.floor(entregues * 0.01),
    };
  });

  const indicadores: Indicador[] = ['Claudete Ramos', 'Jefferson Luz', 'Rosana Pires', 'Edson Melo', 'Tainá Rocha'].map((nome, i) => {
    const indicacoes = 2 + Math.floor(r() * 12), fechadas = Math.floor(indicacoes * r() * 0.6);
    return { id: 'i' + (i + 1), nome, telefone: '5548900001' + String(100 + i), codigo: nome.split(' ')[0].toUpperCase() + (10 + i), pix: nome.split(' ')[0].toLowerCase() + '@email.com', indicacoes, fechadas, premio: 50, pago: Math.floor(fechadas * r()) * 50 };
  });

  // clientes: últimos 45 dias, com o funil tirado de proporções parecidas com as reais
  const clientes: Cliente[] = [];
  for (let i = 0; i < 260; i++) {
    const diasAtras = Math.floor(Math.pow(r(), 1.4) * 45);
    const entrou = agora - diasAtras * DIA - Math.floor(r() * 12) * 3600e3;
    const origem: Origem = (() => { const x = r(); return x < 0.56 ? 'disparo' : x < 0.85 ? 'trafego' : x < 0.95 ? 'indicacao' : 'organico'; })();
    const produto = r() < 0.82 ? 'CLT' : 'FGTS';
    const mandouCpf = r() < 0.6, temMargem = mandouCpf && r() < 0.55, proposta = temMargem && r() < 0.62, pago = proposta && r() < 0.5 && diasAtras > 1;
    const t = (h: number) => iso(entrou + h * 3600e3);
    const banco: Banco = pick(['V8', 'V8', 'Unno', 'HUB']);
    const margem = temMargem ? 150 + Math.floor(r() * 700) : null;
    const prazo = proposta ? pick([24, 36, 48]) : null;
    const valor = proposta && margem && prazo ? Math.round(margem * prazo * 0.62) : null;
    let etapa: Etapa = pago ? 'posvenda' : proposta ? 'formalizacao' : temMargem ? 'vendas' : mandouCpf ? 'simulacao' : 'recepcao';
    let situacao = { posvenda: 'Pago', formalizacao: 'Aguardando assinatura', vendas: 'Recebeu as ofertas', simulacao: 'Simulando', recepcao: 'Respondeu, sem CPF', perdido: '' }[etapa];
    let etiqueta: string | null = null;
    if (!pago && diasAtras > 3 && r() < (mandouCpf && !temMargem ? 0.85 : 0.45)) {
      etapa = 'perdido';
      etiqueta = mandouCpf && !temMargem ? 'Sem margem' : pick(['Não respondeu', 'Não quis', 'Achou a parcela alta', 'Sem WhatsApp']);
      situacao = 'Finalizado · ' + etiqueta;
    }
    const nome = `${pick(NOMES)} ${pick(SOBRENOMES)}`;
    const ultima = Math.min(agora - 60e3, entrou + (proposta ? 30 : 3) * 3600e3 * r() + 60e3);
    clientes.push({
      id: 'c' + (i + 1), nome, telefone: '55' + pick(['48', '11', '21', '31', '41', '51']) + '90000' + String(1000 + Math.floor(r() * 8999)),
      cpf: mandouCpf ? cpfValido(r) : null, produto, origem, origemRef: origem === 'disparo' ? pick(disparos.slice(0, 3)).id : origem === 'indicacao' ? pick(indicadores).id : null,
      etapa, situacao, etiqueta, margem, banco: temMargem ? banco : null, valorLiberado: valor, parcela: proposta ? margem : null, prazo,
      comissao: pago && valor ? Math.round(valor * (banco === 'V8' ? 0.06 : 0.055)) : null,
      ...(() => { const comBianca = r() < 0.12 && etapa !== 'perdido'; return { atendente: comBianca ? 'u3' : 'ia', responsavel: comBianca || r() < 0.3 ? 'u3' : null }; })(), numeroId: 'n1', naoLidas: etapa !== 'perdido' && r() < 0.15 ? 1 + Math.floor(r() * 3) : 0,
      entrouEm: iso(entrou), cpfEm: mandouCpf ? t(0.3 + r()) : null, margemEm: temMargem ? t(1.5) : null, propostaEm: proposta ? t(2 + r() * 10) : null, pagoEm: pago ? t(24 + r() * 40) : null,
      ultimaMsgEm: iso(ultima), historico: [{ em: iso(entrou), de: null, para: 'recepcao', por: 'ia' }],
    });
  }
  clientes.sort((a, b) => b.ultimaMsgEm.localeCompare(a.ultimaMsgEm));

  const gastos: Gasto[] = [];
  for (let m = 0; m < 2; m++) {
    const base = new Date(); base.setMonth(base.getMonth() - m, 1);
    const d = (dia: number) => { const x = new Date(base); x.setDate(dia); return x.toISOString().slice(0, 10); };
    gastos.push(
      { id: id(), data: d(2), categoria: 'numeros', descricao: '6 chips + recargas', valor: 180 },
      { id: id(), data: d(3), categoria: 'trafego', descricao: 'Meta Ads · CLT', valor: 1500 + m * 300 },
      { id: id(), data: d(5), categoria: 'bms', descricao: 'BM verificada', valor: 250 },
      { id: id(), data: d(8), categoria: 'disparos', descricao: 'Servidor Baileys (VPS)', valor: 89 },
      { id: id(), data: d(10), categoria: 'equipe', descricao: 'Atendente (meio período)', valor: 1200 },
      { id: id(), data: d(15), categoria: 'trafego', descricao: 'Meta Ads · FGTS', valor: 600 },
      { id: id(), data: d(20), categoria: 'outros', descricao: 'OpenRouter (IA)', valor: 140 },
    );
  }

  return {
    clientes, numeros, disparos, indicadores, gastos, usuarios,
    respostas: [
      { id: 'r1', atalho: 'cpf', titulo: 'Pedir CPF', texto: 'Oi {nome}! Pra eu ver quanto você consegue liberar, me manda o seu CPF, por favor?' },
      { id: 'r2', atalho: 'documentos', titulo: 'Pedir documentos', texto: '{nome}, pra seguir preciso de uma foto do seu documento com foto (RG ou CNH) e do último contracheque.' },
      { id: 'r3', atalho: 'pix', titulo: 'Chave PIX', texto: 'Qual é a sua chave PIX? Ela precisa estar no seu nome (CPF, celular ou e-mail).' },
      { id: 'r4', atalho: 'assinatura', titulo: 'Lembrete de assinatura', texto: '{nome}, falta só assinar o contrato pelo link que te mandei. Leva menos de 2 minutinhos! Qualquer dúvida estou aqui.' },
      { id: 'r5', atalho: 'retorno', titulo: 'Retornar depois', texto: 'Combinado, {nome}! Te chamo mais tarde para finalizarmos.' },
    ],
    maturador: { ativo: true, intervaloMin: 8, horaInicio: 8, horaFim: 21, ultimas: Array.from({ length: 6 }, (_, i) => ({ em: iso(agora - i * 8 * 60e3), de: 'gmcred-' + (2 + (i % 3)), para: 'gmcred-' + (2 + ((i + 1) % 3)), texto: pick(['Bom dia! Tudo certo por aí?', 'Vou passar aí mais tarde', 'kkkk verdade', 'Me manda aquela foto depois', 'Ok, combinado 👍']) })) },
  };
}

function carregar(): Estado {
  try {
    const s = localStorage.getItem(CHAVE);
    if (s) return JSON.parse(s);
  } catch { /* sem armazenamento: usa dados novos */ }
  return gerar();
}

let db: Estado = carregar();
function gravar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(db)); } catch { /* ignora */ }
}
export function resetarDemo() {
  try { localStorage.removeItem(CHAVE); localStorage.removeItem(CHAVE_CONVERSAS); } catch { /* ignora */ }
  db = gerar();
  conversas.clear();
}

const espera = (ms = 250) => new Promise(r => setTimeout(r, ms));
const copia = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
function achar<T extends { id: string }>(xs: T[], i: string): T {
  const x = xs.find(y => y.id === i);
  if (!x) throw new Error('Não encontrado: ' + i);
  return x;
}

// conversas fictícias: geradas na primeira vez que abrem e guardadas neste navegador
const conversas = new Map<string, Mensagem[]>((() => {
  try { return JSON.parse(localStorage.getItem(CHAVE_CONVERSAS) || '[]'); } catch { return []; }
})());
function gravarConversas() {
  try { localStorage.setItem(CHAVE_CONVERSAS, JSON.stringify([...conversas])); }
  catch { /* sem espaço (mídias grandes): continua só na memória até recarregar */ }
}
const midiaDemo = (tipo: TipoMidia, url: string, nome: string, mime: string, tamanho: number, extra: { duracaoSeg?: number; voz?: boolean } = {}) => ({ tipo, url, nome, mime, tamanho, ...extra });
function conversaDe(c: Cliente): Mensagem[] {
  const pronta = conversas.get(c.id);
  if (pronta) return pronta;
  const base = new Date(c.entrouEm).getTime();
  const sorte = Number(c.id.replace(/\D/g, '')) % 5;
  const m = (de: Mensagem['de'], texto: string, min: number, midia: Mensagem['midia'] = null): Mensagem => ({ id: id(), clienteId: c.id, de, autor: null, texto, midia, em: iso(base + min * 60e3), status: de === 'cliente' ? null : 'lida' });
  const L: Mensagem[] = [m('cliente', c.origem === 'disparo' ? 'Quero simular' : 'Olá! Vi o anúncio do empréstimo', 0), m('ia', `Oi ${c.nome.split(' ')[0]}, aqui é a Ana da GM Cred! Pra eu ver quanto você consegue, me manda o seu CPF?`, 1)];
  if (c.cpf) L.push(m('cliente', c.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'), 15), m('ia', 'Obrigada! Já estou consultando, só um minutinho 😉', 16));
  if (c.cpf && !c.margem) L.push(m('ia', 'Consultei aqui e, por enquanto, não apareceu margem disponível no seu CPF. Assim que liberar eu te aviso, combinado?', 20));
  if (c.cpf && sorte < 2) L.push(m('cliente', '', 17, midiaDemo('audio', 'demo://audio', 'audio.ogg', 'audio/ogg', 21000, { duracaoSeg: 2, voz: true })));
  if (c.margem) L.push(m('ia', `Boa notícia! Você tem margem de R$ ${c.margem.toFixed(2).replace('.', ',')} por mês. Qual parcela cabe no seu bolso?`, 20), m('cliente', 'Quanto consigo em 36x?', 40));
  if (c.valorLiberado) L.push(m('ia', `Em ${c.prazo}x de R$ ${(c.parcela ?? 0).toFixed(2).replace('.', ',')} você recebe R$ ${c.valorLiberado.toLocaleString('pt-BR')} no PIX. Quer seguir?`, 42), m('cliente', 'Quero sim', 60));
  if (c.propostaEm) L.push(
    m('cliente', 'Segue meu contracheque', 70, midiaDemo('imagem', 'demo://contracheque', 'contracheque.jpg', 'image/svg+xml', 48000)),
    ...(sorte % 2 ? [m('cliente', '', 72, midiaDemo('documento', 'demo://comprovante', 'comprovante-residencia.pdf', 'application/pdf', 1100))] : []),
  );
  if (c.pagoEm) L.push(m('ia', 'Pronto! O valor caiu na sua conta. Qualquer coisa estou por aqui 💙', 60 * 30));
  if (c.naoLidas) L.push(m('cliente', 'Oi, alguém aí?', (new Date(c.ultimaMsgEm).getTime() - base) / 60e3));
  conversas.set(c.id, L);
  gravarConversas();
  return L;
}
/** troca os endereços demo:// pelo conteúdo antes de entregar para a tela */
const comMidia = (ms: Mensagem[]) => ms.map(x => (x.midia ? { ...x, midia: { ...x.midia, url: resolverMidia(x.midia.url) } } : x));
function tipoDoMime(mime: string): TipoMidia {
  return mime.startsWith('image/') ? 'imagem' : mime.startsWith('audio/') ? 'audio' : mime.startsWith('video/') ? 'video' : 'documento';
}

function fatorPrazo(prazo: number, taxa: number) {
  return (1 - Math.pow(1 + taxa, -prazo)) / taxa; // valor presente de uma parcela de R$ 1
}
function ofertasPara(margem: number, banco: Banco, parcela: number | null, prazoFix: number | null): Oferta[] {
  const prazos = prazoFix ? [prazoFix] : banco === 'HUB' ? [24, 36] : [12, 24, 36, 48];
  const p = Math.min(parcela ?? margem, margem);
  return prazos.flatMap(prazo => [true, false].map(comSeguro => {
    const taxaMes = (banco === 'V8' ? 0.042 : banco === 'Unno' ? 0.039 : 0.045) + (comSeguro ? 0 : 0.004);
    return { prazo, parcela: p, valorLiberado: Math.round(p * fatorPrazo(prazo, taxaMes) * (comSeguro ? 0.94 : 1)), taxaMes, comSeguro, comissaoPct: (banco === 'V8' ? 6 : banco === 'Unno' ? 5.5 : 7) + (comSeguro ? 1.5 : 0) };
  }));
}

function motor(cpf: string, parcela: number | null, prazo: number | null, bancos: Banco[]): ResultadoBanco[] {
  const d = soDigitos(cpf);
  const semente = Number(d.slice(-4));
  return bancos.map(banco => {
    const r = rng(semente + banco.length * 97);
    const x = r();
    if (banco === 'HUB' && x < 0.25) return { banco, status: 'precisa_dados', mensagem: 'A HUB pede sexo e cidade para este CPF.', margem: null, ofertas: [] };
    if (x < 0.2) return { banco, status: 'sem_margem', mensagem: 'Sem margem disponível.', margem: null, ofertas: [] };
    if (x > 0.95) return { banco, status: 'erro', mensagem: 'O banco não respondeu. Tente de novo.', margem: null, ofertas: [] };
    const margem = Math.round(180 + r() * 650);
    return { banco, status: 'ok', mensagem: 'Margem encontrada.', margem, ofertas: ofertasPara(margem, banco, parcela, prazo) };
  });
}

export const demoApi: Api = {
  async entrar(email) {
    await espera();
    const u = db.usuarios.find(x => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u) throw new Error('Usuário não encontrado.');
    if (!u.ativo) throw new Error('Este usuário está desativado.');
    u.ultimoAcesso = new Date().toISOString(); gravar();
    return copia(u);
  },
  async estado() { await espera(150); return copia(db); },

  async moverCliente(cid, para, por) {
    await espera(120);
    const c = achar(db.clientes, cid);
    if (c.etapa !== para) {
      c.historico.push({ em: new Date().toISOString(), de: c.etapa, para, por });
      c.etapa = para;
      c.situacao = para === 'perdido' ? 'Finalizado pelo painel' : 'Movido pelo painel';
      if (para === 'posvenda' && !c.pagoEm) c.pagoEm = new Date().toISOString();
      gravar();
    }
    return copia(c);
  },
  async salvarCliente(p) { await espera(); const c = achar(db.clientes, p.id); Object.assign(c, p); gravar(); return copia(c); },

  async mensagens(cid) { await espera(150); return comMidia(copia(conversaDe(achar(db.clientes, cid)))); },
  async enviarMensagem(cid, texto, autor) {
    await espera(300);
    const c = achar(db.clientes, cid);
    const msg: Mensagem = { id: id(), clienteId: cid, de: 'humano', autor, texto, midia: null, em: new Date().toISOString(), status: 'entregue' };
    conversaDe(c).push(msg); gravarConversas();
    c.ultimaMsgEm = msg.em; gravar();
    return copia(msg);
  },
  async enviarMidia(cid, anexo: Anexo, texto, autor) {
    await espera(500);
    if (anexo.tamanho > 16 * 1024 * 1024) throw new Error('Arquivo maior que 16 MB: o WhatsApp não aceita.');
    const c = achar(db.clientes, cid);
    const msg: Mensagem = {
      id: id(), clienteId: cid, de: 'humano', autor, texto, em: new Date().toISOString(), status: 'entregue',
      midia: { tipo: tipoDoMime(anexo.mime), url: anexo.dados, nome: anexo.nome, mime: anexo.mime, tamanho: anexo.tamanho, duracaoSeg: anexo.duracaoSeg, voz: anexo.voz },
    };
    conversaDe(c).push(msg); gravarConversas();
    c.ultimaMsgEm = msg.em; gravar();
    return copia(msg);
  },
  async adicionarNota(cid, texto, autor) {
    await espera(200);
    const c = achar(db.clientes, cid);
    const msg: Mensagem = { id: id(), clienteId: cid, de: 'nota', autor, texto, midia: null, em: new Date().toISOString(), status: null };
    conversaDe(c).push(msg); gravarConversas();
    return copia(msg);
  },
  async definirResponsavel(cid, responsavel) { await espera(); const c = achar(db.clientes, cid); c.responsavel = responsavel; gravar(); return copia(c); },
  async salvarResposta(p) {
    await espera();
    const atalho = (p.atalho ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (p.atalho !== undefined && !atalho) throw new Error('O atalho precisa ter letras ou números.');
    if (atalho && db.respostas.some(r => r.atalho === atalho && r.id !== p.id)) throw new Error(`Já existe a resposta /${atalho}.`);
    if (p.id) { const r = achar(db.respostas, p.id); Object.assign(r, p, atalho ? { atalho } : {}); gravar(); return copia(r); }
    const r: RespostaPronta = { id: 'r' + id(), titulo: '', texto: '', ...p, atalho } as RespostaPronta;
    db.respostas.push(r); gravar(); return copia(r);
  },
  async apagarResposta(rid) { await espera(); db.respostas = db.respostas.filter(r => r.id !== rid); gravar(); },
  async assumirConversa(cid, atendente) {
    await espera(); const c = achar(db.clientes, cid);
    c.atendente = atendente;
    if (atendente !== 'ia' && !c.responsavel) c.responsavel = atendente;
    gravar(); return copia(c);
  },
  async finalizarConversa(cid, motivo, por) {
    await espera(); const c = achar(db.clientes, cid);
    c.historico.push({ em: new Date().toISOString(), de: c.etapa, para: 'perdido', por });
    c.etapa = 'perdido'; c.etiqueta = motivo; c.situacao = 'Finalizado · ' + motivo; c.atendente = 'ia'; c.naoLidas = 0; gravar();
    return copia(c);
  },
  async marcarLida(cid) { const c = achar(db.clientes, cid); c.naoLidas = 0; gravar(); },

  async consultarCpf(cpf) {
    await espera(900);
    if (!validaCpf(cpf)) throw new Error('CPF inválido.');
    return motor(cpf, null, null, ['V8', 'Unno', 'HUB']);
  },
  async simular(cpf, parcela, prazo, bancos) { await espera(700); return motor(cpf, parcela, prazo, bancos); },

  async salvarNumero(p) { await espera(); const n = achar(db.numeros, p.id); Object.assign(n, p); gravar(); return copia(n); },
  async novoNumero(sessao, funcao) {
    await espera();
    const n: Numero = { id: 'n' + id(), sessao, telefone: '', nomePerfil: 'Ana Gm Cred', funcao, estado: 'aguardando_qr', aparelho: 'Chip novo', enviadasHoje: 0, entreguesHoje: 0, falhasHoje: 0, maturar: false, travaAte: null, conectadoDesde: null };
    db.numeros.push(n); gravar(); return copia(n);
  },
  async excluirNumero(nid) { await espera(); db.numeros = db.numeros.filter(n => n.id !== nid); gravar(); },
  async qrCode(nid) {
    await espera(500); achar(db.numeros, nid);
    // QR de mentira (desenho), só para mostrar onde o QR real aparece
    const r = rng(Date.now() % 100000); let px = '';
    for (let y = 0; y < 25; y++) for (let x = 0; x < 25; x++) {
      const canto = (x < 7 && y < 7) || (x > 17 && y < 7) || (x < 7 && y > 17);
      const cheio = canto ? (x % 6 === 0 || y % 6 === 0 || (x % 6 > 1 && x % 6 < 5 && y % 6 > 1 && y % 6 < 5) || x === 24 || y === 24 || x === 18 || y === 18) : r() < 0.5;
      if (cheio) px += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
    return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 29 29"><rect x="-2" y="-2" width="29" height="29" fill="#fff"/><g fill="#111">${px}</g></svg>`)}`;
  },
  async salvarMaturador(p) { await espera(); Object.assign(db.maturador, p); gravar(); return copia(db.maturador); },

  async salvarDisparo(p) {
    await espera();
    if (p.id) { const d = achar(db.disparos, p.id); Object.assign(d, p); gravar(); return copia(d); }
    const d: Disparo = { id: 'd' + id(), nome: 'Novo disparo', status: 'rascunho', mensagens: [{ texto: 'Oi {nome}, tudo bem? Aqui é a Ana da GM Cred.', variacoes: [], rodape: 'GM Cred', botoes: [{ tipo: 'resposta', texto: 'Quero simular' }] }], numeros: [], intervaloSeg: 45, horaInicio: 8, horaFim: 22, criadoEm: new Date().toISOString(), contatos: 0, naFila: 0, enviadas: 0, entregues: 0, responderam: 0, mandaramCpf: 0, bloquearam: 0, ...p } as Disparo;
    db.disparos.unshift(d); gravar(); return copia(d);
  },
  async mudarStatusDisparo(did, status) { await espera(); const d = achar(db.disparos, did); d.status = status; gravar(); return copia(d); },
  async duplicarDisparo(did) {
    await espera(); const o = achar(db.disparos, did);
    const d: Disparo = { ...copia(o), id: 'd' + id(), nome: o.nome + ' (cópia)', status: 'rascunho', criadoEm: new Date().toISOString(), contatos: 0, naFila: 0, enviadas: 0, entregues: 0, responderam: 0, mandaramCpf: 0, bloquearam: 0 };
    db.disparos.unshift(d); gravar(); return copia(d);
  },
  async importarContatos(did, linhas) { await espera(); const d = achar(db.disparos, did); d.contatos += linhas.length; d.naFila += linhas.length; gravar(); return copia(d); },

  async salvarIndicador(p) {
    await espera();
    if (p.id) { const i = achar(db.indicadores, p.id); Object.assign(i, p); gravar(); return copia(i); }
    const nome = p.nome || 'Indicador';
    const i: Indicador = { id: 'i' + id(), nome, telefone: p.telefone || '', pix: p.pix || '', codigo: (nome.split(' ')[0] || 'IND').toUpperCase() + Math.floor(10 + Math.random() * 90), indicacoes: 0, fechadas: 0, premio: p.premio ?? 50, pago: 0 };
    db.indicadores.push(i); gravar(); return copia(i);
  },
  async pagarIndicador(iid, valor) { await espera(); const i = achar(db.indicadores, iid); i.pago += valor; gravar(); return copia(i); },
  async salvarGasto(p) {
    await espera();
    if (p.id) { const g = achar(db.gastos, p.id); Object.assign(g, p); gravar(); return copia(g); }
    const g: Gasto = { id: id(), data: new Date().toISOString().slice(0, 10), categoria: 'outros', descricao: '', valor: 0, ...p } as Gasto;
    db.gastos.push(g); gravar(); return copia(g);
  },
  async apagarGasto(gid) { await espera(); db.gastos = db.gastos.filter(g => g.id !== gid); gravar(); },
  async salvarUsuario(p) {
    await espera();
    if (p.email && db.usuarios.some(u => u.email.toLowerCase() === p.email!.toLowerCase() && u.id !== p.id)) throw new Error('Já existe um usuário com este e-mail.');
    if (p.id) { const u = achar(db.usuarios, p.id); Object.assign(u, p); gravar(); return copia(u); }
    const u: Usuario = { id: 'u' + id(), nome: '', email: '', papel: 'atendente', escopo: p.papel === 'atendente' || !p.papel ? 'proprios' : 'todos', ativo: true, ultimoAcesso: null, ...p } as Usuario;
    db.usuarios.push(u); gravar(); return copia(u);
  },
};
