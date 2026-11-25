import { useEffect, useMemo, useState } from 'react';
import { dadosBi } from '@/api/aoVivo';
import { Plus, Trash2 } from 'lucide-react';
import { useDados } from '@/estado/Dados';
import { api } from '@/api';
import type { Banco, CategoriaGasto, Gasto } from '@/api/tipos';
import { Abas, Kpi, Modal, Titulo, Vazio } from '@/componentes/ui';
import { brl, num, pct } from '@/util/formato';
import { CATEGORIAS } from '@/util/rotulos';
import { dentro, intervalo, type Periodo } from '@/util/periodo';

function BarrasH({ itens }: { itens: { nome: string; valor: number }[] }) {
  const max = Math.max(1, ...itens.map(i => i.valor));
  const total = itens.reduce((s, i) => s + i.valor, 0);
  return (
    <div className="space-y-2">
      {itens.map(i => (
        <div key={i.nome} className="grid grid-cols-[130px_1fr_90px] items-center gap-3 text-sm" title={`${i.nome}: ${brl(i.valor)} (${pct(total ? i.valor / total : 0)})`}>
          <span className="truncate text-suave">{i.nome}</span>
          <div className="h-5"><div className="h-full" style={{ width: `max(${(i.valor / max) * 100}%, 3px)`, background: 'var(--serie-1)', borderRadius: '0 4px 4px 0' }} /></div>
          <span className="num text-right">{brl(i.valor)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Financeiro() {
  const { estado, trocar, remover, executar, avisar } = useDados();
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [editando, setEditando] = useState<Partial<Gasto> | null>(null);
  const faixa = useMemo(() => intervalo(periodo), [periodo]);

  // receita = contratos pagos nos bancos (V8, Unno, HUB) no período, mesma fonte do BI
  const [pagos, setPagos] = useState<{ banco: Banco; valor: number; comissao: number | null }[]>([]);
  useEffect(() => {
    let vivo = true;
    dadosBi(new Date(faixa[0]).toISOString(), new Date(faixa[1]).toISOString()).then(r => vivo && setPagos(r)).catch(() => vivo && setPagos([]));
    return () => { vivo = false; };
  }, [faixa]);
  const receita = pagos.reduce((s, c) => s + Number(c.comissao || 0), 0);
  const gastos = estado!.gastos.filter(g => dentro(g.data + 'T12:00:00', faixa)).sort((a, b) => b.data.localeCompare(a.data));
  const totalGastos = gastos.reduce((s, g) => s + g.valor, 0);
  const lucro = receita - totalGastos;
  const porCategoria = (Object.keys(CATEGORIAS) as CategoriaGasto[]).map(c => ({ nome: CATEGORIAS[c], valor: gastos.filter(g => g.categoria === c).reduce((s, g) => s + g.valor, 0) })).filter(x => x.valor > 0).sort((a, b) => b.valor - a.valor);
  const porBanco = (['V8', 'Unno', 'HUB'] as Banco[]).map(b => ({ nome: b, valor: pagos.filter(c => c.banco === b).reduce((s, c) => s + Number(c.comissao || 0), 0) })).filter(x => x.valor > 0);
  const entraram = estado!.clientes.filter(c => dentro(c.entrouEm, faixa)).length;

  async function salvar() {
    if (!editando?.descricao?.trim() || !editando.valor) return avisar('Preencha descrição e valor', 'erro');
    const r = await executar(() => api.salvarGasto(editando), 'Gasto salvo');
    if (r) { trocar('gastos', r); setEditando(null); }
  }
  async function apagar(g: Gasto) {
    if (!confirm(`Apagar “${g.descricao}” (${brl(g.valor)})?`)) return;
    const ok = await executar(async () => { await api.apagarGasto(g.id); return true; }, 'Gasto apagado');
    if (ok) remover('gastos', g.id);
  }

  return (
    <div>
      <Titulo titulo="Financeiro" sub="Receita = comissão das vendas pagas no período. Gastos lançados à mão."
        acoes={<button className="bt bt-pri" onClick={() => setEditando({ data: new Date().toISOString().slice(0, 10), categoria: 'outros' })}><Plus size={16} /> Lançar gasto</button>} />
      <div className="mb-5"><Abas valor={periodo} mudar={setPeriodo} opcoes={[{ id: 'mes', nome: 'Este mês' }, { id: 'mes_passado', nome: 'Mês passado' }, { id: '30d', nome: '30 dias' }, { id: '7d', nome: '7 dias' }]} /></div>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi rotulo="Receita (comissão)" valor={brl(receita)} detalhe={`${num(pagos.length)} contratos pagos nos bancos`} destaque />
        <Kpi rotulo="Gastos" valor={brl(totalGastos)} detalhe={`${gastos.length} lançamentos`} />
        <Kpi rotulo="Lucro" valor={<span className={lucro < 0 ? 'text-red-600' : ''}>{brl(lucro)}</span>} destaque />
        <Kpi rotulo="Retorno" valor={totalGastos ? pct(lucro / totalGastos) : '—'} detalhe="lucro ÷ gastos" />
        <Kpi rotulo="Custo por lead" valor={entraram ? brl(totalGastos / entraram) : '—'} detalhe={`${num(entraram)} entraram`} />
        <Kpi rotulo="Custo por venda" valor={pagos.length ? brl(totalGastos / pagos.length) : '—'} />
      </div>
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <section className="cartao p-5"><h2 className="mb-3 font-semibold">Gastos por categoria</h2>{porCategoria.length ? <BarrasH itens={porCategoria} /> : <Vazio>Sem gastos no período.</Vazio>}</section>
        <section className="cartao p-5"><h2 className="mb-3 font-semibold">Comissão por banco</h2>{porBanco.length ? <BarrasH itens={porBanco} /> : <Vazio>Sem vendas pagas no período.</Vazio>}</section>
      </div>
      <section className="cartao overflow-x-auto">
        <h2 className="px-5 pb-3 pt-4 font-semibold">Lançamentos</h2>
        {!gastos.length ? <div className="p-5"><Vazio>Nenhum gasto no período.</Vazio></div> : (
          <table className="tabela">
            <thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th className="text-right">Valor</th><th /></tr></thead>
            <tbody>{gastos.map(g => (
              <tr key={g.id} className="cursor-pointer" onClick={() => setEditando(g)}>
                <td className="num whitespace-nowrap">{g.data.split('-').reverse().join('/')}</td><td className="whitespace-nowrap">{CATEGORIAS[g.categoria]}</td>
                <td>{g.descricao}</td><td className="num text-right">{brl(g.valor)}</td>
                <td className="text-right"><button className="text-apagado hover:text-red-600" onClick={e => { e.stopPropagation(); apagar(g); }} aria-label="Apagar"><Trash2 size={16} /></button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
      <Modal aberto={!!editando} fechar={() => setEditando(null)} titulo={editando?.id ? 'Editar gasto' : 'Lançar gasto'} largura="max-w-md"
        rodape={<><button className="bt" onClick={() => setEditando(null)}>Cancelar</button><button className="bt bt-pri" onClick={salvar}>Salvar</button></>}>
        {editando && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="rotulo" htmlFor="gd">Data</label><input id="gd" type="date" className="campo" value={editando.data ?? ''} onChange={e => setEditando({ ...editando, data: e.target.value })} /></div>
            <div><label className="rotulo" htmlFor="gv">Valor (R$)</label><input id="gv" type="number" min={0} step="0.01" className="campo num" value={editando.valor ?? ''} onChange={e => setEditando({ ...editando, valor: Number(e.target.value) })} /></div>
            <div className="col-span-2"><label className="rotulo" htmlFor="gc">Categoria</label>
              <select id="gc" className="campo" value={editando.categoria} onChange={e => setEditando({ ...editando, categoria: e.target.value as CategoriaGasto })}>
                {(Object.keys(CATEGORIAS) as CategoriaGasto[]).map(c => <option key={c} value={c}>{CATEGORIAS[c]}</option>)}
              </select></div>
            <div className="col-span-2"><label className="rotulo" htmlFor="gs">Descrição</label><input id="gs" className="campo" value={editando.descricao ?? ''} onChange={e => setEditando({ ...editando, descricao: e.target.value })} /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
