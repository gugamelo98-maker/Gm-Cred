import { useEffect, useState } from 'react';
import { dadosPost } from '@/api/aoVivo';
import { PARTES } from '@/api/motor';
import { useDados } from '@/estado/Dados';
import { Etiqueta, Vazio } from '@/componentes/ui';
import { fmtCpf } from '@/util/formato';

interface Item { id: number; cpf: string; cliente: string; em: string; usuario: string | null; usuarioNome: string; comOferta: string[]; semMargem: number; digitado: boolean }
const nomeParte = (id: string) => { const p = PARTES.find(x => x.id === id); return p ? `${p.banco} ${p.produto}` : id; };

/** Admin/gestor: quem consultou cada CPF no Motor e o resultado. */
export default function Historico() {
  const { estado } = useDados();
  const [dias, setDias] = useState(7);
  const [quem, setQuem] = useState('');
  const [itens, setItens] = useState<Item[] | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    let vivo = true; setItens(null);
    dadosPost<{ consultas: Item[] }>('motor_historico', { dias, usuario: quem }).then(r => vivo && setItens(r.consultas)).catch(e => vivo && setErro((e as Error).message));
    return () => { vivo = false; };
  }, [dias, quem]);
  const porPessoa = (itens ?? []).reduce<Record<string, number>>((m, x) => { m[x.usuarioNome] = (m[x.usuarioNome] ?? 0) + 1; return m; }, {});
  return (
    <section className="cartao mt-6 overflow-x-auto">
      <div className="flex flex-wrap items-center gap-2 border-b border-borda px-4 py-3">
        <h2 className="font-semibold">Consultas da equipe <span className="text-sm font-normal text-apagado">({itens?.length ?? '…'})</span></h2>
        <select className="campo ml-auto w-auto" value={quem} onChange={e => setQuem(e.target.value)} aria-label="Quem consultou">
          <option value="">Todos</option>
          {(estado?.usuarios ?? []).map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
        <select className="campo w-auto" value={dias} onChange={e => setDias(Number(e.target.value))} aria-label="Período">
          <option value={1}>Hoje</option><option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option>
        </select>
      </div>
      {erro && <p className="px-4 py-3 text-sm text-red-600">{erro}</p>}
      {itens && Object.keys(porPessoa).length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pt-3 text-xs">{Object.entries(porPessoa).sort((a, b) => b[1] - a[1]).map(([n, q]) => <span key={n} className="rounded-full bg-fundo px-2.5 py-1"><b>{n}</b>: {q}</span>)}</div>
      )}
      {!itens ? <div className="p-4 text-sm text-apagado">Carregando…</div> : !itens.length ? <div className="p-4"><Vazio>Nenhuma consulta no período.</Vazio></div> : (
        <table className="tabela">
          <thead><tr><th>Quando</th><th>Quem</th><th>CPF</th><th>Cliente</th><th>Com oferta</th><th>Digitado</th></tr></thead>
          <tbody>
            {itens.map(x => (
              <tr key={x.id}>
                <td className="num whitespace-nowrap text-xs">{new Date(x.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td className="whitespace-nowrap">{x.usuarioNome}</td>
                <td className="num whitespace-nowrap">{fmtCpf(x.cpf)}</td>
                <td>{x.cliente || '—'}</td>
                <td className="text-xs">{x.comOferta.length ? x.comOferta.map(nomeParte).join(', ') : <span className="text-apagado">nenhum</span>}</td>
                <td>{x.digitado ? <Etiqueta cor="verde">Sim</Etiqueta> : <Etiqueta cor="cinza">Não</Etiqueta>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
