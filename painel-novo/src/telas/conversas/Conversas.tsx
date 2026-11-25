import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Bot, FileUp, MessageSquarePlus, Mic, Paperclip, Search, UserRound } from 'lucide-react';
import clsx from 'clsx';
import { useDados } from '@/estado/Dados';
import { api } from '@/api';
import type { Cliente, Mensagem } from '@/api/tipos';
import { Etiqueta, Modal, Vazio } from '@/componentes/ui';
import { fmtTel, tempoDesde } from '@/util/formato';
import { nomeEtapa } from '@/util/rotulos';
import { clientesVisiveis, podeDefinirResponsavel } from '@/util/permissoes';
import Ficha, { COR_ETAPA, MotivoPerda, nomeAtendente, useMoverCliente } from '@/telas/clientes/Ficha';
import Bolha from './Bolha';
import Compositor from './Compositor';

type Filtro = 'todas' | 'nao_lidas' | 'minhas' | 'sem_resp' | 'humano' | 'ia';

/** Prévia da última mensagem na lista (texto, ou o tipo da mídia). */
function previa(m: Mensagem | undefined, c: Cliente) {
  if (!m) return c.situacao;
  if (m.midia) return { imagem: '📷 Foto', audio: '🎤 Áudio', video: '🎬 Vídeo', documento: '📄 ' + m.midia.nome }[m.midia.tipo];
  return m.texto;
}

export default function Conversas() {
  const { estado, usuario, trocar, definir, executar } = useDados();
  const mover = useMoverCliente();
  const [params, setParams] = useSearchParams();
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [busca, setBusca] = useState('');
  const [msgs, setMsgs] = useState<Mensagem[] | null>(null);
  const [ultimas, setUltimas] = useState<Record<string, Mensagem>>({});
  const [ficha, setFicha] = useState(false);
  const [finalizar, setFinalizar] = useState(false);
  const [solto, setSolto] = useState<File | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [nova, setNova] = useState(false);
  const [resp, setResp] = useState(params.get('resp') ?? '');
  const fimRef = useRef<HTMLDivElement>(null);
  const eu = usuario!;
  const gestor = podeDefinirResponsavel(eu);

  const visiveis = useMemo(() => clientesVisiveis(estado!, eu), [estado, eu]);
  const atualId = params.get('c');
  const atual = visiveis.find(c => c.id === atualId) ?? null;

  const passa = (c: Cliente, f: Filtro) => f === 'todas' || (f === 'nao_lidas' && c.naoLidas > 0) || (f === 'minhas' && c.responsavel === eu.id)
    || (f === 'sem_resp' && !c.responsavel) || (f === 'humano' && c.atendente !== 'ia') || (f === 'ia' && c.atendente === 'ia');
  // pagos e perdidos saem da lista de conversas (só voltam se o cliente mandar mensagem nova)
  const ativas = useMemo(() => visiveis.filter(c => (!['perdido', 'posvenda'].includes(c.etapa) || c.naoLidas > 0) && (!resp || c.responsavel === resp)), [visiveis, resp]);
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase(), qd = q.replace(/\D/g, '');
    return [...ativas, ...(atual && !ativas.includes(atual) ? [atual] : [])]
      .filter(c => passa(c, filtro))
      .filter(c => !q || c.nome.toLowerCase().includes(q) || (qd.length >= 3 && c.telefone.includes(qd)))
      .sort((a, b) => (b.naoLidas > 0 ? 1 : 0) - (a.naoLidas > 0 ? 1 : 0) || b.ultimaMsgEm.localeCompare(a.ultimaMsgEm));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativas, atual, filtro, busca, eu.id]);

  useEffect(() => {
    if (!atualId || !atual) { setMsgs(null); return; }
    let vivo = true;
    setMsgs(null);
    api.mensagens(atualId).then(m => { if (!vivo) return; setMsgs(m); setUltimas(u => ({ ...u, [atualId]: m.filter(x => x.de !== 'nota').at(-1)! })); });
    if (atual.naoLidas) { api.marcarLida(atualId); trocar('clientes', { ...atual, naoLidas: 0 }); }
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atualId, !!atual]);

  useEffect(() => { fimRef.current?.scrollIntoView({ block: 'end' }); }, [msgs]);

  async function assumir(para: string) {
    if (!atual) return;
    const c = await executar(() => api.assumirConversa(atual.id, para), para === 'ia' ? 'Conversa devolvida para a IA' : 'Você assumiu a conversa: a IA parou de responder');
    if (c) trocar('clientes', c);
  }
  async function responsavel(id: string) {
    if (!atual) return;
    const c = await executar(() => api.definirResponsavel(atual.id, id || null), id ? `Responsável: ${nomeAtendente(id, estado!.usuarios)}` : 'Conversa sem responsável');
    if (c) trocar('clientes', c);
  }
  function chegou(m: Mensagem) {
    setMsgs(xs => [...(xs ?? []), m]);
    if (m.de === 'nota' || !atual) return;
    // atualiza a partir do estado mais novo (assumir a conversa pode ter acabado de mudar o cliente)
    definir(e => ({ ...e, clientes: e.clientes.map(c => (c.id === atual.id ? { ...c, ultimaMsgEm: m.em } : c)) }));
    setUltimas(u => ({ ...u, [atual.id]: m }));
  }

  const numeroDe = (c: Cliente) => { const n = estado!.numeros.find(x => x.id === c.numeroId); return n ? (n.telefone ? fmtTel(n.telefone) : n.sessao) : ''; };
  const FILTROS: [Filtro, string][] = [['todas', 'Todas'], ['nao_lidas', 'Não lidas'], ['minhas', 'Minhas'], ...(eu.escopo === 'todos' ? [['sem_resp', 'Sem responsável'] as [Filtro, string]] : []), ['humano', 'Com humano'], ['ia', 'Com IA']];
  const atendentes = estado!.usuarios.filter(u => u.ativo);

  return (
    <div className="-mx-4 -my-5 flex h-[calc(100dvh-90px)] sm:-mx-6 lg:h-[calc(100dvh-30px)]">
      <aside className={clsx('flex w-full flex-col border-r border-borda bg-cartao md:w-[340px] md:shrink-0', atual && 'hidden md:flex')}>
        <div className="space-y-2 border-b border-borda p-3">
          <div className="flex items-center justify-between"><h1 className="text-lg font-semibold">Conversas</h1><button className="bt bt-pri !px-2.5 !py-1.5 text-xs" onClick={() => setNova(true)}><MessageSquarePlus size={15} /> Nova conversa</button></div>
          {eu.escopo === 'proprios' && <p className="text-xs text-apagado">Você vê só as conversas dos clientes sob sua responsabilidade.</p>}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-apagado" />
            <input className="campo pl-9" placeholder="Buscar nome ou telefone" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar conversa" />
          </div>
          {gestor && eu.escopo === 'todos' && (
            <select className="campo" value={resp} onChange={e => setResp(e.target.value)} aria-label="Conversas de qual atendente">
              <option value="">Todos os atendentes</option>
              {estado!.usuarios.filter(u => u.ativo).map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          )}
          <div className="flex flex-wrap gap-1">
            {FILTROS.map(([f, n]) => (
              <button key={f} onClick={() => setFiltro(f)} className={clsx('rounded-full px-2.5 py-1 text-xs font-medium', filtro === f ? 'bg-marca text-white' : 'bg-fundo text-suave')}>{n} <span className="num">{ativas.filter(c => passa(c, f)).length}</span></button>
            ))}
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {lista.slice(0, 200).map(c => (
            <li key={c.id}>
              <button onClick={() => setParams({ c: c.id })} className={clsx('flex w-full items-start gap-3 border-b border-borda px-3 py-2.5 text-left hover:bg-fundo', c.id === atualId && 'bg-marca-claro')}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fundo text-sm font-semibold text-suave">{c.nome[0]}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-baseline gap-1.5"><span className={clsx('truncate text-sm', c.naoLidas ? 'font-semibold' : 'font-medium')}>{c.nome}</span>{numeroDe(c) && <span className="num shrink-0 text-[10px] text-apagado" title="Número que está atendendo">📱 {numeroDe(c)}</span>}</span>
                    <span className="shrink-0 text-[11px] text-apagado">{tempoDesde(c.ultimaMsgEm)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-apagado">{c.atendente === 'ia' ? '🤖 ' : '👤 '}{previa(ultimas[c.id], c)}</span>
                    {c.naoLidas > 0 && <span className="num rounded-full bg-marca px-1.5 text-[11px] font-semibold text-white">{c.naoLidas}</span>}
                  </div>
                  {gestor && <div className="mt-0.5 truncate text-[11px] text-apagado">{c.responsavel ? 'Resp.: ' + nomeAtendente(c.responsavel, estado!.usuarios) : 'Sem responsável'}</div>}
                </div>
              </button>
            </li>
          ))}
          {!lista.length && <li className="p-4"><Vazio>{eu.escopo === 'proprios' && filtro === 'todas' ? 'Nenhum cliente sob sua responsabilidade ainda.' : 'Nenhuma conversa.'}</Vazio></li>}
        </ul>
      </aside>

      <section className={clsx('relative min-w-0 flex-1 flex-col bg-fundo', atual ? 'flex' : 'hidden md:flex')}
        onDragOver={e => { if (atual && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setArrastando(true); } }}
        onDragLeave={e => { if (e.currentTarget === e.target) setArrastando(false); }}
        onDrop={e => { e.preventDefault(); setArrastando(false); const f = e.dataTransfer.files?.[0]; if (f) setSolto(f); }}>
        {!atual ? (
          <div className="m-auto max-w-xs text-center text-sm text-apagado">
            Escolha uma conversa.
            <div className="mt-3 flex justify-center gap-4 text-xs"><span className="inline-flex items-center gap-1"><Paperclip size={14} /> foto e PDF</span><span className="inline-flex items-center gap-1"><Mic size={14} /> áudio</span><span>/ mensagens prontas</span></div>
          </div>
        ) : (
          <>
            <header className="flex flex-wrap items-center gap-2 border-b border-borda bg-cartao px-3 py-2">
              <button className="rounded p-1 md:hidden" onClick={() => setParams({})} aria-label="Voltar"><ArrowLeft size={18} /></button>
              <button className="min-w-0 flex-1 text-left" onClick={() => setFicha(true)} title="Abrir ficha do cliente">
                <div className="flex min-w-0 items-baseline gap-2"><span className="truncate font-medium">{atual.nome}</span>{numeroDe(atual) && <span className="num shrink-0 rounded-full bg-marca-claro px-2 py-0.5 text-[11px] font-semibold text-marca" title="Número que está atendendo este cliente">📱 {numeroDe(atual)}</span>}</div>
                <div className="num truncate text-xs text-apagado">{fmtTel(atual.telefone)} · {atual.produto}</div>
              </button>
              <Etiqueta cor={COR_ETAPA[atual.etapa]}>{nomeEtapa(atual.etapa)}</Etiqueta>
              {gestor && (
                <select className="campo w-auto py-1 text-xs" value={atual.responsavel ?? ''} onChange={e => responsavel(e.target.value)} aria-label="Responsável pelo cliente">
                  <option value="">Sem responsável</option>
                  {atendentes.map(u => <option key={u.id} value={u.id}>Resp.: {u.nome}</option>)}
                </select>
              )}
              <button className="bt bt-sm" onClick={() => assumir(atual.atendente === 'ia' ? eu.id : 'ia')}>
                {atual.atendente === 'ia' ? <><UserRound size={14} /> Assumir</> : <><Bot size={14} /> Devolver para IA</>}
              </button>
              {atual.etapa !== 'perdido' && <button className="bt bt-sm" onClick={() => setFinalizar(true)}>Finalizar</button>}
            </header>
            <div className={clsx('px-4 py-1.5 text-center text-xs', atual.atendente === 'ia' ? 'bg-marca-claro text-marca' : 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200')}>
              {atual.atendente === 'ia' ? 'A IA (Ana) está respondendo. Se você mandar uma mensagem, assume a conversa.' : `Atendimento humano: ${nomeAtendente(atual.atendente, estado!.usuarios)}. A IA não responde enquanto estiver assim.`}
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {!msgs ? <div className="text-center text-sm text-apagado">Carregando mensagens…</div>
                : msgs.map(m => <Bolha key={m.id} m={m} autor={m.autor ? nomeAtendente(m.autor, estado!.usuarios) : 'Atendente'} />)}
              <div ref={fimRef} />
            </div>
            <Compositor cliente={atual} enviado={chegou} arquivoSolto={solto} limparSolto={() => setSolto(null)}
              antesDeEnviar={async () => { if (atual.atendente === 'ia') { const c = await api.assumirConversa(atual.id, eu.id); trocar('clientes', c); } }} />
            {arrastando && (
              <div className="pointer-events-none absolute inset-2 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-marca bg-marca-claro text-marca">
                <FileUp size={32} /> <b>Solte para anexar</b>
              </div>
            )}
          </>
        )}
      </section>

      {ficha && <Ficha cliente={atual} fechar={() => setFicha(false)} />}
      <MotivoPerda cliente={finalizar ? atual : null} cancelar={() => setFinalizar(false)} confirmar={m => { setFinalizar(false); if (atual) mover(atual, 'perdido', m); }} />
    {nova && <NovaConversa fechar={() => setNova(false)} abrir={c => { trocar('clientes', c); if (!estado!.clientes.some(x => x.id === c.id)) definir(e => ({ ...e, clientes: [c, ...e.clientes] })); setNova(false); setParams({ c: c.id }); }} />}
    </div>
  );
}

function NovaConversa({ fechar, abrir }: { fechar: () => void; abrir: (c: Cliente) => void }) {
  const { usuario, executar } = useDados();
  const [tel, setTel] = useState(''), [nome, setNome] = useState(''), [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setEnviando(true);
    const c = await executar(() => api.novaConversa(tel, nome, texto, usuario!.id), 'Mensagem enviada');
    setEnviando(false); if (c) abrir(c);
  }
  return (
    <Modal aberto fechar={fechar} titulo="Nova conversa" largura="max-w-sm">
      <form onSubmit={enviar} className="space-y-3">
        <label className="block text-sm">Telefone (DDD + número)<input className="campo mt-1" inputMode="tel" placeholder="48 99999-9999" value={tel} onChange={e => setTel(e.target.value)} required autoFocus /></label>
        <label className="block text-sm">Nome (opcional)<input className="campo mt-1" value={nome} onChange={e => setNome(e.target.value)} /></label>
        <label className="block text-sm">Mensagem<textarea className="campo mt-1 min-h-[90px]" value={texto} onChange={e => setTexto(e.target.value)} required /></label>
        <button className="bt bt-pri w-full" disabled={enviando || tel.replace(/\D/g, '').length < 10 || !texto.trim()}>{enviando ? 'Enviando…' : 'Enviar'}</button>
      </form>
    </Modal>
  );
}
