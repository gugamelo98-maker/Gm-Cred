import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Bot, Check, CheckCheck, Search, Send, UserRound } from 'lucide-react';
import clsx from 'clsx';
import { useDados } from '@/estado/Dados';
import { api } from '@/api';
import type { Cliente, Mensagem } from '@/api/tipos';
import { Etiqueta, Vazio } from '@/componentes/ui';
import { fmtTel, hora, tempoDesde } from '@/util/formato';
import { nomeEtapa } from '@/util/rotulos';
import Ficha, { COR_ETAPA, MotivoPerda, nomeAtendente, useMoverCliente } from '@/telas/clientes/Ficha';

type Filtro = 'todas' | 'nao_lidas' | 'humano' | 'ia';

function Bolha({ m, autor }: { m: Mensagem; autor: string }) {
  const minha = m.de !== 'cliente';
  return (
    <div className={clsx('flex', minha ? 'justify-end' : 'justify-start')}>
      <div className={clsx('max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm', minha ? (m.de === 'ia' ? 'rounded-br-sm bg-marca-claro' : 'rounded-br-sm bg-marca text-white') : 'rounded-bl-sm bg-cartao')}>
        {minha && <div className={clsx('mb-0.5 text-[11px] font-medium', m.de === 'ia' ? 'text-marca' : 'text-white/80')}>{m.de === 'ia' ? 'Ana (IA)' : autor}</div>}
        <div className="whitespace-pre-wrap break-words">{m.texto}</div>
        <div className={clsx('mt-0.5 flex items-center justify-end gap-1 text-[10px]', m.de === 'humano' ? 'text-white/70' : 'text-apagado')}>
          {hora(m.em)}{minha && (m.status === 'lida' ? <CheckCheck size={12} /> : m.status === 'entregue' ? <CheckCheck size={12} className="opacity-60" /> : <Check size={12} />)}
        </div>
      </div>
    </div>
  );
}

export default function Conversas() {
  const { estado, usuario, trocar, executar } = useDados();
  const mover = useMoverCliente();
  const [params, setParams] = useSearchParams();
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [busca, setBusca] = useState('');
  const [msgs, setMsgs] = useState<Mensagem[] | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [ficha, setFicha] = useState(false);
  const [finalizar, setFinalizar] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const atualId = params.get('c');
  const atual = estado!.clientes.find(c => c.id === atualId) ?? null;

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return estado!.clientes.filter(c => c.etapa !== 'perdido' || c.id === atualId)
      .filter(c => filtro === 'todas' || (filtro === 'nao_lidas' && c.naoLidas > 0) || (filtro === 'humano' && c.atendente !== 'ia') || (filtro === 'ia' && c.atendente === 'ia'))
      .filter(c => !q || c.nome.toLowerCase().includes(q) || c.telefone.includes(q.replace(/\D/g, '') || '#'))
      .sort((a, b) => (b.naoLidas > 0 ? 1 : 0) - (a.naoLidas > 0 ? 1 : 0) || b.ultimaMsgEm.localeCompare(a.ultimaMsgEm));
  }, [estado, filtro, busca, atualId]);

  useEffect(() => {
    if (!atualId) { setMsgs(null); return; }
    let vivo = true;
    setMsgs(null);
    api.mensagens(atualId).then(m => vivo && setMsgs(m));
    const c = estado!.clientes.find(x => x.id === atualId);
    if (c?.naoLidas) { api.marcarLida(atualId); trocar('clientes', { ...c, naoLidas: 0 }); }
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atualId]);

  useEffect(() => { fimRef.current?.scrollIntoView({ block: 'end' }); }, [msgs]);

  const abrir = (c: Cliente) => setParams({ c: c.id });

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!atual || !texto.trim()) return;
    setEnviando(true);
    if (atual.atendente === 'ia') {
      const c = await executar(() => api.assumirConversa(atual.id, usuario!.id));
      if (c) trocar('clientes', c);
    }
    const m = await executar(() => api.enviarMensagem(atual.id, texto.trim(), usuario!.id));
    if (m) { setMsgs(xs => [...(xs ?? []), m]); setTexto(''); }
    setEnviando(false);
  }

  async function alternarAtendente() {
    if (!atual) return;
    const para = atual.atendente === 'ia' ? usuario!.id : 'ia';
    const c = await executar(() => api.assumirConversa(atual.id, para), para === 'ia' ? 'Conversa devolvida para a IA' : 'Você assumiu a conversa — a IA parou de responder');
    if (c) trocar('clientes', c);
  }

  const contagem = (f: Filtro) => estado!.clientes.filter(c => c.etapa !== 'perdido' && (f === 'todas' || (f === 'nao_lidas' && c.naoLidas > 0) || (f === 'humano' && c.atendente !== 'ia') || (f === 'ia' && c.atendente === 'ia'))).length;

  return (
    <div className="-my-5 -mx-4 flex h-[calc(100vh-90px)] sm:-mx-6 lg:h-[calc(100vh-30px)]">
      <aside className={clsx('flex w-full flex-col border-r border-borda bg-cartao md:w-[340px] md:shrink-0', atual && 'hidden md:flex')}>
        <div className="space-y-2 border-b border-borda p-3">
          <h1 className="text-lg font-semibold">Conversas</h1>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-apagado" />
            <input className="campo pl-9" placeholder="Buscar nome ou telefone" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar conversa" />
          </div>
          <div className="flex flex-wrap gap-1">
            {([['todas', 'Todas'], ['nao_lidas', 'Não lidas'], ['humano', 'Com humano'], ['ia', 'Com IA']] as [Filtro, string][]).map(([f, n]) => (
              <button key={f} onClick={() => setFiltro(f)} className={clsx('rounded-full px-2.5 py-1 text-xs font-medium', filtro === f ? 'bg-marca text-white' : 'bg-fundo text-suave')}>{n} <span className="num">{contagem(f)}</span></button>
            ))}
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {lista.slice(0, 150).map(c => (
            <li key={c.id}>
              <button onClick={() => abrir(c)} className={clsx('flex w-full items-start gap-3 border-b border-borda px-3 py-2.5 text-left hover:bg-fundo', c.id === atualId && 'bg-marca-claro')}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fundo text-sm font-semibold text-suave">{c.nome[0]}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={clsx('truncate text-sm', c.naoLidas ? 'font-semibold' : 'font-medium')}>{c.nome}</span>
                    <span className="shrink-0 text-[11px] text-apagado">{tempoDesde(c.ultimaMsgEm)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-apagado">{c.atendente === 'ia' ? '🤖 ' : '👤 '}{c.situacao}</span>
                    {c.naoLidas > 0 && <span className="num rounded-full bg-marca px-1.5 text-[11px] font-semibold text-white">{c.naoLidas}</span>}
                  </div>
                </div>
              </button>
            </li>
          ))}
          {!lista.length && <li className="p-4"><Vazio>Nenhuma conversa.</Vazio></li>}
        </ul>
      </aside>

      <section className={clsx('min-w-0 flex-1 flex-col bg-fundo', atual ? 'flex' : 'hidden md:flex')}>
        {!atual ? <div className="m-auto text-sm text-apagado">Escolha uma conversa.</div> : (
          <>
            <header className="flex flex-wrap items-center gap-2 border-b border-borda bg-cartao px-3 py-2">
              <button className="rounded p-1 md:hidden" onClick={() => setParams({})} aria-label="Voltar"><ArrowLeft size={18} /></button>
              <button className="min-w-0 flex-1 text-left" onClick={() => setFicha(true)}>
                <div className="truncate font-medium">{atual.nome}</div>
                <div className="num truncate text-xs text-apagado">{fmtTel(atual.telefone)} · {atual.produto}</div>
              </button>
              <Etiqueta cor={COR_ETAPA[atual.etapa]}>{nomeEtapa(atual.etapa)}</Etiqueta>
              <button className="bt bt-sm" onClick={alternarAtendente}>
                {atual.atendente === 'ia' ? <><UserRound size={14} /> Assumir</> : <><Bot size={14} /> Devolver para IA</>}
              </button>
              {atual.etapa !== 'perdido' && <button className="bt bt-sm" onClick={() => setFinalizar(true)}>Finalizar</button>}
            </header>
            <div className={clsx('px-4 py-1.5 text-center text-xs', atual.atendente === 'ia' ? 'bg-marca-claro text-marca' : 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200')}>
              {atual.atendente === 'ia' ? 'A IA (Ana) está respondendo. Se você mandar uma mensagem, assume a conversa.' : `Atendimento humano: ${nomeAtendente(atual.atendente, estado!.usuarios)}. A IA não responde enquanto estiver assim.`}
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {!msgs ? <div className="text-center text-sm text-apagado">Carregando mensagens…</div> : msgs.map(m => <Bolha key={m.id} m={m} autor={m.autor ? nomeAtendente(m.autor, estado!.usuarios) : 'Atendente'} />)}
              <div ref={fimRef} />
            </div>
            <form onSubmit={enviar} className="flex items-end gap-2 border-t border-borda bg-cartao p-3">
              <textarea className="campo max-h-32 min-h-[40px] flex-1 resize-none" rows={1} placeholder="Escreva uma mensagem… (Enter envia, Shift+Enter quebra linha)" value={texto}
                onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} aria-label="Mensagem" />
              <button className="bt bt-pri h-10" disabled={enviando || !texto.trim()} aria-label="Enviar"><Send size={16} /></button>
            </form>
          </>
        )}
      </section>

      {ficha && <Ficha cliente={atual} fechar={() => setFicha(false)} />}
      <MotivoPerda cliente={finalizar ? atual : null} cancelar={() => setFinalizar(false)} confirmar={m => { setFinalizar(false); if (atual) mover(atual, 'perdido', m); }} />
    </div>
  );
}
