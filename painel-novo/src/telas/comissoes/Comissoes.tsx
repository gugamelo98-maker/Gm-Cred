import { useCallback, useEffect, useState } from 'react';
import { Plus, Wallet } from 'lucide-react';
import { useDados } from '@/estado/Dados';
import { Abas, Etiqueta, Kpi, Modal, Titulo, Vazio } from '@/componentes/ui';
import { brl, dataHora, mascaraCpf, num } from '@/util/formato';
import { token } from '@/api/painel';

const BASE = (import.meta.env.VITE_N8N_WEBHOOK as string | undefined) || 'https://rarelookingorca-n8n.cloudfy.live/webhook';
async function api<T>(acao: string, dados: object = {}): Promise<T> {
  const r = await fetch(BASE + '/painel/comissoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao, k: token.ler(), dados }) });
  let b: { ok?: boolean; erro?: string } | null = null;
  try { b = await r.json(); } catch { /* sem corpo */ }
  if (!b?.ok) throw new Error(b?.erro || `Falha no servidor (${r.status})`);
  return b as T;
}

interface Mes {
  mes: string; total: number; digitados: number;
  clt: { contratos: number; producao: number; comissao_empresa: number; pct: number; comissao: number; bonus: number; proxima_faixa: { pct: number; faltam: number } | null; proximo_bonus_faltam: number };
  fgts: { producao: number; comissao_empresa: number; pct: number; comissao: number; bonus: number; proximo_bonus_faltam: number };
}
interface Saldo { ganho: number; sacado: number; em_analise: number; disponivel: number }
interface Contrato { id: number; usuario?: string; usuario_id?: number; produto: 'CLT' | 'FGTS'; banco: string; tabela: string; cliente_nome: string; cpf: string; valor: number; comissao_empresa: number; proposta: string; status: 'digitado' | 'pago' | 'cancelado'; criado_em: string; pago_em: string | null }
interface Saque { id: number; usuario?: string; valor: number; pix: string; status: 'solicitado' | 'pago' | 'recusado'; obs: string | null; criado_em: string }
interface Pessoa { id: string; nome: string; papel: string; ativo: boolean; mes: Mes; saldo: Saldo }

const ST_CONTRATO = { digitado: ['Digitado', 'amarelo'], pago: ['Pago', 'verde'], cancelado: ['Cancelado', 'cinza'] } as const;
const ST_SAQUE = { solicitado: ['Aguardando', 'amarelo'], pago: ['Pago', 'verde'], recusado: ['Recusado', 'vermelho'] } as const;
const mesAtual = () => new Date().toISOString().slice(0, 7);

function Meu({ mes }: { mes: string }) {
  const { avisar } = useDados();
  const [d, setD] = useState<{ mes: Mes; saldo: Saldo; contratos: Contrato[]; saques: Saque[] } | null>(null);
  const [pedir, setPedir] = useState(false);
  const [valor, setValor] = useState('');
  const [pix, setPix] = useState('');
  const carregar = useCallback(() => api<{ mes: Mes; saldo: Saldo; contratos: Contrato[]; saques: Saque[] }>('meu', { mes: mes + '-01' }).then(setD).catch(e => avisar(e.message, 'erro')), [mes, avisar]);
  useEffect(() => { carregar(); }, [carregar]);
  if (!d) return <Vazio>Carregando…</Vazio>;
  const m = d.mes;
  async function enviar() {
    try { await api('pedir_saque', { valor: Number(valor.replace(/\./g, '').replace(',', '.')), pix }); avisar('Saque solicitado'); setPedir(false); setValor(''); carregar(); }
    catch (e) { avisar((e as Error).message, 'erro'); }
  }
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Disponível para saque" valor={brl(d.saldo.disponivel)} detalhe={d.saldo.em_analise ? `${brl(d.saldo.em_analise)} em análise` : 'nenhum saque em análise'} destaque />
        <Kpi rotulo="Comissão do mês" valor={brl(m.total)} detalhe={`CLT ${brl(m.clt.comissao + m.clt.bonus)} · FGTS ${brl(m.fgts.comissao + m.fgts.bonus)}`} destaque />
        <Kpi rotulo="Contratos CLT pagos" valor={num(m.clt.contratos)} detalhe={`faixa atual ${m.clt.pct}%`} />
        <Kpi rotulo="Digitados aguardando" valor={num(m.digitados)} detalhe="entram na conta quando pagos" />
      </div>
      <div className="mb-5 grid gap-4 md:grid-cols-2">
        <section className="cartao p-5">
          <h2 className="mb-2 font-semibold">Meta CLT</h2>
          <p className="text-sm">Você está em <b>{m.clt.pct}%</b> com <b>{m.clt.contratos}</b> contratos pagos no mês.</p>
          {m.clt.proxima_faixa ? <p className="text-sm text-suave">Faltam <b>{m.clt.proxima_faixa.faltam}</b> contratos para subir para <b>{m.clt.proxima_faixa.pct}%</b>.</p> : <p className="text-sm text-green-700">Você está na faixa máxima.</p>}
          <p className="mt-2 text-sm text-suave">Produção CLT paga: <b className="num">{brl(m.clt.producao)}</b> · bônus {brl(m.clt.bonus)} · faltam <b className="num">{brl(m.clt.proximo_bonus_faltam)}</b> para mais R$ 100.</p>
        </section>
        <section className="cartao p-5">
          <h2 className="mb-2 font-semibold">FGTS</h2>
          <p className="text-sm">Comissão de <b>{m.fgts.pct}%</b> sobre o que a GM Cred recebe.</p>
          <p className="mt-2 text-sm text-suave">Produção FGTS paga: <b className="num">{brl(m.fgts.producao)}</b> · bônus {brl(m.fgts.bonus)} · faltam <b className="num">{brl(m.fgts.proximo_bonus_faltam)}</b> para mais R$ 100.</p>
        </section>
      </div>
      <section className="cartao mb-5 p-5">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Saques</h2>
          <button className="bt bt-pri" disabled={d.saldo.disponivel <= 0} onClick={() => { setValor(String(d.saldo.disponivel).replace('.', ',')); setPedir(true); }}><Wallet size={16} /> Solicitar saque</button></div>
        {!d.saques.length ? <p className="text-sm text-apagado">Nenhum saque ainda.</p> : (
          <table className="tabela"><thead><tr><th>Pedido em</th><th className="text-right">Valor</th><th>PIX</th><th>Situação</th></tr></thead>
            <tbody>{d.saques.map(s => <tr key={s.id}><td>{dataHora(s.criado_em)}</td><td className="num text-right">{brl(s.valor)}</td><td>{s.pix}</td><td><Etiqueta cor={ST_SAQUE[s.status][1]}>{ST_SAQUE[s.status][0]}</Etiqueta>{s.obs ? <span className="ml-2 text-xs text-apagado">{s.obs}</span> : null}</td></tr>)}</tbody></table>
        )}
      </section>
      <Contratos lista={d.contratos} />
      <Modal aberto={pedir} fechar={() => setPedir(false)} titulo="Solicitar saque" largura="max-w-sm"
        rodape={<><button className="bt" onClick={() => setPedir(false)}>Cancelar</button><button className="bt bt-pri" onClick={enviar} disabled={!valor || !pix.trim()}>Solicitar</button></>}>
        <p className="mb-3 text-sm text-suave">Disponível: <b className="num">{brl(d.saldo.disponivel)}</b></p>
        <label className="rotulo" htmlFor="sv">Valor</label><input id="sv" className="campo num mb-3" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} />
        <label className="rotulo" htmlFor="sp">Chave PIX</label><input id="sp" className="campo" value={pix} onChange={e => setPix(e.target.value)} />
      </Modal>
    </>
  );
}

function Contratos({ lista, admin, mudar }: { lista: Contrato[]; admin?: boolean; mudar?: (c: Contrato, s: Contrato['status']) => void }) {
  return (
    <section className="cartao overflow-x-auto">
      <h2 className="px-5 pb-2 pt-4 font-semibold">Contratos</h2>
      {!lista.length ? <p className="px-5 pb-4 text-sm text-apagado">Nenhum contrato. Contratos digitados pelo Motor aparecem aqui sozinhos.</p> : (
        <table className="tabela">
          <thead><tr>{admin && <th>Vendedor</th>}<th>Cliente</th><th>Produto</th><th>Banco / tabela</th><th className="text-right">Liberado</th><th className="text-right">Comissão GM</th><th>Situação</th><th>Data</th></tr></thead>
          <tbody>{lista.map(c => (
            <tr key={c.id}>
              {admin && <td className="font-medium">{c.usuario}</td>}
              <td>{c.cliente_nome || '—'}<div className="num text-xs text-apagado">{c.cpf ? mascaraCpf(c.cpf) : ''}</div></td>
              <td>{c.produto}</td><td className="text-xs">{c.banco}<br />{c.tabela}</td>
              <td className="num text-right">{brl(c.valor)}</td><td className="num text-right">{brl(c.comissao_empresa)}</td>
              <td>{admin && mudar ? (
                <select className="campo w-auto py-1 text-xs" value={c.status} onChange={e => mudar(c, e.target.value as Contrato['status'])}>
                  <option value="digitado">Digitado</option><option value="pago">Pago</option><option value="cancelado">Cancelado</option>
                </select>) : <Etiqueta cor={ST_CONTRATO[c.status][1]}>{ST_CONTRATO[c.status][0]}</Etiqueta>}</td>
              <td className="whitespace-nowrap text-xs text-apagado">{dataHora(c.pago_em || c.criado_em)}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </section>
  );
}

function Equipe({ mes }: { mes: string }) {
  const { avisar, usuario } = useDados();
  const [d, setD] = useState<{ pessoas: Pessoa[]; contratos: Contrato[]; saques: Saque[] } | null>(null);
  const [novo, setNovo] = useState<(Partial<Omit<Contrato, 'usuario_id'>> & { usuario_id?: string }) | null>(null);
  const admin = usuario?.papel === 'admin';
  const carregar = useCallback(() => api<{ pessoas: Pessoa[]; contratos: Contrato[]; saques: Saque[] }>('equipe', { mes: mes + '-01' }).then(setD).catch(e => avisar(e.message, 'erro')), [mes, avisar]);
  useEffect(() => { carregar(); }, [carregar]);
  if (!d) return <Vazio>Carregando…</Vazio>;
  const faz = (acao: string, dados: object, ok: string) => api(acao, dados).then(() => { avisar(ok); carregar(); }).catch(e => avisar(e.message, 'erro'));
  const tot = d.pessoas.reduce((a, p) => ({ clt: a.clt + p.mes.clt.producao, fgts: a.fgts + p.mes.fgts.producao, com: a.com + p.mes.total, emp: a.emp + p.mes.clt.comissao_empresa + p.mes.fgts.comissao_empresa }), { clt: 0, fgts: 0, com: 0, emp: 0 });
  const pendentes = d.saques.filter(s => s.status === 'solicitado');
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Produção CLT paga" valor={brl(tot.clt)} />
        <Kpi rotulo="Produção FGTS paga" valor={brl(tot.fgts)} />
        <Kpi rotulo="Comissão GM no mês" valor={brl(tot.emp)} destaque />
        <Kpi rotulo="A pagar à equipe (mês)" valor={brl(tot.com)} detalhe={pendentes.length ? `${pendentes.length} saque(s) aguardando` : 'nenhum saque aguardando'} destaque />
      </div>
      <section className="cartao mb-5 overflow-x-auto">
        <div className="flex items-center justify-between px-5 pb-2 pt-4"><h2 className="font-semibold">Por vendedor</h2>
          {admin && <button className="bt bt-sm" onClick={() => setNovo({ produto: 'CLT', status: 'pago' })}><Plus size={14} /> Lançar contrato</button>}</div>
        <table className="tabela">
          <thead><tr><th>Vendedor</th><th className="text-right">CLT pagos</th><th className="text-right">Produção CLT</th><th className="text-right">Faixa</th><th className="text-right">Produção FGTS</th><th className="text-right">Digitados</th><th className="text-right">Comissão do mês</th><th className="text-right">Saldo p/ saque</th></tr></thead>
          <tbody>{d.pessoas.map(p => (
            <tr key={p.id}><td className="font-medium">{p.nome}</td>
              <td className="num text-right">{p.mes.clt.contratos}</td><td className="num text-right">{brl(p.mes.clt.producao)}</td><td className="num text-right">{p.mes.clt.pct}%</td>
              <td className="num text-right">{brl(p.mes.fgts.producao)}</td><td className="num text-right">{p.mes.digitados}</td>
              <td className="num text-right font-medium">{brl(p.mes.total)}</td><td className="num text-right">{brl(p.saldo.disponivel)}</td></tr>
          ))}</tbody>
        </table>
      </section>
      <section className="cartao mb-5 overflow-x-auto">
        <h2 className="px-5 pb-2 pt-4 font-semibold">Pedidos de saque</h2>
        {!d.saques.length ? <p className="px-5 pb-4 text-sm text-apagado">Nenhum pedido.</p> : (
          <table className="tabela"><thead><tr><th>Vendedor</th><th>Pedido em</th><th className="text-right">Valor</th><th>PIX</th><th>Situação</th><th /></tr></thead>
            <tbody>{d.saques.map(s => (
              <tr key={s.id}><td className="font-medium">{s.usuario}</td><td>{dataHora(s.criado_em)}</td><td className="num text-right">{brl(s.valor)}</td><td>{s.pix}</td>
                <td><Etiqueta cor={ST_SAQUE[s.status][1]}>{ST_SAQUE[s.status][0]}</Etiqueta></td>
                <td className="whitespace-nowrap text-right">{admin && s.status === 'solicitado' && <>
                  <button className="bt bt-sm" onClick={() => faz('saque_status', { id: s.id, status: 'recusado', obs: prompt('Motivo da recusa?') || '' }, 'Saque recusado')}>Recusar</button>{' '}
                  <button className="bt bt-pri bt-sm" onClick={() => confirm(`Confirmar que pagou ${brl(s.valor)} para ${s.usuario}?`) && faz('saque_status', { id: s.id, status: 'pago' }, 'Saque marcado como pago')}>Marcar pago</button></>}</td></tr>
            ))}</tbody></table>
        )}
      </section>
      <Contratos lista={d.contratos} admin mudar={admin ? (c, st) => faz('contrato_status', { id: c.id, status: st }, 'Contrato atualizado') : undefined} />
      <Modal aberto={!!novo} fechar={() => setNovo(null)} titulo="Lançar contrato" largura="max-w-md"
        rodape={<><button className="bt" onClick={() => setNovo(null)}>Cancelar</button><button className="bt bt-pri" disabled={!novo?.usuario_id || !novo?.valor} onClick={() => faz('contrato_novo', novo!, 'Contrato lançado').then(() => setNovo(null))}>Salvar</button></>}>
        {novo && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="rotulo">Vendedor</label><select className="campo" value={novo.usuario_id ?? ''} onChange={e => setNovo({ ...novo, usuario_id: e.target.value })}><option value="">Escolha</option>{d.pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
            <div><label className="rotulo">Produto</label><select className="campo" value={novo.produto} onChange={e => setNovo({ ...novo, produto: e.target.value as 'CLT' | 'FGTS' })}><option>CLT</option><option>FGTS</option></select></div>
            <div><label className="rotulo">Situação</label><select className="campo" value={novo.status} onChange={e => setNovo({ ...novo, status: e.target.value as Contrato['status'] })}><option value="digitado">Digitado</option><option value="pago">Pago</option></select></div>
            <div className="sm:col-span-2"><label className="rotulo">Cliente</label><input className="campo" value={novo.cliente_nome ?? ''} onChange={e => setNovo({ ...novo, cliente_nome: e.target.value })} /></div>
            <div><label className="rotulo">CPF</label><input className="campo num" value={novo.cpf ?? ''} onChange={e => setNovo({ ...novo, cpf: e.target.value })} /></div>
            <div><label className="rotulo">Banco</label><input className="campo" value={novo.banco ?? ''} onChange={e => setNovo({ ...novo, banco: e.target.value })} /></div>
            <div><label className="rotulo">Valor liberado</label><input className="campo num" inputMode="decimal" onChange={e => setNovo({ ...novo, valor: Number(e.target.value.replace(/\./g, '').replace(',', '.')) })} /></div>
            <div><label className="rotulo">Comissão GM (R$)</label><input className="campo num" inputMode="decimal" onChange={e => setNovo({ ...novo, comissao_empresa: Number(e.target.value.replace(/\./g, '').replace(',', '.')) })} /></div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default function Comissoes() {
  const { usuario } = useDados();
  const gestao = usuario?.papel === 'admin' || usuario?.papel === 'gestor';
  const [aba, setAba] = useState<'equipe' | 'meu'>(gestao ? 'equipe' : 'meu');
  const [mes, setMes] = useState(mesAtual());
  return (
    <div>
      <Titulo titulo="Comissões" sub="Produção, metas, comissão e saques. Só contam os contratos pagos."
        acoes={<input type="month" className="campo w-auto" value={mes} max={mesAtual()} onChange={e => setMes(e.target.value || mesAtual())} aria-label="Mês" />} />
      {gestao && <div className="mb-4"><Abas valor={aba} mudar={setAba} opcoes={[{ id: 'equipe', nome: 'Equipe' }, { id: 'meu', nome: 'Minha comissão' }]} /></div>}
      {aba === 'equipe' && gestao ? <Equipe mes={mes} /> : <Meu mes={mes} />}
    </div>
  );
}
