import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import clsx from 'clsx';

export function Titulo({ titulo, sub, acoes }: { titulo: string; sub?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
        {sub && <p className="mt-0.5 text-sm text-apagado">{sub}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Kpi({ rotulo, valor, detalhe, destaque }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode; destaque?: boolean }) {
  return (
    <div className={clsx('cartao p-4', destaque && 'border-marca')}>
      <div className="text-xs font-medium text-apagado">{rotulo}</div>
      <div className="num mt-1 text-2xl font-semibold tracking-tight">{valor}</div>
      {detalhe && <div className="mt-1 text-xs text-apagado">{detalhe}</div>}
    </div>
  );
}

const CORES = {
  cinza: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300',
  azul: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  verde: 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  amarelo: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  vermelho: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  roxo: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
};
export type Cor = keyof typeof CORES;
export function Etiqueta({ cor = 'cinza', children }: { cor?: Cor; children: ReactNode }) {
  return <span className={clsx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', CORES[cor])}>{children}</span>;
}

export function Modal({ aberto, fechar, titulo, children, largura = 'max-w-lg', rodape }: { aberto: boolean; fechar: () => void; titulo: string; children: ReactNode; largura?: string; rodape?: ReactNode }) {
  useEffect(() => {
    if (!aberto) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && fechar();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [aberto, fechar]);
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={fechar}>
      <div role="dialog" aria-modal="true" aria-label={titulo} className={clsx('cartao flex max-h-[92vh] w-full flex-col rounded-b-none sm:rounded-xl', largura)} onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-borda px-5 py-3">
          <h2 className="font-semibold">{titulo}</h2>
          <button className="rounded p-1 text-apagado hover:bg-fundo" onClick={fechar} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {rodape && <div className="flex justify-end gap-2 border-t border-borda px-5 py-3">{rodape}</div>}
      </div>
    </div>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-borda px-4 py-8 text-center text-sm text-apagado">{children}</div>;
}

export function Abas<T extends string>({ valor, opcoes, mudar }: { valor: T; opcoes: { id: T; nome: ReactNode }[]; mudar: (v: T) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-borda bg-cartao p-1" role="tablist">
      {opcoes.map(o => (
        <button key={o.id} role="tab" aria-selected={valor === o.id} onClick={() => mudar(o.id)}
          className={clsx('rounded-md px-3 py-1.5 text-sm font-medium transition', valor === o.id ? 'bg-marca text-white' : 'text-suave hover:bg-fundo')}>
          {o.nome}
        </button>
      ))}
    </div>
  );
}

export function Carregando() {
  return <div className="flex h-64 items-center justify-center text-sm text-apagado">Carregando…</div>;
}
