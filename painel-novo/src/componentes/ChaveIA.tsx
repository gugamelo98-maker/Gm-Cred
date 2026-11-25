import { useEffect, useState } from 'react';
import { Bot } from 'lucide-react';
import clsx from 'clsx';
import { token } from '@/api/painel';

const BASE = (import.meta.env.VITE_N8N_WEBHOOK as string | undefined) || 'https://rarelookingorca-n8n.cloudfy.live/webhook';
const ia = async (dados: object = {}) => {
  const r = await fetch(BASE + '/painel/dados', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'ia', k: token.ler(), dados }) });
  const b = await r.json().catch(() => ({}));
  if (!b.ok) throw new Error(b.erro || 'Falha ao falar com o servidor');
  return !!b.ligada;
};

/** Chave geral da IA (só admin): desligada, a IA não responde nenhum cliente. */
export default function ChaveIA() {
  const [ligada, setLigada] = useState<boolean | null>(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    let vivo = true;
    const ler = () => ia().then(v => vivo && setLigada(v)).catch(() => {});
    ler(); const t = setInterval(ler, 30000);
    return () => { vivo = false; clearInterval(t); };
  }, []);
  async function trocar() {
    if (ligada === null) return;
    const nova = !ligada;
    if (!confirm(nova ? 'Ligar a IA? Ela volta a responder os clientes.' : 'Desligar a IA? Ela para de responder TODOS os clientes até você ligar de novo.')) return;
    setSalvando(true);
    try { setLigada(await ia({ ligada: nova })); } catch (e) { alert((e as Error).message); }
    setSalvando(false);
  }
  return (
    <button onClick={trocar} disabled={ligada === null || salvando} aria-pressed={!!ligada}
      className={clsx('mb-2 flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-semibold',
        ligada ? 'border-green-600/40 bg-green-600/10 text-green-700' : 'border-red-600/40 bg-red-600/10 text-red-700')}>
      <span className="flex items-center gap-2"><Bot size={16} /> {ligada === null ? 'IA…' : ligada ? 'IA ligada' : 'IA desligada'}</span>
      <span className={clsx('relative h-5 w-9 rounded-full transition', ligada ? 'bg-green-600' : 'bg-gray-400')}>
        <span className={clsx('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', ligada ? 'left-[18px]' : 'left-0.5')} />
      </span>
    </button>
  );
}
