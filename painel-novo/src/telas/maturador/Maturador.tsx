import { Pause, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDados } from '@/estado/Dados';
import { api } from '@/api';
import type { Maturador as TMaturador } from '@/api/tipos';
import { Etiqueta, Titulo, Vazio } from '@/componentes/ui';
import { hora } from '@/util/formato';
import { ESTADO_NUM } from '@/telas/numeros/Numeros';

export default function Maturador() {
  const { estado, definir, trocar, executar } = useDados();
  const M = estado!.maturador;
  const participantes = estado!.numeros.filter(n => n.maturar);

  async function salvar(p: Partial<TMaturador>, ok?: string) {
    definir(e => ({ ...e, maturador: { ...e.maturador, ...p } }));
    const r = await executar(() => api.salvarMaturador(p), ok);
    definir(e => ({ ...e, maturador: r ?? M }));
  }

  return (
    <div>
      <Titulo titulo="Maturador" sub="Os chips conversam entre si para o WhatsApp ver o número como uso normal antes de disparar." />
      <section className="cartao mb-5 flex flex-wrap items-center gap-4 p-5">
        <button className={`bt ${M.ativo ? '' : 'bt-pri'}`} onClick={() => salvar({ ativo: !M.ativo }, M.ativo ? 'Maturador pausado' : 'Maturador ligado')}>
          {M.ativo ? <><Pause size={16} /> Pausar</> : <><Play size={16} /> Ligar</>}
        </button>
        <Etiqueta cor={M.ativo ? 'verde' : 'cinza'}>{M.ativo ? 'Ligado' : 'Pausado'}</Etiqueta>
        <label className="flex items-center gap-2 text-sm">1 mensagem a cada
          <input type="number" min={3} max={120} className="campo num w-20" defaultValue={M.intervaloMin} onBlur={e => Number(e.target.value) !== M.intervaloMin && salvar({ intervaloMin: Number(e.target.value) }, 'Maturador atualizado')} /> min</label>
        <label className="flex items-center gap-2 text-sm">das
          <input type="number" min={0} max={23} className="campo num w-16" defaultValue={M.horaInicio} onBlur={e => Number(e.target.value) !== M.horaInicio && salvar({ horaInicio: Number(e.target.value) }, 'Maturador atualizado')} /> h às
          <input type="number" min={1} max={24} className="campo num w-16" defaultValue={M.horaFim} onBlur={e => Number(e.target.value) !== M.horaFim && salvar({ horaFim: Number(e.target.value) }, 'Maturador atualizado')} /> h</label>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="cartao p-5">
          <h2 className="mb-1 font-semibold">Chips no maturador ({participantes.length})</h2>
          <p className="mb-3 text-xs text-apagado">Precisa de pelo menos 2. Liga e desliga cada chip em <Link to="/numeros" className="text-marca underline">Números</Link>.</p>
          {participantes.length < 2 && <p className="mb-3 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">Com menos de 2 chips o maturador não tem com quem conversar.</p>}
          <ul className="divide-y divide-borda">
            {participantes.map(n => {
              const [nome, cor] = ESTADO_NUM[n.estado];
              return (
                <li key={n.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{n.sessao} <span className="text-apagado">· {n.aparelho}</span></span>
                  <span className="flex items-center gap-2"><Etiqueta cor={cor}>{nome}</Etiqueta>
                    <button className="text-xs text-apagado underline" onClick={async () => { const r = await executar(() => api.salvarNumero({ id: n.id, maturar: false }), 'Chip tirado do maturador'); if (r) trocar('numeros', r); }}>tirar</button></span>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="cartao p-5">
          <h2 className="mb-3 font-semibold">Últimas mensagens trocadas</h2>
          {!M.ultimas.length ? <Vazio>Nada ainda.</Vazio> : (
            <ul className="space-y-2 text-sm">
              {M.ultimas.map((u, i) => (
                <li key={i} className="flex gap-3"><span className="num w-12 shrink-0 text-apagado">{hora(u.em)}</span>
                  <span><span className="text-apagado">{u.de} → {u.para}:</span> {u.texto}</span></li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
