import { useState } from 'react';
import { Check, CheckCheck, Download, FileText, Lock, Mic } from 'lucide-react';
import clsx from 'clsx';
import type { Mensagem, Midia } from '@/api/tipos';
import { Modal } from '@/componentes/ui';
import { hora } from '@/util/formato';

export const tamanho = (b: number) => (b >= 1048576 ? (b / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
const duracao = (s?: number) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '');

function ConteudoMidia({ m, escura }: { m: Midia; escura: boolean }) {
  const [ampliar, setAmpliar] = useState(false);
  if (m.tipo === 'imagem') return (
    <>
      <button className="block overflow-hidden rounded-lg" onClick={() => setAmpliar(true)} aria-label={`Ampliar imagem ${m.nome}`}>
        <img src={m.url} alt={m.nome} className="max-h-72 w-full max-w-[260px] bg-white object-cover" loading="lazy" />
      </button>
      <Modal aberto={ampliar} fechar={() => setAmpliar(false)} titulo={m.nome} largura="max-w-3xl"
        rodape={<a className="bt" href={m.url} download={m.nome}><Download size={16} /> Baixar</a>}>
        <img src={m.url} alt={m.nome} className="mx-auto max-h-[70vh] bg-white" />
      </Modal>
    </>
  );
  if (m.tipo === 'audio') return (
    <div className="flex items-center gap-2">
      {m.voz && <Mic size={16} className={escura ? 'text-white/80' : 'text-marca'} aria-label="Mensagem de voz" />}
      <audio controls preload="metadata" src={m.url} className="h-10 w-[240px] max-w-full" aria-label={`Áudio ${duracao(m.duracaoSeg)}`} />
    </div>
  );
  if (m.tipo === 'video') return <video controls preload="metadata" src={m.url} className="max-h-72 w-full max-w-[280px] rounded-lg bg-black" />;
  return (
    <a href={m.url} download={m.nome} className={clsx('flex min-w-[220px] items-center gap-3 rounded-lg p-2', escura ? 'bg-white/15 hover:bg-white/25' : 'bg-fundo hover:bg-borda')}>
      <FileText size={28} className={escura ? 'text-white' : 'text-red-600'} />
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{m.nome}</span><span className={clsx('text-xs', escura ? 'text-white/70' : 'text-apagado')}>{m.mime === 'application/pdf' ? 'PDF' : m.mime.split('/')[1]?.toUpperCase()} · {tamanho(m.tamanho)}</span></span>
      <Download size={16} aria-label="Baixar" />
    </a>
  );
}

export default function Bolha({ m, autor }: { m: Mensagem; autor: string }) {
  if (m.de === 'nota') return (
    <div className="flex justify-center">
      <div className="max-w-[85%] rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
        <div className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold"><Lock size={11} /> Nota interna · {autor} · {hora(m.em)}</div>
        <div className="whitespace-pre-wrap break-words">{m.texto}</div>
        <div className="mt-0.5 text-[10px] opacity-70">Só a equipe vê. Não vai para o cliente.</div>
      </div>
    </div>
  );
  const minha = m.de !== 'cliente';
  const escura = m.de === 'humano';
  return (
    <div className={clsx('flex', minha ? 'justify-end' : 'justify-start')}>
      <div className={clsx('max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm', minha ? (m.de === 'ia' ? 'rounded-br-sm bg-marca-claro' : 'rounded-br-sm bg-marca text-white') : 'rounded-bl-sm bg-cartao')}>
        {minha && <div className={clsx('mb-0.5 text-[11px] font-medium', m.de === 'ia' ? 'text-marca' : 'text-white/80')}>{m.de === 'ia' ? 'Ana (IA)' : autor}</div>}
        {m.midia && <div className={m.texto ? 'mb-1.5' : ''}><ConteudoMidia m={m.midia} escura={escura} /></div>}
        {m.texto && <div className="whitespace-pre-wrap break-words">{m.texto}</div>}
        <div className={clsx('mt-0.5 flex items-center justify-end gap-1 text-[10px]', escura ? 'text-white/70' : 'text-apagado')}>
          {hora(m.em)}
          {minha && (m.status === 'lida' ? <CheckCheck size={12} aria-label="Lida" /> : m.status === 'entregue' ? <CheckCheck size={12} className="opacity-60" aria-label="Entregue" /> : m.status === 'erro' ? <span className="text-red-300">não enviada</span> : <Check size={12} aria-label="Enviada" />)}
        </div>
      </div>
    </div>
  );
}
