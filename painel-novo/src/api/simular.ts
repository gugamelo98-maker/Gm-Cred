/**
 * Simular parcela (CLT): usa os mesmos endpoints do painel antigo (/escritorio/v8, /escritorio/unno, /escritorio/hub)
 * com os ids que a consulta do Motor já abriu, e grava o resultado na consulta (comissão calculada no servidor).
 */
import { token } from './painel';
import { dadosPost } from './aoVivo';
import type { ConsultaMotor, OfertaMotor, ParteId } from './motor';

const BASE = (import.meta.env.VITE_N8N_WEBHOOK as string | undefined) || 'https://rarelookingorca-n8n.cloudfy.live/webhook';
type Resp = { ok?: boolean; situacao?: string; ofertas?: OfertaMotor[]; erros?: string[]; erro?: string; limites?: string; pendente?: boolean };
async function antigo(rota: string, acao: string, cpf: string, dados: object): Promise<Resp> {
  let ult = 'resposta vazia';
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(BASE + rota, { method: 'POST', body: new URLSearchParams({ k: token.ler(), acao, cpf, dados: JSON.stringify(dados) }) });
      if (r.status === 401) throw new Error('Sessão expirada. Entre de novo.');
      const tx = r.ok ? await r.text() : '';
      if (tx) return JSON.parse(tx);
      ult = r.ok ? 'resposta vazia' : 'HTTP ' + r.status;
    } catch (e) { ult = (e as Error).message; if (/Sessão/.test(ult)) throw e; }
    await new Promise(x => setTimeout(x, 2500));
  }
  throw new Error(ult);
}
const espera = (ms: number) => new Promise(r => setTimeout(r, ms));
const norm = (os: OfertaMotor[] | undefined, tabela: string, banco: string) =>
  (os ?? []).filter(o => Number(o.valor) > 0).map(o => ({ ...o, tabela: o.tabela || tabela, banco: o.banco || banco, prazo: Number(o.prazo), valor: Number(o.valor), parcela: o.parcela != null ? Number(o.parcela) : undefined }) as OfertaMotor);

/** prazo: '' = 36x e 24x (padrão), 'todos' = todos os prazos liberados, ou um número */
async function v8(c: ConsultaMotor, parcela: number, prazo: string) {
  const p = c.partes.v8_clt as (Record<string, unknown> & { margem?: number; limites?: string }) | undefined;
  if (!p?.consult_id || !p.margem) return null;
  const parc = Math.min(parcela, Math.floor(Number(p.margem) * 100) / 100);
  const base = { consult_id: p.consult_id, margem: p.margem, parcela: parc };
  const lim = [...new Set([...(p.limites ?? '').matchAll(/(\d+)x/g)].map(m => +m[1]))];
  const prazos = prazo === 'todos' ? (lim.length ? lim : ['']) : [prazo];
  const ofs: OfertaMotor[] = [], erros: string[] = [];
  for (let i = 0; i < prazos.length; i += 3) {
    const rs = await Promise.all(prazos.slice(i, i + 3).map(pz => antigo('/escritorio/v8', 'simular', '', { ...base, prazo: String(pz) })));
    rs.forEach(d => { ofs.push(...norm(d.ofertas, 'CLT Acelera', 'V8')); (d.erros ?? []).forEach(e => e && erros.push(e)); });
  }
  return { parte: 'v8_clt' as ParteId, ofertas: ofs, parcela: parc, mensagem: ofs.length ? '' : [...new Set(erros)].join(' · ').slice(0, 300) || 'A V8 não aprovou essa simulação' };
}
async function unno(c: ConsultaMotor, parcela: number) {
  const p = c.partes.unno_clt as (Record<string, unknown> & { margem?: number }) | undefined;
  if (!p?.application_id) return null;
  const parc = p.margem ? Math.min(parcela, Math.floor(Number(p.margem) * 100) / 100) : parcela;
  let d = await antigo('/escritorio/unno', 'ofertas', c.cpf, { application_id: p.application_id, parcela: parc });
  for (let i = 0; i < 40 && (d.pendente === true || d.situacao === 'processando'); i++) { await espera(4000); d = await antigo('/escritorio/unno', 'ofertas', c.cpf, { application_id: p.application_id }); }
  const ofs = norm(d.ofertas, 'Unno', 'Unno');
  return { parte: 'unno_clt' as ParteId, ofertas: ofs, parcela: parc, mensagem: ofs.length ? '' : d.erro || 'A Unno não liberou oferta com essa parcela' };
}
async function hub(c: ConsultaMotor, parcela: number) {
  const p = c.partes.hub_clt as Record<string, unknown> | undefined;
  if (!p?.presim_id) return null;
  const d = await antigo('/escritorio/hub', 'simular', c.cpf, { presim_id: p.presim_id, parcela });
  const ofs = norm(d.ofertas, 'Tabela CLT', 'HUB');
  return { parte: 'hub_clt' as ParteId, ofertas: ofs, parcela, mensagem: ofs.length ? '' : d.erro || 'A HUB não liberou oferta com essa parcela' };
}

/** simula a parcela nos bancos CLT que têm consulta aberta; chama `pronto` a cada banco que termina, com a consulta atualizada */
export async function simularParcela(c: ConsultaMotor, parcela: number, prazo: string, pronto: (c: ConsultaMotor) => void, falhou: (parte: ParteId, msg: string) => void) {
  const tarefas: [ParteId, Promise<Awaited<ReturnType<typeof v8>>>][] = [['v8_clt', v8(c, parcela, prazo)], ['unno_clt', unno(c, parcela)], ['hub_clt', hub(c, parcela)]];
  await Promise.all(tarefas.map(async ([parte, t]) => {
    try {
      const r = await t; if (!r) return;
      pronto(await dadosPost<ConsultaMotor>('motor_simulado', { id: c.id, ...r }));
    } catch (e) { falhou(parte, (e as Error).message); }
  }));
}
export const temSimulacao = (c: ConsultaMotor | null) => !!c && (['v8_clt', 'unno_clt', 'hub_clt'] as ParteId[]).some(k => {
  const p = c.partes[k] as Record<string, unknown> | undefined; return !!(p && (p.consult_id || p.application_id || p.presim_id));
});
