/** Login e usuários de verdade (n8n → credito.painel_api). A mesma sessão vale para o Motor. */
import type { Usuario } from './tipos';

const BASE = (import.meta.env.VITE_N8N_WEBHOOK as string | undefined) || 'https://rarelookingorca-n8n.cloudfy.live/webhook';
const TOKEN = 'gm_painel_token';

export interface RegrasComissao {
  clt: { ate: number; pct: number }[];
  fgts: number;
  bonus_clt: { cada: number; valor: number };
  bonus_fgts: { cada: number; valor: number };
}

export const token = {
  ler: () => { try { return localStorage.getItem(TOKEN) || ''; } catch { return ''; } },
  gravar: (t: string) => { try { localStorage.setItem(TOKEN, t); } catch { /* sem storage */ } },
  apagar: () => { try { localStorage.removeItem(TOKEN); } catch { /* sem storage */ } },
};

export class SessaoExpirada extends Error {}

async function chamar<T>(acao: string, dados: object = {}): Promise<T> {
  const r = await fetch(BASE + '/painel/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao, k: token.ler(), dados }) });
  let b: { ok?: boolean; erro?: string } | null = null;
  try { b = await r.json(); } catch { /* sem corpo */ }
  if (r.status === 401 && acao !== 'entrar') throw new SessaoExpirada(b?.erro || 'Sessão expirada. Entre de novo.');
  if (!b?.ok) throw new Error(b?.erro || `Falha no servidor (${r.status})`);
  return b as T;
}

export const painel = {
  async entrar(email: string, senha: string): Promise<Usuario> {
    const r = await chamar<{ token: string; usuario: Usuario }>('entrar', { email, senha });
    token.gravar(r.token);
    return r.usuario;
  },
  eu: () => chamar<{ usuario: Usuario; comissao: RegrasComissao }>('eu'),
  async sair() { try { await chamar('sair'); } catch { /* já saiu */ } token.apagar(); },
  listar: async () => (await chamar<{ usuarios: Usuario[] }>('listar')).usuarios,
  salvar: async (u: Partial<Usuario> & { senha?: string }) => (await chamar<{ usuario: Usuario }>('salvar', u)).usuario,
  trocarSenha: (senha: string) => chamar('senha', { senha }),
};
