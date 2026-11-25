import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3, Magnet, Columns3, Users, MessageCircle, Calculator, Send, Smartphone, Flame, Gift, Wallet, UserCog, LogOut, Menu, Moon, Sun, X,
} from 'lucide-react';
import clsx from 'clsx';
import { useDados } from '@/estado/Dados';
import { MODO_DEMO } from '@/api';
import type { Papel } from '@/api/tipos';
import { resetarDemo } from '@/api/demo';
import { clientesVisiveis } from '@/util/permissoes';

export interface ItemMenu { para: string; nome: string; icone: typeof BarChart3; papeis: Papel[] }
const TODOS: Papel[] = ['admin', 'gestor', 'atendente'];
const GESTAO: Papel[] = ['admin', 'gestor'];

export const MENU: { grupo: string; itens: ItemMenu[] }[] = [
  { grupo: 'Visão geral', itens: [{ para: '/bi', nome: 'BI', icone: BarChart3, papeis: GESTAO }] },
  { grupo: 'Vendas', itens: [
    { para: '/pipeline', nome: 'Pipeline', icone: Columns3, papeis: TODOS },
    { para: '/clientes', nome: 'Clientes', icone: Users, papeis: TODOS },
    { para: '/conversas', nome: 'Conversas', icone: MessageCircle, papeis: TODOS },
    { para: '/motor', nome: 'Motor de Crédito', icone: Calculator, papeis: TODOS },
    { para: '/comissoes', nome: 'Comissões', icone: Wallet, papeis: TODOS },
    { para: '/leads', nome: 'Leads do dia', icone: Magnet, papeis: TODOS },
  ] },
  { grupo: 'WhatsApp', itens: [
    { para: '/disparos', nome: 'Disparos', icone: Send, papeis: GESTAO },
    { para: '/numeros', nome: 'Números', icone: Smartphone, papeis: TODOS },
    { para: '/maturador', nome: 'Maturador', icone: Flame, papeis: GESTAO },
  ] },
  { grupo: 'Gestão', itens: [
    { para: '/indicacoes', nome: 'Indicações', icone: Gift, papeis: GESTAO },
    { para: '/financeiro', nome: 'Financeiro', icone: Wallet, papeis: GESTAO },
    { para: '/usuarios', nome: 'Usuários', icone: UserCog, papeis: ['admin'] },
  ] },
];

export const podeVer = (papel: Papel, para: string) => MENU.some(g => g.itens.some(i => i.para === para && i.papeis.includes(papel)));
export const primeiraTela = (papel: Papel) => MENU.flatMap(g => g.itens).find(i => i.papeis.includes(papel))!.para;

function alternarTema() {
  const el = document.documentElement;
  const novo = el.dataset.tema === 'escuro' ? 'claro' : 'escuro';
  el.dataset.tema = novo;
  try { localStorage.setItem('gm_tema', novo); } catch { /* ignora */ }
}

export default function Layout() {
  const { usuario, sair, estado } = useDados();
  const [aberto, setAberto] = useState(false);
  const [, forcar] = useState(0);
  const loc = useLocation();
  if (!usuario) return null;
  const naoLidas = estado ? clientesVisiveis(estado, usuario).reduce((s, c) => s + (c.naoLidas && c.etapa !== 'perdido' ? 1 : 0), 0) : 0;
  const escuro = document.documentElement.dataset.tema === 'escuro';

  const menu = (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4" aria-label="Menu principal">
      {MENU.map(g => {
        const itens = g.itens.filter(i => i.papeis.includes(usuario.papel));
        if (!itens.length) return null;
        return (
          <div key={g.grupo}>
            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-apagado">{g.grupo}</div>
            {itens.map(i => (
              <NavLink key={i.para} to={i.para} onClick={() => setAberto(false)}
                className={({ isActive }) => clsx('flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition', isActive ? 'bg-marca-claro text-marca' : 'text-suave hover:bg-fundo hover:text-texto')}>
                <i.icone size={18} strokeWidth={1.8} />
                <span className="flex-1">{i.nome}</span>
                {i.para === '/conversas' && naoLidas > 0 && <span className="num rounded-full bg-marca px-1.5 text-[11px] font-semibold text-white">{naoLidas}</span>}
              </NavLink>
            ))}
          </div>
        );
      })}
    </nav>
  );

  const rodape = (
    <div className="border-t border-borda p-3">
      <div className="mb-2 px-2">
        <div className="truncate text-sm font-medium">{usuario.nome}</div>
        <div className="truncate text-xs text-apagado">{usuario.email}</div>
      </div>
      <div className="flex gap-1">
        <button className="bt bt-sm flex-1" onClick={() => { alternarTema(); forcar(x => x + 1); }} aria-label="Trocar tema">
          {escuro ? <Sun size={14} /> : <Moon size={14} />} {escuro ? 'Claro' : 'Escuro'}
        </button>
        <button className="bt bt-sm flex-1" onClick={sair}><LogOut size={14} /> Sair</button>
      </div>
      {MODO_DEMO && (
        <button className="mt-2 w-full text-[11px] text-apagado underline" onClick={() => { if (confirm('Apagar as mudanças feitas na demonstração e voltar aos dados iniciais?')) { resetarDemo(); location.reload(); } }}>
          Resetar dados de demonstração
        </button>
      )}
    </div>
  );

  const marca = (
    <div className="flex items-center gap-2 px-5 py-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-marca text-sm font-bold text-white">GM</div>
      <div className="leading-tight"><div className="text-sm font-semibold">GM Cred</div><div className="text-[11px] text-apagado">Painel</div></div>
    </div>
  );

  return (
    <div className="flex h-full">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-borda bg-cartao lg:flex">{marca}{menu}{rodape}</aside>

      {aberto && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setAberto(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-cartao" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pr-3">{marca}<button className="rounded p-2" onClick={() => setAberto(false)} aria-label="Fechar menu"><X size={18} /></button></div>
            {menu}{rodape}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-borda bg-cartao px-4 py-3 lg:hidden">
          <button className="rounded p-1" onClick={() => setAberto(true)} aria-label="Abrir menu"><Menu size={20} /></button>
          <span className="font-semibold">{MENU.flatMap(g => g.itens).find(i => loc.pathname.startsWith(i.para))?.nome ?? 'GM Cred'}</span>
        </header>
        {MODO_DEMO && (loc.pathname.startsWith('/motor') ? (
          <div className="border-b border-red-300/50 bg-red-50 px-4 py-1.5 text-center text-xs text-red-800 dark:bg-red-500/10 dark:text-red-200">
            Motor de Crédito REAL: as consultas vão para V8, Unno e HUB de verdade, e “Enviar proposta” cria a proposta no banco.
          </div>
        ) : (
          <div className="border-b border-amber-300/50 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            Modo demonstração: dados fictícios, nada é enviado de verdade. O painel antigo continua funcionando normalmente.
          </div>
        ))}
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6"><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
