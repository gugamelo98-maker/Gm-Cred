import { useMemo, useState } from 'react';
import { Download, MessageCircle, Undo2 } from 'lucide-react';
import clsx from 'clsx';
import { useDados } from '@/estado/Dados';
import { api } from '@/api';
import type { LeadDia } from '@/api/tipos';
import { Etiqueta, Kpi, Titulo, Vazio } from '@/componentes/ui';
import { brl, fmtCpf, fmtTel, hora, num, soDigitos } from '@/util/formato';

const MSG_PADRAO = 'Oi {nome}, tudo bem? Aqui é {atendente} da GM Cred. Consta no seu CPF uma margem de até {margem} para empréstimo consignado CLT. Posso fazer uma simulação pra você?';
const CHAVE_MSG = 'gm_leads_mensagem';

const hojeIso = () => new Date().toISOString().slice(0, 10);
const deHoje = (l: LeadDia) => new Date(l.extraidoEm).toDateString() === new Date().toDateString();

function lerMsg() { try { return localStorage.getItem(CHAVE_MSG) || MSG_PADRAO; } catch { return MSG_PADRAO; } }

export default function LeadsDoDia() {
  const { estado, usuario, trocar, definir, executar } = useDados();
  const eu = usuario!;
  const gestao = eu.papel !== 'atendente';
  const [quantidade, setQuantidade] = useState(20);
  const [extraindo, setExtraindo] = useState(false);
  const [filtro, setFiltro] = useState<'chamar' | 'chamados' | 'todos'>('chamar');
  const [quem, setQuem] = useState(gestao ? 'todos' : eu.id);
  const [msg, setMsg] = useState(lerMsg);

  const doDia = useMemo(() => estado!.leadsDia.filter(l => deHoje(l) && (gestao ? quem === 'todos' || l.extraidoPor === quem : l.extraidoPor === eu.id)), [estado, gestao, quem, eu.id]);
  const lista = doDia.filter(l => filtro === 'todos' || (filtro === 'chamar' ? !l.chamadoEm : !!l.chamadoEm))
    .sort((a, b) => Number(!!a.chamadoEm) - Number(!!b.chamadoEm) || b.margem - a.margem);
  const chamados = doDia.filter(l => l.chamadoEm).length;
  const nomeDe = (id: string) => estado!.usuarios.find(u => u.id === id)?.nome ?? id;

  async function extrair() {
    setExtraindo(true);
    const novos = await executar(() => api.extrairLeads(quantidade, eu.id), `${quantidade} leads extraídos`);
    if (novos) definir(e => ({ ...e, leadsDia: [...e.leadsDia, ...novos] }));
    setExtraindo(false);
    setFiltro('chamar');
  }

  function textoPara(l: LeadDia) {
    return msg.replace(/\{nome\}/g, l.nome.split(' ')[0]).replace(/\{margem\}/g, brl(l.margem)).replace(/\{atendente\}/g, eu.nome.split(' ')[0]);
  }
  async function chamar(l: LeadDia) {
    window.open(`https://wa.me/${soDigitos(l.telefone)}?text=${encodeURIComponent(textoPara(l))}`, '_blank', 'noopener');
    if (!l.chamadoEm) { const r = await executar(() => api.marcarLeadChamado(l.id, true)); if (r) trocar('leadsDia', r); }
  }
  async function desfazer(l: LeadDia) { const r = await executar(() => api.marcarLeadChamado(l.id, false)); if (r) trocar('leadsDia', r); }

  function baixar() {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = '﻿' + ['Nome;Telefone;CPF;Margem;Banco;Extraído por;Chamado', ...doDia.map(l => [l.nome, l.telefone, l.cpf, l.margem, l.banco, nomeDe(l.extraidoPor), l.chamadoEm ? 'sim' : 'não'].map(esc).join(';'))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `leads_${hojeIso()}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <Titulo titulo="Leads do dia" sub="Clique em Extrair para receber leads com margem. O botão WhatsApp abre a conversa no seu WhatsApp com a mensagem pronta."
        acoes={<>
          <select className="campo w-auto" value={quantidade} onChange={e => setQuantidade(Number(e.target.value))} aria-label="Quantidade">
            {[10, 20, 50, 100].map(q => <option key={q} value={q}>{q} leads</option>)}
          </select>
          <button className="bt bt-pri" onClick={extrair} disabled={extraindo}>{extraindo ? 'Extraindo…' : 'Extrair'}</button>
        </>} />

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Kpi rotulo="Extraídos hoje" valor={num(doDia.length)} />
        <Kpi rotulo="Chamados" valor={num(chamados)} />
        <Kpi rotulo="Falta chamar" valor={num(doDia.length - chamados)} destaque />
      </div>

      <details className="cartao mb-4 p-4">
        <summary className="cursor-pointer text-sm font-medium">Mensagem que abre no WhatsApp</summary>
        <textarea className="campo mt-3 min-h-[80px]" value={msg} onChange={e => { setMsg(e.target.value); try { localStorage.setItem(CHAVE_MSG, e.target.value); } catch { /* ignora */ } }} aria-label="Mensagem" />
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-apagado">
          <span>Use <code>{'{nome}'}</code>, <code>{'{margem}'}</code> e <code>{'{atendente}'}</code>.</span>
          {msg !== MSG_PADRAO && <button className="underline" onClick={() => { setMsg(MSG_PADRAO); try { localStorage.removeItem(CHAVE_MSG); } catch { /* ignora */ } }}>Voltar à mensagem padrão</button>}
        </div>
      </details>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {([['chamar', 'Para chamar', doDia.length - chamados], ['chamados', 'Chamados', chamados], ['todos', 'Todos', doDia.length]] as const).map(([f, n, q]) => (
          <button key={f} onClick={() => setFiltro(f)} className={clsx('rounded-full border px-3 py-1 text-sm', filtro === f ? 'border-marca bg-marca text-white' : 'border-borda bg-cartao text-suave')}>{n} <b className="num">{q}</b></button>
        ))}
        {gestao && (
          <select className="campo w-auto" value={quem} onChange={e => setQuem(e.target.value)} aria-label="Colaborador">
            <option value="todos">Todos os colaboradores</option>
            {estado!.usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        )}
        <button className="bt bt-sm ml-auto" onClick={baixar} disabled={!doDia.length}><Download size={14} /> CSV</button>
      </div>

      {!lista.length ? (
        <Vazio>{!doDia.length ? 'Nenhum lead extraído hoje. Escolha a quantidade e clique em Extrair.' : filtro === 'chamar' ? 'Você já chamou todos os leads de hoje. Extraia mais se quiser.' : 'Nada aqui.'}</Vazio>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {lista.map(l => (
            <li key={l.id} className={clsx('cartao flex items-center gap-3 p-3', l.chamadoEm && 'opacity-70')}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="truncate font-medium">{l.nome}</span>{l.chamadoEm && <Etiqueta cor="verde">Chamado {hora(l.chamadoEm)}</Etiqueta>}</div>
                <div className="num truncate text-xs text-apagado">{fmtTel(l.telefone)} · CPF {fmtCpf(l.cpf)}</div>
                <div className="mt-0.5 text-sm"><span className="num font-semibold">margem {brl(l.margem)}</span> <span className="text-xs text-apagado">· {l.banco}{gestao ? ' · ' + nomeDe(l.extraidoPor) : ''}</span></div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <button className="bt bt-sm border-green-600 bg-green-600 text-white hover:bg-green-700" onClick={() => chamar(l)} aria-label={`Chamar ${l.nome} no WhatsApp`}><MessageCircle size={14} /> WhatsApp</button>
                {l.chamadoEm && <button className="inline-flex items-center gap-1 text-[11px] text-apagado underline" onClick={() => desfazer(l)}><Undo2 size={11} /> desfazer</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
