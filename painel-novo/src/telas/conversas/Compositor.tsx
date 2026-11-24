import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { FileText, Lock, Mic, Paperclip, Send, Square, Trash2, X, Zap } from 'lucide-react';
import clsx from 'clsx';
import { useDados } from '@/estado/Dados';
import { api } from '@/api';
import type { Anexo, Cliente, Mensagem } from '@/api/tipos';
import { podeEscreverNota, podeGerenciarRespostas } from '@/util/permissoes';
import { lerComoDataUrl, useGravador } from './useGravador';
import { tamanho } from './Bolha';
import RespostasProntas, { preencher } from './RespostasProntas';

const LIMITE = 16 * 1024 * 1024; // limite de mídia do WhatsApp
const ACEITOS = 'image/*,application/pdf,audio/*,video/*,.doc,.docx,.xls,.xlsx,.txt';

interface Props {
  cliente: Cliente;
  /** chamado antes de mandar algo para o cliente (assume a conversa se a IA estiver atendendo) */
  antesDeEnviar: () => Promise<void>;
  enviado: (m: Mensagem) => void;
  /** arquivo arrastado para cima do chat */
  arquivoSolto: File | null;
  limparSolto: () => void;
}

export default function Compositor({ cliente, antesDeEnviar, enviado, arquivoSolto, limparSolto }: Props) {
  const { estado, usuario, executar, avisar } = useDados();
  const [modo, setModo] = useState<'msg' | 'nota'>('msg');
  const [texto, setTexto] = useState('');
  const [anexo, setAnexo] = useState<Anexo | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sel, setSel] = useState(0);
  const [gerenciar, setGerenciar] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const grav = useGravador();
  const nota = modo === 'nota';

  // troca de conversa: limpa o que estava sendo escrito
  useEffect(() => { setTexto(''); setAnexo(null); setModo('msg'); grav.cancelar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [cliente.id]);
  useEffect(() => { if (grav.erro) { avisar(grav.erro, 'erro'); grav.limparErro(); } }, [grav, avisar]);
  useEffect(() => { if (arquivoSolto) { carregar(arquivoSolto); limparSolto(); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [arquivoSolto]);

  // menu de mensagens prontas: aparece quando o texto começa com "/"
  const busca = !nota && /^\/\S*$/.test(texto) ? texto.slice(1).toLowerCase() : null;
  const opcoes = useMemo(() => busca === null ? [] : estado!.respostas.filter(r => r.atalho.includes(busca) || r.titulo.toLowerCase().includes(busca)), [busca, estado]);
  useEffect(() => setSel(0), [busca]);

  async function carregar(f: File) {
    if (nota) setModo('msg');
    if (f.size > LIMITE) return avisar(`“${f.name}” tem ${tamanho(f.size)}. O WhatsApp aceita até 16 MB.`, 'erro');
    setAnexo({ nome: f.name, mime: f.type || 'application/octet-stream', tamanho: f.size, dados: await lerComoDataUrl(f) });
    campo.current?.focus();
  }

  function escolher(i: number) {
    const r = opcoes[i];
    if (!r) return;
    setTexto(preencher(r.texto, cliente.nome));
    requestAnimationFrame(() => campo.current?.focus());
  }

  async function mandar(a: Anexo | null, t: string) {
    setEnviando(true);
    try {
      if (nota) {
        const m = await executar(() => api.adicionarNota(cliente.id, t, usuario!.id));
        if (m) { enviado(m); setTexto(''); }
        return;
      }
      await antesDeEnviar();
      const m = await executar(() => (a ? api.enviarMidia(cliente.id, a, t, usuario!.id) : api.enviarMensagem(cliente.id, t, usuario!.id)));
      if (m) { enviado(m); setTexto(''); setAnexo(null); }
    } finally { setEnviando(false); }
  }

  function enviar(e?: FormEvent) {
    e?.preventDefault();
    if (enviando || busca !== null && opcoes.length) return;
    const t = texto.trim();
    if (!t && !anexo) return;
    mandar(anexo, t);
  }

  async function pararEEnviar() {
    const a = await grav.parar();
    if (a) mandar(a, '');
  }

  const podeNota = podeEscreverNota(usuario!);
  const temConteudo = !!texto.trim() || !!anexo;

  return (
    <div className={clsx('border-t border-borda p-3', nota ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-cartao')}>
      {podeNota && (
        <div className="mb-2 flex gap-1 text-xs" role="tablist" aria-label="Tipo de mensagem">
          <button role="tab" aria-selected={!nota} onClick={() => setModo('msg')} className={clsx('rounded-full px-3 py-1 font-medium', !nota ? 'bg-marca text-white' : 'text-suave hover:bg-fundo')}>Mensagem para o cliente</button>
          <button role="tab" aria-selected={nota} onClick={() => { setModo('nota'); setAnexo(null); campo.current?.focus(); }} className={clsx('inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium', nota ? 'bg-amber-500 text-white' : 'text-suave hover:bg-fundo')}><Lock size={12} /> Nota interna</button>
        </div>
      )}

      {anexo && (
        <div className="mb-2 flex items-center gap-3 rounded-lg border border-borda bg-fundo p-2">
          {anexo.mime.startsWith('image/') ? <img src={anexo.dados} alt="" className="h-14 w-14 rounded object-cover" /> : <FileText size={32} className="text-red-600" />}
          <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{anexo.nome}</div><div className="text-xs text-apagado">{tamanho(anexo.tamanho)} · o texto abaixo vai como legenda</div></div>
          <button className="rounded p-1 text-apagado hover:bg-borda" onClick={() => setAnexo(null)} aria-label="Tirar anexo"><X size={16} /></button>
        </div>
      )}

      {grav.gravando ? (
        <div className="flex items-center gap-3">
          <button className="bt h-10" onClick={grav.cancelar} aria-label="Descartar áudio"><Trash2 size={16} /></button>
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" /> Gravando… <span className="num">{Math.floor(grav.segundos / 60)}:{String(grav.segundos % 60).padStart(2, '0')}</span>
          </div>
          <button className="bt bt-pri h-10" onClick={pararEEnviar} aria-label="Parar e enviar áudio"><Square size={14} /> <Send size={16} /></button>
        </div>
      ) : (
        <form onSubmit={enviar} className="relative flex items-end gap-2">
          {busca !== null && (
            <div className="absolute bottom-full left-0 z-20 mb-2 w-full max-w-md overflow-hidden rounded-lg border border-borda bg-cartao shadow-xl" role="listbox" aria-label="Mensagens prontas">
              {opcoes.length ? opcoes.slice(0, 8).map((r, i) => (
                <button type="button" role="option" aria-selected={i === sel} key={r.id} onMouseDown={e => { e.preventDefault(); escolher(i); }} onMouseEnter={() => setSel(i)}
                  className={clsx('block w-full px-3 py-2 text-left', i === sel && 'bg-marca-claro')}>
                  <div className="text-sm"><code className="text-marca">/{r.atalho}</code> <span className="font-medium">{r.titulo}</span></div>
                  <div className="truncate text-xs text-apagado">{preencher(r.texto, cliente.nome)}</div>
                </button>
              )) : <div className="px-3 py-2 text-sm text-apagado">Nenhuma mensagem pronta com “{busca}”.</div>}
              {podeGerenciarRespostas(usuario!) && <button type="button" className="block w-full border-t border-borda px-3 py-2 text-left text-xs text-marca hover:bg-fundo" onMouseDown={e => { e.preventDefault(); setTexto(''); setGerenciar(true); }}>Gerenciar mensagens prontas…</button>}
            </div>
          )}

          {!nota && <>
            <button type="button" className="bt h-10 px-2.5" title="Mensagens prontas (/)" aria-label="Mensagens prontas" onClick={() => { setTexto('/'); campo.current?.focus(); }}><Zap size={16} /></button>
            <button type="button" className="bt h-10 px-2.5" title="Anexar imagem, PDF, áudio ou vídeo" aria-label="Anexar arquivo" onClick={() => arquivo.current?.click()}><Paperclip size={16} /></button>
            <input ref={arquivo} type="file" accept={ACEITOS} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) carregar(f); e.target.value = ''; }} />
          </>}
          <textarea ref={campo} rows={1} value={texto} onChange={e => setTexto(e.target.value)} aria-label={nota ? 'Nota interna' : 'Mensagem'}
            className={clsx('campo max-h-36 min-h-[40px] flex-1 resize-none', nota && 'border-amber-300')}
            placeholder={nota ? 'Nota interna: só a equipe vê…' : anexo ? 'Legenda (opcional)…' : 'Mensagem ou /atalho'}
            onPaste={e => { const f = e.clipboardData.files?.[0]; if (f) { e.preventDefault(); carregar(f); } }}
            onKeyDown={e => {
              if (busca !== null && opcoes.length) {
                if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => (s + 1) % Math.min(8, opcoes.length)); return; }
                if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => (s - 1 + Math.min(8, opcoes.length)) % Math.min(8, opcoes.length)); return; }
                if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); escolher(sel); return; }
              }
              if (e.key === 'Escape' && busca !== null) { setTexto(''); return; }
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
            }} />
          {!nota && !temConteudo
            ? <button type="button" className="bt bt-pri h-10" onClick={grav.comecar} aria-label="Gravar áudio" title="Gravar áudio"><Mic size={16} /></button>
            : <button className={clsx('bt h-10', nota ? 'border-amber-500 bg-amber-500 text-white hover:bg-amber-600' : 'bt-pri')} disabled={enviando || !temConteudo} aria-label={nota ? 'Salvar nota' : 'Enviar'}>{nota ? <Lock size={16} /> : <Send size={16} />}</button>}
        </form>
      )}
      <RespostasProntas aberto={gerenciar} fechar={() => setGerenciar(false)} />
    </div>
  );
}
