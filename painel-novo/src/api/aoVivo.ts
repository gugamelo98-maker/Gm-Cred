import { token } from './painel';

const BASE = (import.meta.env.VITE_N8N_WEBHOOK as string | undefined) || 'https://rarelookingorca-n8n.cloudfy.live/webhook';
export async function dadosPost<T>(acao: string, dados: object = {}): Promise<T> {
  const r = await fetch(BASE + '/painel/dados', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao, k: token.ler(), dados }) });
  const b = await r.json().catch(() => ({}));
  if (!b.ok) throw new Error(b.erro || 'Falha ao falar com o servidor');
  return b as T;
}
/** avisa o servidor que o usuário está com o painel aberto (e em qual aba) */
export const ping = (aba: string) => dadosPost('ping', { aba }).catch(() => {});

export interface Membro {
  id: string; nome: string; papel: string; vistoEm: string | null; aba: string | null; status: '1_online' | '2_ausente' | '3_offline';
  abertas: number; naoLidas: number; enviadasHoje: number; atendidosHoje: number; leadsHoje: number; chamadosHoje: number;
}
export const aoVivo = () => dadosPost<{ equipe: Membro[]; agora: string }>('ao_vivo');

/** contratos pagos nos bancos (V8, Unno, HUB) entre ini e fim — mesma fonte do BI */
export async function dadosBi(ini: string, fim: string) {
  const r = await fetch(BASE + '/painel/bi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ k: token.ler(), dados: { ini, fim } }) });
  const b = await r.json().catch(() => ({}));
  if (!b.ok) throw new Error(b.erro || 'Falha no BI');
  return (b.pagos ?? []) as { banco: 'V8' | 'Unno' | 'HUB'; produto: string; valor: number; comissao: number | null }[];
}
