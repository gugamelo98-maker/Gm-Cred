/** Leads frios (planilha BANCO DE DADOS importada no banco): extração e cota por colaborador. */
import { token, SessaoExpirada } from './painel';
import type { LeadDia } from './tipos';

const BASE = (import.meta.env.VITE_N8N_WEBHOOK as string | undefined) || 'https://rarelookingorca-n8n.cloudfy.live/webhook';

async function leads<T>(acao: string, dados: object = {}): Promise<T> {
  const r = await fetch(BASE + '/painel/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao, k: token.ler(), dados }) });
  let b: { ok?: boolean; erro?: string } | null = null;
  try { b = await r.json(); } catch { /* sem corpo */ }
  if (r.status === 401) throw new SessaoExpirada(b?.erro || 'Sessão expirada. Entre de novo.');
  if (!b?.ok) throw new Error(b?.erro || `Falha no servidor (${r.status})`);
  return b as T;
}

export interface InfoFrios { frios_cota: number; frios_hoje: number; frios_disponiveis: number; frios_por_usuario: Record<string, number>; leads: LeadDia[] }

export const frios = {
  info: () => leads<InfoFrios>('listar'),
  /** extrai os frios liberados para o usuário (um do final, um do início, um do meio da planilha) e devolve a lista atualizada */
  extrair: async () => { await leads('separar_frios'); return leads<InfoFrios>('listar'); },
  cota: (usuario: string, qtd: number) => leads('frios_cota', { usuario, qtd }),
};
