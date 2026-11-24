import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useDados } from '@/estado/Dados';
import { api } from '@/api';
import type { RespostaPronta } from '@/api/tipos';
import { Modal, Vazio } from '@/componentes/ui';

/** Troca {nome} pelo primeiro nome do cliente. */
export const preencher = (texto: string, nomeCliente: string) => texto.replace(/\{nome\}/g, nomeCliente.split(' ')[0] || '');

export default function RespostasProntas({ aberto, fechar }: { aberto: boolean; fechar: () => void }) {
  const { estado, trocar, remover, executar } = useDados();
  const [editando, setEditando] = useState<Partial<RespostaPronta> | null>(null);

  async function salvar() {
    if (!editando?.titulo?.trim() || !editando.texto?.trim() || !editando.atalho?.trim()) return;
    const r = await executar(() => api.salvarResposta(editando), 'Mensagem pronta salva');
    if (r) { trocar('respostas', r); setEditando(null); }
  }
  async function apagar(r: RespostaPronta) {
    if (!confirm(`Apagar a mensagem pronta /${r.atalho}?`)) return;
    const ok = await executar(async () => { await api.apagarResposta(r.id); return true; }, 'Apagada');
    if (ok) remover('respostas', r.id);
  }

  return (
    <Modal aberto={aberto} fechar={fechar} titulo="Mensagens prontas" largura="max-w-2xl"
      rodape={editando
        ? <><button className="bt" onClick={() => setEditando(null)}>Voltar</button><button className="bt bt-pri" onClick={salvar} disabled={!editando.titulo?.trim() || !editando.texto?.trim() || !editando.atalho?.trim()}>Salvar</button></>
        : <button className="bt bt-pri" onClick={() => setEditando({})}><Plus size={16} /> Nova mensagem pronta</button>}>
      {editando ? (
        <div className="space-y-3">
          <div className="grid grid-cols-[140px_1fr] gap-3">
            <div><label className="rotulo" htmlFor="ra">Atalho</label>
              <div className="flex items-center"><span className="mr-1 text-apagado">/</span><input id="ra" className="campo" placeholder="cpf" value={editando.atalho ?? ''} onChange={e => setEditando({ ...editando, atalho: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })} /></div></div>
            <div><label className="rotulo" htmlFor="rt">Título</label><input id="rt" className="campo" placeholder="Pedir CPF" value={editando.titulo ?? ''} onChange={e => setEditando({ ...editando, titulo: e.target.value })} /></div>
          </div>
          <div><label className="rotulo" htmlFor="rx">Texto</label>
            <textarea id="rx" className="campo min-h-[120px]" value={editando.texto ?? ''} onChange={e => setEditando({ ...editando, texto: e.target.value })} />
            <p className="mt-1 text-xs text-apagado">Use <code>{'{nome}'}</code> para o primeiro nome do cliente.</p></div>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-suave">Na conversa, digite <b>/</b> e o atalho (ex.: <code>/cpf</code>) ou clique no raio ⚡ para escolher.</p>
          {!estado!.respostas.length ? <Vazio>Nenhuma mensagem pronta ainda.</Vazio> : (
            <ul className="divide-y divide-borda">
              {estado!.respostas.map(r => (
                <li key={r.id} className="flex items-start gap-3 py-2.5">
                  <code className="mt-0.5 shrink-0 rounded bg-fundo px-1.5 py-0.5 text-xs">/{r.atalho}</code>
                  <div className="min-w-0 flex-1"><div className="text-sm font-medium">{r.titulo}</div><div className="line-clamp-2 text-xs text-apagado">{r.texto}</div></div>
                  <button className="rounded p-1 text-apagado hover:bg-fundo" onClick={() => setEditando(r)} aria-label={`Editar ${r.titulo}`}><Pencil size={15} /></button>
                  <button className="rounded p-1 text-apagado hover:bg-fundo hover:text-red-600" onClick={() => apagar(r)} aria-label={`Apagar ${r.titulo}`}><Trash2 size={15} /></button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}
