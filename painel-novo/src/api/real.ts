/**
 * Implementação real do painel novo. Usa:
 *  - /painel/dados   (credito.painel_dados_api)  clientes, conversas, pipeline, números, maturador, indicações, gastos
 *  - /painel/leads   (credito.leads_dia_api)     leads do dia (meus_leads + telefones)
 *  - /escritorio/*   (mesmas funções do painel antigo) enviar mensagem, números, indicações, financeiro
 * A sessão é a do login do painel (validada por credito.validar_chave).
 */
import type { Api } from './contrato';
import type { Cliente, Estado, LeadDia, Mensagem, Numero } from './tipos';
import { demoApi } from './demo';
import { painel, token, SessaoExpirada } from './painel';

const BASE = (import.meta.env.VITE_N8N_WEBHOOK as string | undefined) || 'https://rarelookingorca-n8n.cloudfy.live/webhook';

async function json<T>(caminho: string, acao: string, dados: object = {}): Promise<T> {
  const r = await fetch(BASE + caminho, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao, k: token.ler(), dados }) });
  let b: { ok?: boolean; erro?: string } | null = null;
  try { b = await r.json(); } catch { /* sem corpo */ }
  if (r.status === 401) throw new SessaoExpirada(b?.erro || 'Sessão expirada. Entre de novo.');
  if (!b?.ok) throw new Error(b?.erro || `Falha no servidor (${r.status})`);
  return b as T;
}
/** endpoints do painel antigo (form) */
async function antigo<T>(caminho: string, acao: string, extra: Record<string, string> = {}): Promise<T> {
  const r = await fetch(BASE + caminho, { method: 'POST', body: new URLSearchParams({ k: token.ler(), acao, ...extra }) });
  if (r.status === 401) throw new SessaoExpirada('Sessão expirada. Entre de novo.');
  if (!r.ok) throw new Error('O servidor respondeu ' + r.status);
  const b = await r.json().catch(() => ({}));
  if (b && (b as { erro?: string }).erro) throw new Error((b as { erro: string }).erro);
  return b as T;
}
const dados = <T>(acao: string, d: object = {}) => json<T>('/painel/dados', acao, d);
const leads = <T>(acao: string, d: object = {}) => json<T>('/painel/leads', acao, d);
/** usuário logado (gravado pelo login) */
const eu = (): { id: string; papel: string } | null => { try { return JSON.parse(localStorage.getItem('gm_painel_usuario') || 'null'); } catch { return null; } };
/** colaborador (atendente) que cria ou conecta um número vira o dono dele automaticamente */
const donoAuto = async (nome: string) => { const u = eu(); if (u && u.papel === 'atendente') await dados('dono_numero', { nome, dono: u.id }); };
const semMidia = () => { throw new Error('Enviar mídia pelo painel novo ainda não está disponível. Mande pelo WhatsApp do número.'); };

type EstadoServidor = Omit<Estado, 'usuarios' | 'disparos' | 'leadsDia'>;

export const realApi: Api = {
  ...demoApi,
  entrar: (email, senha) => painel.entrar(email, senha),
  async estado() {
    const [e, usuarios, l] = await Promise.all([dados<EstadoServidor>('estado'), painel.listar(), leads<{ leads: LeadDia[] }>('listar').catch(() => ({ leads: [] }))]);
    return { clientes: e.clientes, numeros: e.numeros, maturador: e.maturador, indicadores: e.indicadores, gastos: e.gastos, respostas: e.respostas, usuarios, disparos: [], leadsDia: l.leads };
  },
  salvarUsuario: u => painel.salvar(u),

  // Pipeline / Clientes
  moverCliente: async (id, para) => (await dados<{ cliente: Cliente }>('mover', { id, etapa: para })).cliente,
  salvarCliente: async c => (await dados<{ cliente: Cliente }>('salvar_cliente', c)).cliente,

  // Conversas
  mensagens: async id => (await dados<{ mensagens: Mensagem[] }>('mensagens', { id })).mensagens,
  async enviarMensagem(clienteId, texto, autor) {
    await antigo('/escritorio/atendimento', 'enviar', { id: clienteId, texto });
    return { id: 'tmp' + Date.now(), clienteId, de: 'humano', autor, texto, midia: null, em: new Date().toISOString(), status: 'enviando' };
  },
  async novaConversa(telefone, nome, texto) {
    const { cliente } = await dados<{ cliente: Cliente }>('nova_conversa', { telefone, nome });
    await antigo('/escritorio/atendimento', 'enviar', { id: cliente.id, texto });
    return { ...cliente, ultimaMsgEm: new Date().toISOString() };
  },
  enviarMidia: async () => semMidia(),
  async adicionarNota(clienteId, texto, autor) {
    await dados('nota', { id: clienteId, texto });
    return { id: 'n' + Date.now(), clienteId, de: 'nota', autor, texto, midia: null, em: new Date().toISOString(), status: null };
  },
  definirResponsavel: async (id, responsavel) => (await dados<{ cliente: Cliente }>('responsavel', { id, responsavel: responsavel ?? '' })).cliente,
  assumirConversa: async id => (await dados<{ cliente: Cliente }>('assumir', { id })).cliente,
  async finalizarConversa(id, motivo) {
    await antigo('/escritorio/atendimento', 'finalizar', { id, texto: motivo });
    return (await dados<{ cliente: Cliente }>('mover', { id, etapa: 'perdido' })).cliente;
  },
  marcarLida: async () => { /* abrir a conversa já marca como lida */ },

  // Números e maturador (mesmo backend do painel antigo)
  async salvarNumero(n) {
    const extra: Record<string, string> = { nome: n.id };
    if (n.funcao) extra.funcao = n.funcao;
    if (n.maturar !== undefined) extra.maturar = String(n.maturar);
    if (n.aparelho !== undefined) extra.aparelho = n.aparelho;
    if (n.campanha !== undefined) extra.campanha = String(n.campanha);
    await antigo('/escritorio/numeros', 'salvar', extra);
    if (n.dono !== undefined) await dados('dono_numero', { nome: n.id, dono: n.dono ?? '' });
    const r = await dados<{ numeros: Numero[] }>('numeros');
    return r.numeros.find(x => x.id === n.id)!;
  },
  async novoNumero(sessao, funcao, dono) {
    const u = eu(); if (!dono && u?.papel === 'atendente') dono = u.id;
    await antigo('/escritorio/numeros', 'criar', { aparelho: sessao });
    const e = await realApi.estado();
    const n = e.numeros[e.numeros.length - 1];
    if (n) { await antigo('/escritorio/numeros', 'salvar', { nome: n.id, funcao }); if (dono) await dados('dono_numero', { nome: n.id, dono }); }
    return { ...n, funcao, dono };
  },
  listarNumeros: async () => (await dados<{ numeros: Numero[] }>('numeros')).numeros,
  excluirNumero: async id => { await antigo('/escritorio/numeros', 'excluir', { nome: id }); },
  async qrCode(id) {
    await donoAuto(id);
    const r = await antigo<{ qr?: string; estado?: string }>('/escritorio/numeros', 'qr', { nome: id, reiniciar: 'false' });
    if (r.estado === 'open') throw new Error('Este número já está conectado.');
    if (!r.qr) throw new Error('O QR ainda está sendo gerado. Tente de novo em alguns segundos.');
    return r.qr.startsWith('data:') ? r.qr : 'data:image/png;base64,' + r.qr;
  },
  async salvarMaturador(m) {
    const extra: Record<string, string> = {};
    if (m.ativo !== undefined) extra.ativo = String(m.ativo);
    if (m.intervaloMin !== undefined) extra.intervalo_min = String(m.intervaloMin);
    await antigo('/escritorio/numeros', 'maturador', extra);
    return (await realApi.estado()).maturador;
  },

  // Leads do dia (meus_leads higienizados + telefones)
  async extrairLeads(por) {
    const r = await leads<{ leads: LeadDia[] }>('separar');
    return r.leads.filter(l => l.extraidoPor === por);
  },
  async chamarLead(id, texto) {
    const r = await leads<{ lead: LeadDia; clienteId: string }>('chamar', { cpf: id, texto });
    const e = await realApi.estado();
    const cliente = e.clientes.find(c => c.id === r.clienteId)!;
    const mensagem: Mensagem = { id: 'tmp' + Date.now(), clienteId: r.clienteId, de: 'humano', autor: null, texto, midia: null, em: new Date().toISOString(), status: 'enviando' };
    return { lead: r.lead, cliente, mensagem };
  },

  // Indicações e financeiro (mesmo backend do painel antigo)
  async salvarIndicador(i) {
    await antigo('/escritorio/indicacoes', 'cadastrar', { nome: i.nome ?? '', telefone: i.telefone ?? '', pix: i.pix ?? '', cpf: (i as { cpf?: string }).cpf ?? '' });
    const e = await realApi.estado();
    return e.indicadores[0];
  },
  async pagarIndicador(id) {
    await antigo('/escritorio/indicacoes', 'pagar', { id });
    return (await realApi.estado()).indicadores.find(x => x.id === id)!;
  },
  async salvarGasto(g) {
    await antigo('/escritorio/financeiro', 'salvar', { valor: (g.valor ?? 0).toFixed(2), data: g.data ?? new Date().toISOString().slice(0, 10), categoria: g.categoria ?? 'outros', descricao: g.descricao ?? '', quantidade: '', mes: (g.data ?? new Date().toISOString()).slice(0, 7) });
    const e = await realApi.estado();
    return e.gastos[0];
  },
  apagarGasto: async id => { await antigo('/escritorio/financeiro', 'apagar', { id, mes: new Date().toISOString().slice(0, 7) }); },
};
