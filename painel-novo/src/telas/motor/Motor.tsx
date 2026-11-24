import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2, Trophy, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { useDados } from '@/estado/Dados';
import { api } from '@/api';
import type { Banco, Oferta, ResultadoBanco } from '@/api/tipos';
import { Etiqueta, Titulo, Vazio } from '@/componentes/ui';
import { brl, mascaraCpf, soDigitos, validaCpf } from '@/util/formato';

const BANCOS: Banco[] = ['V8', 'Unno', 'HUB'];
type Melhor = Oferta & { banco: Banco; comissaoValor: number };

function melhores(rs: ResultadoBanco[], seguro: 'todos' | 'com' | 'sem'): Melhor[] {
  return rs.flatMap(r => r.ofertas.map(o => ({ ...o, banco: r.banco, comissaoValor: (o.valorLiberado * o.comissaoPct) / 100 })))
    .filter(o => seguro === 'todos' || (seguro === 'com') === o.comSeguro)
    .sort((a, b) => b.comissaoValor - a.comissaoValor);
}

function StatusBanco({ r }: { r: ResultadoBanco }) {
  const s = {
    ok: [<CheckCircle2 key="i" size={16} className="text-green-600" />, 'verde', 'Com margem'],
    sem_margem: [<XCircle key="i" size={16} className="text-apagado" />, 'cinza', 'Sem margem'],
    erro: [<AlertTriangle key="i" size={16} className="text-red-600" />, 'vermelho', 'Erro'],
    precisa_dados: [<AlertTriangle key="i" size={16} className="text-amber-600" />, 'amarelo', 'Faltam dados'],
  } as const;
  const [icone, cor, nome] = s[r.status];
  return <span className="inline-flex items-center gap-1.5">{icone}<Etiqueta cor={cor}>{nome}</Etiqueta></span>;
}

export default function Motor() {
  const { executar } = useDados();
  const [params] = useSearchParams();
  const [cpf, setCpf] = useState(mascaraCpf(params.get('cpf') ?? ''));
  const [consultando, setConsultando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoBanco[] | null>(null);
  const [parcela, setParcela] = useState('');
  const [prazo, setPrazo] = useState('');
  const [simulando, setSimulando] = useState(false);
  const [seguro, setSeguro] = useState<'todos' | 'com' | 'sem'>('todos');
  const cpfOk = validaCpf(cpf);

  async function consultar(e?: FormEvent) {
    e?.preventDefault();
    if (!cpfOk) return;
    setConsultando(true); setResultado(null);
    const r = await executar(() => api.consultarCpf(cpf));
    if (r) setResultado(r);
    setConsultando(false);
  }
  useEffect(() => { if (params.get('cpf') && cpfOk) consultar(); /* consulta direto quando vem da ficha */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function simular(e: FormEvent) {
    e.preventDefault();
    if (!resultado) return;
    const comMargem = resultado.filter(r => r.status === 'ok').map(r => r.banco);
    if (!comMargem.length) return;
    setSimulando(true);
    const novos = await executar(() => api.simular(cpf, parcela ? Number(parcela.replace(',', '.')) : null, prazo ? Number(prazo) : null, comMargem));
    if (novos) setResultado(rs => rs!.map(r => novos.find(n => n.banco === r.banco) ?? r));
    setSimulando(false);
  }

  const ranking = resultado ? melhores(resultado, seguro) : [];
  const top = ranking[0];

  return (
    <div>
      <Titulo titulo="Motor de Crédito" sub="Consulta o CPF na V8, na Unno e na HUB ao mesmo tempo e mostra qual proposta dá mais comissão." />

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <form onSubmit={consultar} className="cartao p-5">
          <h2 className="mb-3 font-semibold">1. Consultar CPF</h2>
          <label className="rotulo" htmlFor="cpf">CPF do cliente</label>
          <div className="flex gap-2">
            <input id="cpf" className="campo num text-lg" inputMode="numeric" placeholder="000.000.000-00" value={cpf} onChange={e => setCpf(mascaraCpf(e.target.value))} />
            <button className="bt bt-pri shrink-0" disabled={!cpfOk || consultando}>{consultando ? <Loader2 size={16} className="animate-spin" /> : null} Consultar</button>
          </div>
          {soDigitos(cpf).length === 11 && !cpfOk && <p className="mt-1 text-xs text-red-600">CPF inválido (dígito verificador não confere).</p>}
          <p className="mt-2 text-xs text-apagado">Nome, nascimento, celular e e-mail são buscados sozinhos pelo backend. Se algum banco pedir dados a mais, ele aparece abaixo.</p>
        </form>

        <form onSubmit={simular} className={clsx('cartao p-5', !resultado?.some(r => r.status === 'ok') && 'opacity-60')}>
          <h2 className="mb-3 font-semibold">2. Simular parcela</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="rotulo" htmlFor="parcela">Parcela desejada (R$)</label><input id="parcela" className="campo num" inputMode="decimal" placeholder="vazio = margem" value={parcela} onChange={e => setParcela(e.target.value)} /></div>
            <div><label className="rotulo" htmlFor="prazo">Prazo</label>
              <select id="prazo" className="campo" value={prazo} onChange={e => setPrazo(e.target.value)}><option value="">Todos</option>{[12, 18, 24, 36, 48].map(p => <option key={p} value={p}>{p}x</option>)}</select>
            </div>
          </div>
          <button className="bt bt-pri mt-3 w-full" disabled={!resultado?.some(r => r.status === 'ok') || simulando}>{simulando && <Loader2 size={16} className="animate-spin" />} Simular nos bancos com margem</button>
        </form>
      </div>

      {consultando && <div className="cartao flex items-center justify-center gap-2 p-10 text-sm text-apagado"><Loader2 className="animate-spin" size={18} /> Consultando V8, Unno e HUB…</div>}

      {resultado && (
        <>
          {top && (
            <section className="cartao mb-5 border-marca p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-marca"><Trophy size={18} /> Melhor proposta (maior comissão)</div>
              <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
                <div><div className="text-xs text-apagado">Banco</div><div className="text-xl font-semibold">{top.banco}</div></div>
                <div><div className="text-xs text-apagado">Cliente recebe</div><div className="num text-xl font-semibold">{brl(top.valorLiberado)}</div></div>
                <div><div className="text-xs text-apagado">Parcela</div><div className="num text-xl font-semibold">{top.prazo}x {brl(top.parcela)}</div></div>
                <div><div className="text-xs text-apagado">Comissão</div><div className="num text-xl font-semibold">{brl(top.comissaoValor)} <span className="text-sm font-normal text-apagado">({top.comissaoPct.toLocaleString('pt-BR')}%)</span></div></div>
                <div><div className="text-xs text-apagado">Seguro</div><div className="text-xl font-semibold">{top.comSeguro ? 'Com' : 'Sem'}</div></div>
              </div>
            </section>
          )}

          <div className="mb-5 grid gap-4 md:grid-cols-3">
            {BANCOS.map(b => {
              const r = resultado.find(x => x.banco === b)!;
              return (
                <section key={b} className="cartao p-4">
                  <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">{b}</h3><StatusBanco r={r} /></div>
                  {r.status === 'ok' ? (
                    <>
                      <div className="text-xs text-apagado">Margem disponível</div>
                      <div className="num mb-1 text-2xl font-semibold">{brl(r.margem)}</div>
                      <div className="text-xs text-apagado">{r.ofertas.length} ofertas · até {brl(Math.max(...r.ofertas.map(o => o.valorLiberado)))}</div>
                    </>
                  ) : <p className="text-sm text-suave">{r.mensagem}</p>}
                  {r.status === 'precisa_dados' && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <select className="campo" aria-label="Sexo"><option>Sexo</option><option>Masculino</option><option>Feminino</option></select>
                      <input className="campo" placeholder="Cidade" aria-label="Cidade" />
                      <button className="bt col-span-2" onClick={() => consultar()}>Consultar de novo</button>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <section className="cartao overflow-x-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3 pt-4">
              <h2 className="font-semibold">Todas as ofertas</h2>
              <select className="campo w-auto" value={seguro} onChange={e => setSeguro(e.target.value as typeof seguro)} aria-label="Seguro">
                <option value="todos">Com e sem seguro</option><option value="com">Só com seguro</option><option value="sem">Só sem seguro</option>
              </select>
            </div>
            {!ranking.length ? <div className="p-5"><Vazio>Nenhum banco liberou oferta para este CPF.</Vazio></div> : (
              <table className="tabela">
                <thead><tr><th>#</th><th>Banco</th><th className="text-right">Prazo</th><th className="text-right">Parcela</th><th className="text-right">Cliente recebe</th><th className="text-right">Taxa a.m.</th><th>Seguro</th><th className="text-right">Comissão</th></tr></thead>
                <tbody>
                  {ranking.map((o, i) => (
                    <tr key={i} className={clsx(i === 0 && 'bg-marca-claro')}>
                      <td className="num text-apagado">{i + 1}</td><td className="font-medium">{o.banco}</td>
                      <td className="num text-right">{o.prazo}x</td><td className="num text-right">{brl(o.parcela)}</td>
                      <td className="num text-right font-medium">{brl(o.valorLiberado)}</td>
                      <td className="num text-right">{(o.taxaMes * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</td>
                      <td>{o.comSeguro ? 'Com' : 'Sem'}</td>
                      <td className="num text-right">{brl(o.comissaoValor)} <span className="text-xs text-apagado">{o.comissaoPct.toLocaleString('pt-BR')}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
      {!resultado && !consultando && <Vazio>Digite um CPF e clique em Consultar.</Vazio>}
    </div>
  );
}
