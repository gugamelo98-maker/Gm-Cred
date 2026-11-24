import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Calculator } from 'lucide-react';
import { useDados } from '@/estado/Dados';
import { api } from '@/api';
import type { Cliente, Etapa } from '@/api/tipos';
import { Etiqueta, Modal, type Cor } from '@/componentes/ui';
import { brl, dataHora, fmtCpf, fmtTel } from '@/util/formato';
import { ETAPAS, ORIGENS, nomeEtapa } from '@/util/rotulos';

export const COR_ETAPA: Record<Etapa, Cor> = { recepcao: 'cinza', simulacao: 'azul', vendas: 'amarelo', formalizacao: 'roxo', posvenda: 'verde', perdido: 'vermelho' };
export const MOTIVOS_PERDA = ['Não respondeu', 'Não quis', 'Achou a parcela alta', 'Sem margem', 'Sem WhatsApp', 'Já fechou com outro', 'Número errado', 'Outro'];

/** Move o cliente de etapa já atualizando a tela (e desfaz se o backend recusar). */
export function useMoverCliente() {
  const { usuario, trocar, executar } = useDados();
  return async (c: Cliente, para: Etapa, motivo?: string) => {
    if (c.etapa === para) return;
    const antes = c;
    trocar('clientes', { ...c, etapa: para, etiqueta: motivo ?? c.etiqueta });
    const r = await executar(async () => {
      if (para === 'perdido') return api.finalizarConversa(c.id, motivo || 'Outro', usuario!.id);
      return api.moverCliente(c.id, para, usuario!.id);
    }, `${c.nome.split(' ')[0]} → ${nomeEtapa(para)}`);
    trocar('clientes', r ?? antes);
  };
}

/** Janela para escolher o motivo quando o cliente vai para Perdidos. */
export function MotivoPerda({ cliente, confirmar, cancelar }: { cliente: Cliente | null; confirmar: (motivo: string) => void; cancelar: () => void }) {
  const [motivo, setMotivo] = useState(MOTIVOS_PERDA[0]);
  const [outro, setOutro] = useState('');
  if (!cliente) return null;
  const final = motivo === 'Outro' ? outro.trim() || 'Outro' : motivo;
  return (
    <Modal aberto fechar={cancelar} titulo={`Finalizar ${cliente.nome.split(' ')[0]} sem venda`} largura="max-w-sm"
      rodape={<><button className="bt" onClick={cancelar}>Cancelar</button><button className="bt bt-perigo" onClick={() => confirmar(final)}>Mover para Perdidos</button></>}>
      <p className="mb-3 text-sm text-suave">A IA para de mandar mensagens de retomada para este cliente.</p>
      <div className="space-y-1.5">
        {MOTIVOS_PERDA.map(m => (
          <label key={m} className="flex items-center gap-2 text-sm"><input type="radio" name="motivo" checked={motivo === m} onChange={() => setMotivo(m)} /> {m}</label>
        ))}
      </div>
      {motivo === 'Outro' && <input className="campo mt-2" placeholder="Qual motivo?" value={outro} onChange={e => setOutro(e.target.value)} autoFocus />}
    </Modal>
  );
}

export function nomeAtendente(id: string, usuarios: { id: string; nome: string }[]) {
  return id === 'ia' ? 'IA (Ana)' : usuarios.find(u => u.id === id)?.nome ?? id;
}

export default function Ficha({ cliente, fechar }: { cliente: Cliente | null; fechar: () => void }) {
  const { estado } = useDados();
  const mover = useMoverCliente();
  const [perder, setPerder] = useState(false);
  if (!cliente) return null;
  const c = estado!.clientes.find(x => x.id === cliente.id) ?? cliente;
  const L = (r: string, v: React.ReactNode) => <div><dt className="text-xs text-apagado">{r}</dt><dd className="num text-sm">{v ?? '—'}</dd></div>;
  return (
    <Modal aberto fechar={fechar} titulo={c.nome} largura="max-w-2xl" rodape={<>
      {c.cpf && <Link className="bt" to={`/motor?cpf=${c.cpf}`}><Calculator size={16} /> Motor de crédito</Link>}
      <Link className="bt bt-pri" to={`/conversas?c=${c.id}`}><MessageCircle size={16} /> Abrir conversa</Link>
    </>}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Etiqueta cor={COR_ETAPA[c.etapa]}>{nomeEtapa(c.etapa)}</Etiqueta>
        <Etiqueta>{c.produto}</Etiqueta>
        <Etiqueta>{ORIGENS[c.origem]}</Etiqueta>
        <span className="text-sm text-apagado">{c.situacao}</span>
      </div>
      <dl className="mb-5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {L('Telefone', fmtTel(c.telefone))}{L('CPF', c.cpf ? fmtCpf(c.cpf) : null)}{L('Atendente', nomeAtendente(c.atendente, estado!.usuarios))}
        {L('Margem', c.margem != null ? brl(c.margem) : null)}{L('Banco', c.banco)}{L('Proposta', c.valorLiberado ? `${brl(c.valorLiberado)} · ${c.prazo}x de ${brl(c.parcela)}` : null)}
        {L('Comissão', c.comissao ? brl(c.comissao) : null)}{L('Entrou', dataHora(c.entrouEm))}{L('Última mensagem', dataHora(c.ultimaMsgEm))}
      </dl>
      <label className="rotulo" htmlFor="etapa">Mudar etapa</label>
      <select id="etapa" className="campo mb-5" value={c.etapa} onChange={e => {
        const p = e.target.value as Etapa;
        if (p === 'perdido') setPerder(true); else mover(c, p);
      }}>
        {ETAPAS.map(e => <option key={e.id} value={e.id}>{e.nome} — {e.desc}</option>)}
      </select>
      <h3 className="mb-2 text-sm font-semibold">Histórico de etapas</h3>
      <ol className="space-y-1 text-sm">
        {[...c.historico].reverse().map((h, i) => (
          <li key={i} className="flex gap-2"><span className="num w-28 shrink-0 text-apagado">{dataHora(h.em)}</span>
            <span>{h.de ? `${nomeEtapa(h.de)} → ` : 'Entrou em '}<b>{nomeEtapa(h.para)}</b> <span className="text-apagado">por {nomeAtendente(h.por, estado!.usuarios)}</span></span></li>
        ))}
      </ol>
      <MotivoPerda cliente={perder ? c : null} cancelar={() => setPerder(false)} confirmar={m => { setPerder(false); mover(c, 'perdido', m); }} />
    </Modal>
  );
}
