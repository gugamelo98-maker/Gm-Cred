import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, type Estado, type Usuario } from '@/api';

type Aviso = { id: number; texto: string; tipo: 'ok' | 'erro' };

interface Ctx {
  estado: Estado | null;
  erro: string | null;
  usuario: Usuario | null;
  entrar(email: string, senha: string): Promise<void>;
  sair(): void;
  recarregar(): Promise<void>;
  /** troca um item de uma lista do estado pelo id (depois de salvar no backend) */
  trocar<K extends keyof Estado>(lista: K, item: Estado[K] extends (infer T)[] ? T : never): void;
  remover<K extends keyof Estado>(lista: K, id: string): void;
  definir(mudar: (e: Estado) => Estado): void;
  avisar(texto: string, tipo?: Aviso['tipo']): void;
  /** executa uma ação no backend, avisa o erro se der errado */
  executar<T>(fn: () => Promise<T>, ok?: string): Promise<T | undefined>;
}

const C = createContext<Ctx | null>(null);
const CHAVE_SESSAO = 'gm_painel_usuario';

function lerSessao(): Usuario | null {
  try { const s = localStorage.getItem(CHAVE_SESSAO); return s ? JSON.parse(s) : null; } catch { return null; }
}

export function DadosProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(lerSessao);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const seq = useRef(0);

  const avisar = useCallback((texto: string, tipo: Aviso['tipo'] = 'ok') => {
    const id = ++seq.current;
    setAvisos(a => [...a, { id, texto, tipo }]);
    setTimeout(() => setAvisos(a => a.filter(x => x.id !== id)), 3500);
  }, []);

  const recarregar = useCallback(async () => {
    try { setEstado(await api.estado()); setErro(null); } catch (e) { setErro(String((e as Error).message || e)); }
  }, []);

  useEffect(() => {
    if (!usuario) return;
    recarregar();
    const t = setInterval(recarregar, 60000);
    return () => clearInterval(t);
  }, [usuario, recarregar]);

  const valor = useMemo<Ctx>(() => ({
    estado, erro, usuario,
    async entrar(email, senha) {
      const u = await api.entrar(email, senha);
      try { localStorage.setItem(CHAVE_SESSAO, JSON.stringify(u)); } catch { /* ignora */ }
      setUsuario(u);
    },
    sair() {
      try { localStorage.removeItem(CHAVE_SESSAO); } catch { /* ignora */ }
      setUsuario(null); setEstado(null);
    },
    recarregar,
    trocar(lista, item) {
      setEstado(e => {
        if (!e) return e;
        const xs = e[lista] as unknown as { id: string }[];
        const it = item as unknown as { id: string };
        const novo = xs.some(x => x.id === it.id) ? xs.map(x => (x.id === it.id ? it : x)) : [it, ...xs];
        return { ...e, [lista]: novo };
      });
    },
    remover(lista, id) {
      setEstado(e => (e ? { ...e, [lista]: (e[lista] as unknown as { id: string }[]).filter(x => x.id !== id) } : e));
    },
    definir(mudar) { setEstado(e => (e ? mudar(e) : e)); },
    avisar,
    async executar(fn, ok) {
      try { const r = await fn(); if (ok) avisar(ok); return r; } catch (e) { avisar(String((e as Error).message || e), 'erro'); return undefined; }
    },
  }), [estado, erro, usuario, recarregar, avisar]);

  return (
    <C.Provider value={valor}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2" aria-live="polite">
        {avisos.map(a => (
          <div key={a.id} className={`rounded-lg px-4 py-3 text-sm shadow-lg ${a.tipo === 'erro' ? 'bg-red-600 text-white' : 'bg-texto text-fundo'}`}>{a.texto}</div>
        ))}
      </div>
    </C.Provider>
  );
}

export function useDados() {
  const c = useContext(C);
  if (!c) throw new Error('useDados fora do DadosProvider');
  return c;
}
