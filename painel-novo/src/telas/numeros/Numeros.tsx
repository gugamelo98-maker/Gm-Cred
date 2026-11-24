import { useEffect, useState } from 'react';
import { Plus, QrCode, RefreshCw, Trash2 } from 'lucide-react';
import { useDados } from '@/estado/Dados';
import { api } from '@/api';
import type { Numero } from '@/api/tipos';
import { Etiqueta, Kpi, Modal, Titulo, Vazio, type Cor } from '@/componentes/ui';
import { dataHora, fmtTel, num, tempoDesde } from '@/util/formato';
import { numerosVisiveis } from '@/util/permissoes';

export const ESTADO_NUM: Record<Numero['estado'], [string, Cor]> = { conectado: ['Conectado', 'verde'], aguardando_qr: ['Aguardando QR', 'amarelo'], caiu: ['Caiu', 'vermelho'], parado: ['Parado', 'cinza'] };
const FUNCOES: Record<Numero['funcao'], string> = { atendimento: 'Atendimento (recebe as conversas)', disparo: 'Disparo', reserva: 'Reserva (entra se o de atendimento cair)' };

function JanelaQr({ n, fechar }: { n: Numero; fechar: () => void }) {
  const [img, setImg] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    const pedir = () => api.qrCode(n.id).then(s => vivo && setImg(s));
    pedir();
    const t = setInterval(pedir, 15000); // o QR do WhatsApp expira; pede outro a cada 15s
    return () => { vivo = false; clearInterval(t); };
  }, [n.id]);
  return (
    <Modal aberto fechar={fechar} titulo={`Conectar ${n.sessao}`} largura="max-w-sm">
      <div className="mx-auto mb-3 flex h-60 w-60 items-center justify-center rounded-lg border border-borda bg-white">
        {img ? <img src={img} alt="QR code para conectar o WhatsApp" className="h-56 w-56" /> : <span className="text-sm text-gray-500">Gerando QR…</span>}
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-suave">
        <li>No celular do chip, abra o WhatsApp.</li><li>Toque em <b>Aparelhos conectados</b> → <b>Conectar um aparelho</b>.</li><li>Aponte a câmera para este QR. Ele se renova sozinho.</li>
      </ol>
    </Modal>
  );
}

export default function Numeros() {
  const { estado, usuario, trocar, remover, executar } = useDados();
  const [qr, setQr] = useState<Numero | null>(null);
  const colaborador = usuario!.papel === 'atendente';
  const N = numerosVisiveis(estado!.numeros, usuario!);

  async function salvar(n: Numero, p: Partial<Numero>) { trocar('numeros', { ...n, ...p }); const r = await executar(() => api.salvarNumero({ id: n.id, ...p }), 'Número atualizado'); trocar('numeros', r ?? n); }
  async function novo() {
    const prox = Math.max(1, ...estado!.numeros.map(n => Number(n.sessao.replace(/\D/g, '')) || 1)) + 1;
    const r = await executar(() => api.novoNumero(`gmcred-${prox}`, colaborador ? 'atendimento' : 'disparo', colaborador ? usuario!.id : null), 'Número criado: leia o QR para conectar');
    if (r) { trocar('numeros', r); setQr(r); }
  }
  async function excluir(n: Numero) {
    if (!confirm(`Excluir ${n.sessao}? A sessão do WhatsApp é apagada do servidor e precisa ler o QR de novo.`)) return;
    const ok = await executar(async () => { await api.excluirNumero(n.id); return true; }, 'Número excluído');
    if (ok) remover('numeros', n.id);
  }

  return (
    <div>
      <Titulo titulo={colaborador ? 'Meu número' : 'Números'} sub={colaborador ? 'Conecte o seu WhatsApp ao sistema. Você só vê o seu número.' : 'Chips de WhatsApp conectados ao servidor Baileys.'}
        acoes={<button className="bt bt-pri" onClick={novo}><Plus size={16} /> {colaborador ? 'Conectar meu número' : 'Novo número'}</button>} />
      {colaborador && !N.length && <div className="mb-5"><Vazio>Você ainda não tem número conectado. Clique em “Conectar meu número” e leia o QR com o WhatsApp do seu celular.</Vazio></div>}
      {!colaborador && <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Conectados" valor={`${N.filter(n => n.estado === 'conectado').length} de ${N.length}`} />
        <Kpi rotulo="Caídos ou sem QR" valor={N.filter(n => n.estado === 'caiu' || n.estado === 'aguardando_qr').length} />
        <Kpi rotulo="Enviadas hoje" valor={num(N.reduce((s, n) => s + n.enviadasHoje, 0))} />
        <Kpi rotulo="Falhas hoje" valor={num(N.reduce((s, n) => s + n.falhasHoje, 0))} />
      </div>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {N.map(n => {
          const [nome, cor] = ESTADO_NUM[n.estado];
          return (
            <section key={n.id} className="cartao p-4">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h2 className="font-semibold">{n.sessao}</h2><Etiqueta cor={cor}>{nome}</Etiqueta>
              </div>
              <p className="num text-sm text-suave">{n.telefone ? fmtTel(n.telefone) : 'Sem número ainda'} · {n.nomePerfil}</p>
              <p className="text-xs text-apagado">{n.aparelho}{n.conectadoDesde && ` · conectado ${tempoDesde(n.conectadoDesde)}`}</p>
              {n.travaAte && new Date(n.travaAte) > new Date() && <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">⏳ WhatsApp travou iniciar conversas até {dataHora(n.travaAte)}. Fica fora dos disparos até lá.</p>}
              <dl className="my-3 grid grid-cols-3 gap-2 text-sm">
                <div><dt className="text-xs text-apagado">Enviadas</dt><dd className="num font-semibold">{num(n.enviadasHoje)}</dd></div>
                <div><dt className="text-xs text-apagado">Entregues</dt><dd className="num font-semibold">{num(n.entreguesHoje)}</dd></div>
                <div><dt className="text-xs text-apagado">Falhas</dt><dd className={`num font-semibold ${n.falhasHoje > 5 ? 'text-red-600' : ''}`}>{num(n.falhasHoje)}</dd></div>
              </dl>
              {!colaborador && <>
                <label className="rotulo" htmlFor={'d' + n.id}>Dono</label>
                <select id={'d' + n.id} className="campo mb-2" value={n.dono ?? ''} onChange={e => salvar(n, { dono: e.target.value || null })}>
                  <option value="">Empresa (sem dono)</option>
                  {estado!.usuarios.filter(u => u.ativo).map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
                <label className="rotulo" htmlFor={'f' + n.id}>Função</label>
                <select id={'f' + n.id} className="campo mb-2" value={n.funcao} onChange={e => salvar(n, { funcao: e.target.value as Numero['funcao'] })}>
                  {(Object.keys(FUNCOES) as Numero['funcao'][]).map(f => <option key={f} value={f}>{FUNCOES[f]}</option>)}
                </select>
                <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={n.maturar} onChange={e => salvar(n, { maturar: e.target.checked })} /> Usar no maturador</label>
              </>}
              <div className="flex gap-2">
                {n.estado !== 'conectado' ? <button className="bt bt-sm bt-pri" onClick={() => setQr(n)}><QrCode size={14} /> Conectar</button>
                  : <button className="bt bt-sm" onClick={() => setQr(n)}><RefreshCw size={14} /> Reconectar</button>}
                <button className="bt bt-sm ml-auto text-red-600" onClick={() => excluir(n)}><Trash2 size={14} /> Excluir</button>
              </div>
            </section>
          );
        })}
      </div>
      {qr && <JanelaQr n={qr} fechar={() => setQr(null)} />}
    </div>
  );
}
