import { useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { GripVertical, Search } from 'lucide-react';
import clsx from 'clsx';
import { useDados } from '@/estado/Dados';
import type { Cliente, Etapa } from '@/api/tipos';
import { Titulo } from '@/componentes/ui';
import { brl, fmtTel, tempoDesde } from '@/util/formato';
import { ETAPAS } from '@/util/rotulos';
import Ficha, { MotivoPerda, nomeAtendente, useMoverCliente } from '@/telas/clientes/Ficha';

const POR_COLUNA = 40;

function Cartao({ c, arrastando, abrir }: { c: Cliente; arrastando?: boolean; abrir?: () => void }) {
  const { estado } = useDados();
  const valor = c.valorLiberado ? brl(c.valorLiberado) : c.margem ? 'margem ' + brl(c.margem) : null;
  return (
    <div className={clsx('cartao group cursor-grab select-none p-3 text-left shadow-sm active:cursor-grabbing', arrastando && 'rotate-1 shadow-xl ring-2 ring-marca')}
      onClick={abrir} role="button" tabIndex={-1}>
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{c.nome}</div>
          <div className="num truncate text-xs text-apagado">{fmtTel(c.telefone)}</div>
        </div>
        <GripVertical size={14} className="mt-0.5 shrink-0 text-apagado opacity-40 group-hover:opacity-100" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-suave">
        <span className="rounded bg-fundo px-1.5 py-0.5 font-medium">{c.produto}</span>
        {valor && <span className="num font-medium text-texto">{valor}</span>}
        {c.atendente !== 'ia' && <span>👤 {nomeAtendente(c.atendente, estado!.usuarios).split(' ')[0]}</span>}
      </div>
      <div className="mt-1 flex justify-between gap-2 text-xs text-apagado">
        <span className="truncate">{c.etiqueta && c.etapa === 'perdido' ? c.etiqueta : c.situacao}</span>
        <span className="shrink-0">{tempoDesde(c.ultimaMsgEm)}</span>
      </div>
    </div>
  );
}

function Arrastavel({ c, abrir }: { c: Cliente; abrir: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: c.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={clsx('touch-none outline-none focus-visible:ring-2 focus-visible:ring-marca rounded-xl', isDragging && 'opacity-30')}
      aria-label={`${c.nome}. Use espaço para pegar e as setas para mover.`}>
      <Cartao c={c} abrir={abrir} />
    </div>
  );
}

function Coluna({ etapa, nome, desc, clientes, abrir, aberta }: { etapa: Etapa; nome: string; desc: string; clientes: Cliente[]; abrir: (c: Cliente) => void; aberta: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa });
  const [limite, setLimite] = useState(POR_COLUNA);
  const total = clientes.reduce((s, c) => s + (c.valorLiberado ?? 0), 0);
  return (
    <section ref={setNodeRef} aria-label={nome}
      className={clsx('flex w-[272px] shrink-0 flex-col rounded-xl border bg-fundo transition', isOver ? 'border-marca bg-marca-claro' : 'border-borda', !aberta && 'w-[200px]')}>
      <header className="px-3 pb-2 pt-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{nome}</h2>
          <span className="num rounded-full bg-cartao px-2 text-xs font-semibold text-suave">{clientes.length}</span>
        </div>
        <p className="text-xs text-apagado">{desc}{total > 0 && <> · <span className="num">{brl(total)}</span></>}</p>
      </header>
      <div className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3" style={{ maxHeight: 'calc(100vh - 260px)' }}>
        {aberta ? (
          <>
            {clientes.slice(0, limite).map(c => <Arrastavel key={c.id} c={c} abrir={() => abrir(c)} />)}
            {clientes.length > limite && <button className="bt bt-sm" onClick={() => setLimite(l => l + POR_COLUNA)}>Mostrar mais {Math.min(POR_COLUNA, clientes.length - limite)}</button>}
            {!clientes.length && <div className="rounded-lg border border-dashed border-borda p-4 text-center text-xs text-apagado">Solte um cliente aqui</div>}
          </>
        ) : (
          <div className="flex flex-1 items-center rounded-lg border border-dashed border-borda p-4 text-center text-xs text-apagado">Solte aqui para finalizar sem venda</div>
        )}
      </div>
    </section>
  );
}

export default function Pipeline() {
  const { estado } = useDados();
  const mover = useMoverCliente();
  const [busca, setBusca] = useState('');
  const [produto, setProduto] = useState<'todos' | 'CLT' | 'FGTS'>('todos');
  const [verPerdidos, setVerPerdidos] = useState(false);
  const [pegando, setPegando] = useState<Cliente | null>(null);
  const [aberto, setAberto] = useState<Cliente | null>(null);
  const [perder, setPerder] = useState<Cliente | null>(null);

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const porEtapa = useMemo(() => {
    const q = busca.trim().toLowerCase(), qd = q.replace(/\D/g, '');
    const L = estado!.clientes.filter(c => (produto === 'todos' || c.produto === produto)
      && (!q || c.nome.toLowerCase().includes(q) || (qd.length >= 3 && (c.telefone.includes(qd) || (c.cpf ?? '').includes(qd)))));
    const m = Object.fromEntries(ETAPAS.map(e => [e.id, [] as Cliente[]])) as Record<Etapa, Cliente[]>;
    L.forEach(c => m[c.etapa].push(c));
    Object.values(m).forEach(xs => xs.sort((a, b) => b.ultimaMsgEm.localeCompare(a.ultimaMsgEm)));
    return m;
  }, [estado, busca, produto]);

  const inicio = (e: DragStartEvent) => setPegando(estado!.clientes.find(c => c.id === e.active.id) ?? null);
  const fim = (e: DragEndEvent) => {
    setPegando(null);
    const c = estado!.clientes.find(x => x.id === e.active.id);
    const para = e.over?.id as Etapa | undefined;
    if (!c || !para || para === c.etapa) return;
    if (para === 'perdido') setPerder(c); else mover(c, para);
  };

  return (
    <div>
      <Titulo titulo="Pipeline" sub="Arraste o cartão para mudar o cliente de etapa. Clique para abrir a ficha." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-apagado" />
          <input className="campo w-64 pl-9" placeholder="Nome, telefone ou CPF" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar cliente" />
        </div>
        <select className="campo w-auto" value={produto} onChange={e => setProduto(e.target.value as typeof produto)} aria-label="Produto">
          <option value="todos">CLT e FGTS</option><option value="CLT">Só CLT</option><option value="FGTS">Só FGTS</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-suave"><input type="checkbox" checked={verPerdidos} onChange={e => setVerPerdidos(e.target.checked)} /> Mostrar os perdidos ({porEtapa.perdido.length})</label>
      </div>

      <DndContext sensors={sensores} onDragStart={inicio} onDragEnd={fim} onDragCancel={() => setPegando(null)}
        accessibility={{ announcements: {
          onDragStart: ({ active }) => `Pegou ${estado!.clientes.find(c => c.id === active.id)?.nome}.`,
          onDragOver: ({ over }) => (over ? `Sobre ${ETAPAS.find(e => e.id === over.id)?.nome}.` : 'Fora das colunas.'),
          onDragEnd: ({ over }) => (over ? `Soltou em ${ETAPAS.find(e => e.id === over.id)?.nome}.` : 'Cancelado.'),
          onDragCancel: () => 'Cancelado.',
        } }}>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
          {ETAPAS.map(e => (
            <Coluna key={e.id} etapa={e.id} nome={e.nome} desc={e.desc} clientes={porEtapa[e.id]} abrir={setAberto} aberta={e.id !== 'perdido' || verPerdidos} />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>{pegando && <div className="w-[256px]"><Cartao c={pegando} arrastando /></div>}</DragOverlay>
      </DndContext>

      <Ficha cliente={aberto} fechar={() => setAberto(null)} />
      <MotivoPerda cliente={perder} cancelar={() => setPerder(null)} confirmar={m => { const c = perder!; setPerder(null); mover(c, 'perdido', m); }} />
    </div>
  );
}
