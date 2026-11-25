import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Kpi } from '@/componentes/ui';
import { brl, dataHora, num } from '@/util/formato';
import { token } from '@/api/painel';

const BASE = (import.meta.env.VITE_N8N_WEBHOOK as string | undefined) || 'https://rarelookingorca-n8n.cloudfy.live/webhook';
interface Linha { banco: string; produto: string; pagos: number; producao: number; comissao: number; digitados: number }
interface Pago { banco: string; produto: string; cliente: string; cpf: string; valor: number; data: string; contrato: string; tabela: string; comissao: number | null }
interface Resp { ok: boolean; erro?: string; coletado_em: string | null; por_banco: Linha[]; pagos: Pago[] }

/** Contratos PAGOS no mês, lidos direto de V8, Unno e HUB (coleta a cada hora). */
export default function PagosBancos() {
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [d, setD] = useState<Resp | null>(null);
  const [erro, setErro] = useState('');
  const [coletando, setColetando] = useState(false);
  const carregar = () => fetch(BASE + '/painel/bi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ k: token.ler(), dados: { mes: mes + '-01' } }) })
    .then(r => r.json()).then((r: Resp) => { if (r.ok) { setD(r); setErro(''); } else setErro(r.erro || 'Falha'); }).catch(e => setErro(String(e.message)));
  useEffect(() => { carregar(); }, [mes]); // eslint-disable-line react-hooks/exhaustive-deps
  async function coletar() { setColetando(true); await fetch(BASE + '/bi/coletar', { method: 'POST' }).catch(() => null); await carregar(); setColetando(false); }
  const L = d?.por_banco ?? [];
  const soma = (f: (x: Linha) => number, p?: string) => L.filter(x => !p || x.produto === p).reduce((s, x) => s + f(x), 0);
  return (
    <section className="cartao mb-5 p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Contratos pagos nos bancos</h2>
        <span className="text-xs text-apagado">V8, Unno e HUB · {d?.coletado_em ? 'atualizado ' + dataHora(d.coletado_em) : '—'}</span>
        <input type="month" className="campo ml-auto w-auto" value={mes} onChange={e => setMes(e.target.value)} aria-label="Mês" />
        <button className="bt bt-sm" onClick={coletar} disabled={coletando}><RefreshCw size={14} className={coletando ? 'animate-spin' : ''} /> Atualizar agora</button>
      </div>
      {erro && <p className="mb-2 text-sm text-red-600">{erro}</p>}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Contratos pagos" valor={num(soma(x => +x.pagos))} detalhe={`CLT ${num(soma(x => +x.pagos, 'CLT'))} · FGTS ${num(soma(x => +x.pagos, 'FGTS'))}`} destaque />
        <Kpi rotulo="Produção paga" valor={brl(soma(x => +x.producao))} detalhe={`CLT ${brl(soma(x => +x.producao, 'CLT'))} · FGTS ${brl(soma(x => +x.producao, 'FGTS'))}`} destaque />
        <Kpi rotulo="Comissão estimada" valor={brl(soma(x => +x.comissao))} detalhe="pelas tabelas de comissão" />
        <Kpi rotulo="Propostas no mês" valor={num(soma(x => +x.digitados))} detalhe="todas as situações" />
      </div>
      <div className="overflow-x-auto">
        <table className="tabela"><thead><tr><th>Banco</th><th>Produto</th><th className="text-right">Pagos</th><th className="text-right">Produção</th><th className="text-right">Comissão</th><th className="text-right">Propostas</th></tr></thead>
          <tbody>{L.map(x => <tr key={x.banco + x.produto}><td className="font-medium">{x.banco}</td><td>{x.produto}</td><td className="num text-right">{x.pagos}</td><td className="num text-right">{brl(+x.producao)}</td><td className="num text-right">{brl(+x.comissao)}</td><td className="num text-right">{x.digitados}</td></tr>)}</tbody></table>
      </div>
      {(d?.pagos ?? []).length > 0 && (
        <details className="mt-3"><summary className="cursor-pointer text-sm font-medium">Ver os {d!.pagos.length} contratos pagos</summary>
          <div className="mt-2 max-h-80 overflow-auto"><table className="tabela"><thead><tr><th>Data</th><th>Banco</th><th>Produto</th><th>Cliente</th><th>Tabela</th><th className="text-right">Valor</th><th className="text-right">Comissão</th></tr></thead>
            <tbody>{d!.pagos.map((p, i) => <tr key={i}><td className="text-xs">{dataHora(p.data)}</td><td>{p.banco}</td><td>{p.produto}</td><td>{p.cliente}</td><td className="text-xs">{p.tabela || '—'}</td><td className="num text-right">{brl(+p.valor)}</td><td className="num text-right">{p.comissao != null ? brl(+p.comissao) : '—'}</td></tr>)}</tbody></table></div>
        </details>)}
    </section>
  );
}
