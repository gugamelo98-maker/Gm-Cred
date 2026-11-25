import { useEffect, useMemo, useState } from 'react';
import { token } from '@/api/painel';
import { useDados } from '@/estado/Dados';
import { Abas, Kpi, Titulo } from '@/componentes/ui';
import { Funil, Linhas } from '@/componentes/graficos';
import { brl, brlCurto, dataCurta, num, pct } from '@/util/formato';
import { ORIGENS } from '@/util/rotulos';
import { PERIODOS, dentro, dias, intervalo, type Periodo } from '@/util/periodo';
import type { Cliente, Origem, Produto } from '@/api/tipos';
import PagosBancos from './PagosBancos';

/** Conta o funil de um grupo de clientes (todos que ENTRARAM no período). */
function funil(cs: Cliente[]) {
  return {
    entraram: cs.length,
    cpf: cs.filter(c => c.cpfEm).length,
    margem: cs.filter(c => c.margemEm).length,
    proposta: cs.filter(c => c.propostaEm).length,
    pagos: cs.filter(c => c.pagoEm).length,
    liberado: cs.reduce((s, c) => s + (c.pagoEm ? c.valorLiberado ?? 0 : 0), 0),
    comissao: cs.reduce((s, c) => s + (c.pagoEm ? c.comissao ?? 0 : 0), 0),
  };
}

export default function BI() {
  const { estado } = useDados();
  const [periodo, setPeriodo] = useState<Periodo>('30d');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [produto, setProduto] = useState<Produto | 'todos'>('todos');
  const [origem, setOrigem] = useState<Origem | 'todas'>('todas');
  const [verTabela, setVerTabela] = useState(false);

  const faixa = useMemo(() => intervalo(periodo, de, ate), [periodo, de, ate]);
  // pagos e comissão vêm dos bancos (mesma fonte do quadro de cima), no período escolhido
  const [banco, setBanco] = useState<{ produto: string; valor: number; comissao: number | null }[] | null>(null);
  useEffect(() => {
    const base = (import.meta.env.VITE_N8N_WEBHOOK as string | undefined) || 'https://rarelookingorca-n8n.cloudfy.live/webhook';
    let vivo = true;
    fetch(base + '/painel/bi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ k: token.ler(), dados: { ini: new Date(faixa[0]).toISOString(), fim: new Date(faixa[1]).toISOString() } }) })
      .then(r => r.json()).then(r => { if (vivo) setBanco(r.ok ? r.pagos : null); }).catch(() => vivo && setBanco(null));
    return () => { vivo = false; };
  }, [faixa]);
  const base = useMemo(() => estado!.clientes.filter(c => (produto === 'todos' || c.produto === produto)), [estado, produto]);
  const doPeriodo = useMemo(() => base.filter(c => dentro(c.entrouEm, faixa) && (origem === 'todas' || c.origem === origem)), [base, faixa, origem]);
  const f = funil(doPeriodo);
  const peloBanco = !!banco && origem === 'todas';
  if (banco && peloBanco) {
    const b = banco.filter(x => produto === 'todos' || x.produto === produto);
    f.pagos = b.length; f.liberado = b.reduce((t, x) => t + Number(x.valor || 0), 0); f.comissao = b.reduce((t, x) => t + Number(x.comissao || 0), 0);
  }

  const porDia = useMemo(() => {
    const ds = dias(faixa);
    const chave = (iso: string) => new Date(iso).setHours(0, 0, 0, 0);
    const conta = (campo: 'entrouEm' | 'cpfEm') => ds.map(d => doPeriodo.filter(c => c[campo] && chave(c[campo]!) === d).length);
    return { rotulos: ds.map(d => dataCurta(new Date(d).toISOString())), entraram: conta('entrouEm'), cpf: conta('cpfEm') };
  }, [doPeriodo, faixa]);

  const gastos = estado!.gastos.filter(g => dentro(g.data + 'T12:00:00', faixa));
  const gastoTotal = gastos.reduce((s, g) => s + g.valor, 0);
  const custoOrigem: Record<Origem, number> = {
    trafego: gastos.filter(g => g.categoria === 'trafego' || g.categoria === 'bms').reduce((s, g) => s + g.valor, 0),
    disparo: gastos.filter(g => g.categoria === 'disparos' || g.categoria === 'numeros').reduce((s, g) => s + g.valor, 0),
    indicacao: 0, organico: 0, leads_dia: 0,
  };
  const porOrigem = (Object.keys(ORIGENS) as Origem[]).map(o => ({ o, ...funil(base.filter(c => dentro(c.entrouEm, faixa) && c.origem === o)) }));

  return (
    <div>
      <Titulo titulo="BI" sub="Contratos pagos lidos direto dos bancos e o funil dos clientes que entraram no período." />
      <PagosBancos />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Abas valor={periodo} mudar={setPeriodo} opcoes={PERIODOS.map(p => ({ id: p.id, nome: p.nome }))} />
        {periodo === 'datas' && (
          <div className="flex items-center gap-1 text-sm">
            <input type="date" className="campo w-auto" value={de} onChange={e => setDe(e.target.value)} aria-label="De" />
            <span className="text-apagado">até</span>
            <input type="date" className="campo w-auto" value={ate} onChange={e => setAte(e.target.value)} aria-label="Até" />
          </div>
        )}
        <select className="campo w-auto" value={produto} onChange={e => setProduto(e.target.value as Produto | 'todos')} aria-label="Produto">
          <option value="todos">CLT e FGTS</option><option value="CLT">Só CLT</option><option value="FGTS">Só FGTS</option>
        </select>
        <select className="campo w-auto" value={origem} onChange={e => setOrigem(e.target.value as Origem | 'todas')} aria-label="Origem">
          <option value="todas">Todas as origens</option>
          {(Object.keys(ORIGENS) as Origem[]).map(o => <option key={o} value={o}>{ORIGENS[o]}</option>)}
        </select>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi rotulo="Entraram" valor={num(f.entraram)} detalhe="responderam ou chamaram" destaque />
        <Kpi rotulo="Mandaram CPF" valor={num(f.cpf)} detalhe={`${pct(f.entraram ? f.cpf / f.entraram : NaN)} de quem entrou`} destaque />
        <Kpi rotulo="Com margem" valor={num(f.margem)} detalhe={`${pct(f.cpf ? f.margem / f.cpf : NaN)} de quem mandou CPF`} />
        <Kpi rotulo="Propostas" valor={num(f.proposta)} detalhe={`${pct(f.margem ? f.proposta / f.margem : NaN)} de quem tinha margem`} />
        <Kpi rotulo="Pagos" valor={num(f.pagos)} detalhe={`${brlCurto(f.liberado)} liberados${peloBanco ? ' · pelos bancos' : ''}`} />
        <Kpi rotulo="Comissão" valor={brlCurto(f.comissao)} detalhe={gastoTotal ? `gastos ${brlCurto(gastoTotal)} · lucro ${brlCurto(f.comissao - gastoTotal)}` : 'sem gastos lançados'} />
      </div>

      <div className="mb-5 grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <section className="cartao p-5">
          <h2 className="mb-4 font-semibold">Funil</h2>
          <Funil etapas={[
            { nome: 'Entraram', valor: f.entraram }, { nome: 'Mandaram CPF', valor: f.cpf }, { nome: 'Com margem', valor: f.margem },
            { nome: 'Proposta', valor: f.proposta }, { nome: 'Pagos', valor: f.pagos },
          ]} />
        </section>
        <section className="cartao p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Por dia</h2>
            <button className="text-xs text-marca underline" onClick={() => setVerTabela(v => !v)}>{verTabela ? 'Ver gráfico' : 'Ver tabela'}</button>
          </div>
          {verTabela ? (
            <div className="max-h-[260px] overflow-auto">
              <table className="tabela"><thead><tr><th>Dia</th><th className="text-right">Entraram</th><th className="text-right">Mandaram CPF</th></tr></thead>
                <tbody>{porDia.rotulos.map((r, i) => <tr key={r}><td>{r}</td><td className="num text-right">{porDia.entraram[i]}</td><td className="num text-right">{porDia.cpf[i]}</td></tr>)}</tbody>
              </table>
            </div>
          ) : (
            <Linhas rotulos={porDia.rotulos} series={[
              { nome: 'Entraram', cor: 'var(--serie-1)', valores: porDia.entraram },
              { nome: 'Mandaram CPF', cor: 'var(--serie-2)', valores: porDia.cpf },
            ]} />
          )}
        </section>
      </div>

      <section className="cartao mb-5 overflow-x-auto">
        <h2 className="px-5 pt-4 font-semibold">Por origem</h2>
        <p className="px-5 pb-3 text-xs text-apagado">Custo por lead usa os gastos do Financeiro no período (tráfego + BMs para Tráfego pago; servidor + chips para Disparo).</p>
        <table className="tabela">
          <thead><tr><th>Origem</th><th className="text-right">Entraram</th><th className="text-right">Mandaram CPF</th><th className="text-right">% CPF</th><th className="text-right">Com margem</th><th className="text-right">Pagos</th><th className="text-right">Comissão</th><th className="text-right">Custo por lead</th><th className="text-right">Custo por venda</th></tr></thead>
          <tbody>
            {porOrigem.map(x => (
              <tr key={x.o}>
                <td className="font-medium">{ORIGENS[x.o]}</td>
                <td className="num text-right">{num(x.entraram)}</td><td className="num text-right">{num(x.cpf)}</td>
                <td className="num text-right">{pct(x.entraram ? x.cpf / x.entraram : NaN)}</td>
                <td className="num text-right">{num(x.margem)}</td><td className="num text-right">{num(x.pagos)}</td>
                <td className="num text-right">{brl(x.comissao)}</td>
                <td className="num text-right">{custoOrigem[x.o] && x.entraram ? brl(custoOrigem[x.o] / x.entraram) : '—'}</td>
                <td className="num text-right">{custoOrigem[x.o] && x.pagos ? brl(custoOrigem[x.o] / x.pagos) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="cartao overflow-x-auto">
        <h2 className="px-5 pb-3 pt-4 font-semibold">Disparos</h2>
        <table className="tabela">
          <thead><tr><th>Disparo</th><th className="text-right">Enviadas</th><th className="text-right">Entregues</th><th className="text-right">Responderam</th><th className="text-right">Mandaram CPF</th><th className="text-right">% resposta</th><th className="text-right">% CPF</th></tr></thead>
          <tbody>
            {estado!.disparos.filter(d => d.enviadas > 0).map(d => (
              <tr key={d.id}>
                <td className="font-medium">{d.nome}</td>
                <td className="num text-right">{num(d.enviadas)}</td><td className="num text-right">{num(d.entregues)}</td>
                <td className="num text-right">{num(d.responderam)}</td><td className="num text-right">{num(d.mandaramCpf)}</td>
                <td className="num text-right">{pct(d.entregues ? d.responderam / d.entregues : NaN)}</td>
                <td className="num text-right">{pct(d.responderam ? d.mandaramCpf / d.responderam : NaN)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
