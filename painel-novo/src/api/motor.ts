/**
 * Motor de crédito de verdade (n8n), separado da Ana.
 *   POST /webhook/escritorio/login   { k: chave de acesso }        → sessão (mesma chave do painel antigo)
 *   POST /webhook/motor/credito      { k, acao: consultar|atualizar, cpf | id }
 *   POST /webhook/motor/digitar      { k, id, parte, oferta, dados, enviar }
 */
const BASE = (import.meta.env.VITE_N8N_WEBHOOK as string | undefined) || 'https://rarelookingorca-n8n.cloudfy.live/webhook';
const CHAVE = 'gm_motor_sessao';

export type ParteId = 'v8_clt' | 'unno_clt' | 'hub_clt' | 'v8_fgts' | 'unno_fgts' | 'hub_fgts';
export type Situacao = 'iniciando' | 'processando' | 'simulando' | 'aguardando_termo' | 'aguardando_autorizacao'
  | 'ofertas' | 'sem_ofertas' | 'sem_margem' | 'sem_saldo' | 'sem_autorizacao' | 'sem_adesao' | 'erro';

export interface OfertaMotor {
  tabela: string; variante?: string; banco: string; seguro?: boolean;
  prazo: number; parcela?: number; valor: number; bruto?: number; taxa?: number;
  comissao_pct: number | null; comissao: number | null;
  [k: string]: unknown;
}
export interface DetalheFgts { banco: string; situacao: Situacao; motivo: string }
export interface Parte {
  situacao: Situacao; mensagem?: string; ofertas: OfertaMotor[]; margem?: number; limites?: string;
  detalhe?: DetalheFgts[]; link_termo?: string; tentativas?: number;
}
export interface ConsultaMotor {
  ok: boolean; id: number; cpf: string; erro?: string;
  cliente: { nome?: string; nascimento?: string; telefone?: string; email?: string };
  partes: Partial<Record<ParteId, Parte>>; pendentes: number;
  melhor: (OfertaMotor & { parte: ParteId }) | null;
}
export interface DadosDigitacao { mae: string; pix_tipo: 'cpf' | 'phone' | 'email' | 'random'; pix_chave: string; email?: string; [k: string]: string | undefined }
export interface ResultadoDigitacao {
  ok: boolean; previa?: boolean; enviado: boolean; banco?: string; erro?: string; faltando?: string[];
  proposta?: string; link?: string; etapa?: string; payload?: unknown; rascunho_unno?: string; resposta_banco?: string;
}

export class SemAcesso extends Error {}

export const sessao = {
  ler: () => { try { return localStorage.getItem(CHAVE) || ''; } catch { return ''; } },
  gravar: (t: string) => { try { localStorage.setItem(CHAVE, t); } catch { /* sem storage */ } },
  sair: () => { try { localStorage.removeItem(CHAVE); } catch { /* sem storage */ } },
};

async function post<T>(caminho: string, corpo: object): Promise<T> {
  const r = await fetch(BASE + caminho, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  const texto = await r.text();
  let b: unknown = null;
  try { b = texto ? JSON.parse(texto) : null; } catch { /* resposta sem JSON */ }
  if (r.status === 401) throw new SemAcesso('Sem acesso. Entre de novo com a chave do painel.');
  if (!r.ok || !b) throw new Error((b as { erro?: string })?.erro || `O n8n respondeu ${r.status}${texto ? '' : ' sem conteúdo'}`);
  return b as T;
}

/** acha o token de sessão em qualquer formato que o login devolva */
function achaToken(x: unknown): string {
  if (typeof x === 'string') return x.startsWith('ses-') ? x : '';
  if (x && typeof x === 'object') for (const v of Object.values(x)) { const t = achaToken(v); if (t) return t; }
  return '';
}

export const motor = {
  async entrar(chaveAcesso: string) {
    const r = await post<unknown>('/escritorio/login', { k: chaveAcesso.trim() }).catch(e => {
      if (e instanceof SemAcesso) throw new Error('Chave de acesso inválida.');
      throw e;
    });
    const t = achaToken(r);
    if (!t) throw new Error('O login não devolveu a sessão.');
    sessao.gravar(t);
  },
  consultar: (cpf: string) => post<ConsultaMotor>('/motor/credito', { k: sessao.ler(), acao: 'consultar', cpf }),
  atualizar: (id: number) => post<ConsultaMotor>('/motor/credito', { k: sessao.ler(), acao: 'atualizar', id }),
  digitar: (id: number, parte: ParteId, oferta: OfertaMotor, dados: DadosDigitacao, enviar: boolean) =>
    post<ResultadoDigitacao>('/motor/digitar', { k: sessao.ler(), id, parte, oferta, dados, enviar }),
};

export const PARTES: { id: ParteId; banco: 'V8' | 'Unno' | 'HUB'; produto: 'CLT' | 'FGTS' }[] = [
  { id: 'v8_clt', banco: 'V8', produto: 'CLT' }, { id: 'unno_clt', banco: 'Unno', produto: 'CLT' }, { id: 'hub_clt', banco: 'HUB', produto: 'CLT' },
  { id: 'v8_fgts', banco: 'V8', produto: 'FGTS' }, { id: 'unno_fgts', banco: 'Unno', produto: 'FGTS' }, { id: 'hub_fgts', banco: 'HUB', produto: 'FGTS' },
];
export const PENDENTE: Situacao[] = ['iniciando', 'processando', 'simulando', 'aguardando_termo', 'aguardando_autorizacao'];
