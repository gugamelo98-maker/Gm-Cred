import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import clsx from 'clsx';
import { aoVivo, type Membro } from '@/api/aoVivo';
import { Kpi, Titulo, Vazio } from '@/componentes/ui';
import { MENU } from '@/componentes/Layout';
import { num, tempoDesde } from '@/util/formato';
import Historico from '@/telas/motor/Historico';

const ST: Record<Membro['status'], [string, string]> = { '1_online': ['Online', 'bg-green-500'], '2_ausente': ['Ausente', 'bg-amber-400'], '3_offline': ['Offline', 'bg-gray-400'] };
const nomeAba = (a: string | null) => MENU.flatMap(g => g.itens).find(i => a?.startsWith(i.para))?.nome ?? (a || '—');

/** Equipe ao vivo: quem está com o painel aberto agora, em que aba e o que fez hoje. */
export default function AoVivo() {
  const [eq, setEq] = useState<Membro[] | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    let vivo = true;
    const ler = () => aoVivo().then(r => { if (vivo) { setEq(r.equipe); setErro(''); } }).catch(e => vivo && setErro((e as Error).message));
    ler(); const t = setInterval(ler, 15000);
    return () => { vivo = false; clearInterval(t); };
  }, []);
  const on = eq?.filter(m => m.status === '1_online').length ?? 0;
  const tot = (k: keyof Membro) => (eq ?? []).reduce((s, m) => s + Number(m[k] || 0), 0);
  return (
    <div>
      <Titulo titulo="Ao vivo" sub="Quem está com o painel aberto agora e o que fez hoje. Atualiza sozinho a cada 15 segundos." />
      {erro && <p className="mb-3 text-sm text-red-600">{erro}</p>}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Online agora" valor={`${on} de ${eq?.length ?? 0}`} destaque />
        <Kpi rotulo="Mensagens enviadas hoje" valor={num(tot('enviadasHoje'))} />
        <Kpi rotulo="Clientes atendidos hoje" valor={num(tot('atendidosHoje'))} />
        <Kpi rotulo="Não lidas na equipe" valor={num(tot('naoLidas'))} />
      </div>
      {!eq ? <Vazio>Carregando…</Vazio> : !eq.length ? <Vazio>Nenhum usuário ativo.</Vazio> : (
        <div className="cartao overflow-x-auto">
          <table className="tabela">
            <thead><tr><th>Pessoa</th><th>Agora</th><th className="text-right">Conversas abertas</th><th className="text-right">Não lidas</th><th className="text-right">Msgs hoje</th><th className="text-right">Atendidos hoje</th><th className="text-right">Leads do dia</th><th></th></tr></thead>
            <tbody>
              {eq.map(m => {
                const [nome, cor] = ST[m.status];
                return (
                  <tr key={m.id}>
                    <td><div className="flex items-center gap-2"><span className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', cor, m.status === '1_online' && 'animate-pulse')} aria-hidden /><span className="font-medium">{m.nome}</span></div>
                      <div className="pl-[18px] text-xs text-apagado">{m.papel}</div></td>
                    <td><div className="text-sm">{nome}{m.status !== '3_offline' && <> · {nomeAba(m.aba)}</>}</div>
                      <div className="text-xs text-apagado">{m.vistoEm ? `visto ${tempoDesde(m.vistoEm)}` : 'nunca entrou'}</div></td>
                    <td className="num text-right">{num(m.abertas)}</td>
                    <td className={clsx('num text-right', m.naoLidas > 0 && 'font-semibold text-red-600')}>{num(m.naoLidas)}</td>
                    <td className="num text-right">{num(m.enviadasHoje)}</td>
                    <td className="num text-right">{num(m.atendidosHoje)}</td>
                    <td className="num text-right">{num(m.chamadosHoje)}/{num(m.leadsHoje)}</td>
                    <td><Link className="bt bt-sm whitespace-nowrap" to={`/conversas?resp=${m.id}`}><MessageCircle size={14} /> Conversas</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-apagado">Online: painel aberto no último 2 min. Ausente: até 15 min. Leads do dia: chamados/extraídos hoje.</p>
      <Historico />
    </div>
  );
}
