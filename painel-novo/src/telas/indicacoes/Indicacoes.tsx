import { useState } from 'react';
import { Copy, Plus } from 'lucide-react';
import { useDados } from '@/estado/Dados';
import { api } from '@/api';
import type { Indicador } from '@/api/tipos';
import { Kpi, Modal, Titulo, Vazio } from '@/componentes/ui';
import { brl, fmtTel, num, soDigitos } from '@/util/formato';

export default function Indicacoes() {
  const { estado, trocar, executar, avisar } = useDados();
  const [novo, setNovo] = useState<Partial<Indicador> | null>(null);
  const I = estado!.indicadores;
  const atendimento = estado!.numeros.find(n => n.funcao === 'atendimento' && n.telefone)?.telefone ?? '';
  const link = (i: Indicador) => `https://wa.me/${atendimento}?text=${encodeURIComponent(`Olá! Vim pela indicação ${i.codigo}`)}`;
  const saldo = (i: Indicador) => i.fechadas * i.premio - i.pago;

  async function copiar(i: Indicador) {
    try { await navigator.clipboard.writeText(link(i)); avisar('Link copiado'); } catch { prompt('Copie o link:', link(i)); }
  }
  async function pagar(i: Indicador) {
    const v = saldo(i);
    if (v <= 0 || !confirm(`Registrar pagamento de ${brl(v)} para ${i.nome} (PIX ${i.pix})?`)) return;
    const r = await executar(() => api.pagarIndicador(i.id, v), 'Pagamento registrado');
    if (r) trocar('indicadores', r);
  }
  async function salvar() {
    if (!novo?.nome?.trim() || soDigitos(novo.telefone ?? '').length < 10) return avisar('Preencha nome e telefone', 'erro');
    const r = await executar(() => api.salvarIndicador({ ...novo, telefone: soDigitos(novo.telefone!) }), 'Indicador cadastrado');
    if (r) { trocar('indicadores', r); setNovo(null); }
  }

  return (
    <div>
      <Titulo titulo="Indicações" sub="Cada indicador tem um link próprio. Quem chega pelo link entra com a origem “Indicação”."
        acoes={<button className="bt bt-pri" onClick={() => setNovo({ premio: 50 })}><Plus size={16} /> Novo indicador</button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Indicadores" valor={num(I.length)} />
        <Kpi rotulo="Indicações" valor={num(I.reduce((s, i) => s + i.indicacoes, 0))} />
        <Kpi rotulo="Vendas fechadas" valor={num(I.reduce((s, i) => s + i.fechadas, 0))} />
        <Kpi rotulo="A pagar" valor={brl(I.reduce((s, i) => s + Math.max(0, saldo(i)), 0))} />
      </div>
      {!I.length ? <Vazio>Nenhum indicador ainda.</Vazio> : (
        <div className="cartao overflow-x-auto">
          <table className="tabela">
            <thead><tr><th>Indicador</th><th>Código</th><th className="text-right">Indicações</th><th className="text-right">Fechadas</th><th className="text-right">Prêmio</th><th className="text-right">Ganhou</th><th className="text-right">Pago</th><th className="text-right">Saldo</th><th /></tr></thead>
            <tbody>
              {I.map(i => (
                <tr key={i.id}>
                  <td><div className="font-medium">{i.nome}</div><div className="num text-xs text-apagado">{fmtTel(i.telefone)} · PIX {i.pix || '—'}</div></td>
                  <td><code className="rounded bg-fundo px-1.5 py-0.5 text-xs">{i.codigo}</code></td>
                  <td className="num text-right">{num(i.indicacoes)}</td><td className="num text-right">{num(i.fechadas)}</td>
                  <td className="num text-right">{brl(i.premio)}</td><td className="num text-right">{brl(i.fechadas * i.premio)}</td>
                  <td className="num text-right">{brl(i.pago)}</td><td className="num text-right font-semibold">{brl(saldo(i))}</td>
                  <td className="whitespace-nowrap text-right">
                    <button className="bt bt-sm" onClick={() => copiar(i)}><Copy size={14} /> Link</button>{' '}
                    <button className="bt bt-sm" onClick={() => pagar(i)} disabled={saldo(i) <= 0}>Pagar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal aberto={!!novo} fechar={() => setNovo(null)} titulo="Novo indicador" largura="max-w-md"
        rodape={<><button className="bt" onClick={() => setNovo(null)}>Cancelar</button><button className="bt bt-pri" onClick={salvar}>Cadastrar</button></>}>
        {novo && (
          <div className="space-y-3">
            <div><label className="rotulo" htmlFor="in">Nome</label><input id="in" className="campo" value={novo.nome ?? ''} onChange={e => setNovo({ ...novo, nome: e.target.value })} /></div>
            <div><label className="rotulo" htmlFor="it">WhatsApp</label><input id="it" className="campo" inputMode="tel" value={novo.telefone ?? ''} onChange={e => setNovo({ ...novo, telefone: e.target.value })} /></div>
            <div><label className="rotulo" htmlFor="ip">Chave PIX</label><input id="ip" className="campo" value={novo.pix ?? ''} onChange={e => setNovo({ ...novo, pix: e.target.value })} /></div>
            <div><label className="rotulo" htmlFor="ir">Prêmio por venda fechada (R$)</label><input id="ir" type="number" min={0} className="campo num" value={novo.premio ?? 0} onChange={e => setNovo({ ...novo, premio: Number(e.target.value) })} /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
