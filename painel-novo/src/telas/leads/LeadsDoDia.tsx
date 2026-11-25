import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, MessageCircle, Send } from 'lucide-react';
import clsx from 'clsx';
import { useDados } from '@/estado/Dados';
import { api } from '@/api';
import { frios } from '@/api/frios';
import type { LeadDia } from '@/api/tipos';
import { Etiqueta, Kpi, Titulo, Vazio } from '@/componentes/ui';
import { brl, fmtCpf, fmtTel, hora, num } from '@/util/formato';

const MSG_PADRAO = 'Oi {nome}, tudo bem? Aqui é {atendente} da GM Cred. Consta no seu CPF uma margem de até {margem} para empréstimo consignado CLT. Posso fazer uma simulação pra você?';
const CHAVE_MSG = 'gm_leads_mensagem';
const MSG_FRIO = 'Oi {nome}, tudo bem? Aqui é {atendente} da GM Cred. Você pode ter crédito CLT ou saque do FGTS liberado no seu CPF. Posso fazer uma simulação pra você?';
const CHAVE_MSG_FRIO = 'gm_leads_mensagem_frio';
const ehFrio = (l: LeadDia) => l.tipo === 'frio';

const hojeIso = () => new Date().toISOString().slice(0, 10);
const deHoje = (l: LeadDia) => new Date(l.extraidoEm).toDateString() === new Date().toDateString();

function lerMsg(frio = false) { const k = frio ? CHAVE_MSG_FRIO : CHAVE_MSG, d = frio ? MSG_FRIO : MSG_PADRAO; try { return localStorage.getItem(k) || d; } catch { return d; } }

function MeusLeads() {
  const { estado, usuario, trocar, definir, executar, avisar } = useDados();
  const eu = usuario!;
  const [extraindo, setExtraindo] = useState(false);
  const [filtro, setFiltro] = useState<'chamar' | 'chamados' | 'todos'>('chamar');
  const [tipo, setTipo] = useState<'margem' | 'frio'>('margem');
  const frio = tipo === 'frio';
  const [msgs, setMsgs] = useState({ margem: lerMsg(false), frio: lerMsg(true) });
  const msg = msgs[tipo], padrao = frio ? MSG_FRIO : MSG_PADRAO, chaveMsg = frio ? CHAVE_MSG_FRIO : CHAVE_MSG;
  const setMsg = (v: string) => setMsgs(m => ({ ...m, [tipo]: v }));
  const [cotaFrios, setCotaFrios] = useState({ cota: 0, hoje: 0 });
  useEffect(() => { frios.info().then(r => setCotaFrios({ cota: r.frios_cota || 0, hoje: r.frios_hoje || 0 })).catch(() => {}); }, []);
  const [enviando, setEnviando] = useState<string | null>(null);
  const meuNumero = estado!.numeros.find(n => n.dono === eu.id && n.estado === 'conectado');

  const doDia = useMemo(() => estado!.leadsDia.filter(l => deHoje(l) && l.extraidoPor === eu.id && ehFrio(l) === frio), [estado, eu.id, frio]);
  const lista = doDia.filter(l => filtro === 'todos' || (filtro === 'chamar' ? !l.chamadoEm : !!l.chamadoEm))
    .sort((a, b) => Number(!!a.chamadoEm) - Number(!!b.chamadoEm) || b.margem - a.margem);
  const chamados = doDia.filter(l => l.chamadoEm).length;
  const liberados = frio ? cotaFrios.cota : eu.leadsPorDia || 0;
  const falta = Math.max(0, liberados - doDia.length);
  const nomeDe = (id: string) => estado!.usuarios.find(u => u.id === id)?.nome ?? id;

  async function extrair() {
    setExtraindo(true);
    if (frio) {
      const r = await executar(() => frios.extrair());
      if (r) {
        const antes = new Set(estado!.leadsDia.map(l => l.id));
        const novos = r.leads.filter(l => !antes.has(l.id));
        avisar(`${novos.filter(l => l.extraidoPor === eu.id).length} leads frios extraídos`);
        definir(e => ({ ...e, leadsDia: r.leads }));
        setCotaFrios({ cota: r.frios_cota || 0, hoje: r.frios_hoje || 0 });
      }
    } else {
      const novos = await executar(() => api.extrairLeads(eu.id));
      if (novos) avisar(`${novos.length} leads extraídos`);
      if (novos) definir(e => ({ ...e, leadsDia: [...e.leadsDia, ...novos] }));
    }
    setExtraindo(false);
    setFiltro('chamar');
  }

  function textoPara(l: LeadDia) {
    return msg.replace(/\{nome\}/g, l.nome.split(' ')[0]).replace(/\{margem\}/g, l.margem ? brl(l.margem) : '').replace(/\{atendente\}/g, eu.nome.split(' ')[0]);
  }
  /** envia a mensagem pelo número do colaborador; a conversa aparece em Conversas */
  async function chamar(l: LeadDia) {
    setEnviando(l.id);
    const r = await executar(() => api.chamarLead(l.id, textoPara(l), eu.id), `Mensagem enviada para ${l.nome.split(' ')[0]}`);
    if (r) { trocar('leadsDia', r.lead); trocar('clientes', r.cliente); }
    setEnviando(null);
  }

  function baixar() {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = '﻿' + ['Nome;Telefone;CPF;Margem;Banco;Extraído por;Chamado', ...doDia.map(l => [l.nome, l.telefone, l.cpf, l.margem, l.banco, nomeDe(l.extraidoPor), l.chamadoEm ? 'sim' : 'não'].map(esc).join(';'))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `leads_${hojeIso()}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <Titulo titulo="Leads do dia" sub="Clique em Extrair para receber os leads liberados para você hoje. “Enviar mensagem” manda pelo seu número e a conversa aparece em Conversas."
        acoes={<button className="bt bt-pri" onClick={extrair} disabled={extraindo || !falta}>{extraindo ? 'Extraindo…' : falta ? `Extrair ${falta} leads` : liberados ? 'Cota de hoje extraída' : 'Nenhum lead liberado'}</button>} />

      <div className="mb-4 flex gap-2">
        {([['margem', 'Com margem'], ['frio', 'Leads frios']] as const).map(([t, n]) => (
          <button key={t} onClick={() => { setTipo(t); setFiltro('chamar'); }} className={clsx('rounded-lg border px-4 py-2 text-sm font-medium', tipo === t ? 'border-marca bg-marca text-white' : 'border-borda bg-cartao text-suave')}>{n}</button>
        ))}
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Liberados para você hoje" valor={num(liberados)} detalhe={falta ? `${num(falta)} para extrair` : undefined} />
        <Kpi rotulo="Extraídos hoje" valor={num(doDia.length)} />
        <Kpi rotulo="Chamados" valor={num(chamados)} />
        <Kpi rotulo="Falta chamar" valor={num(doDia.length - chamados)} destaque />
      </div>

      {!meuNumero && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          As mensagens saem pelo seu número de WhatsApp. <Link to="/numeros" className="font-medium underline">Conecte o seu número</Link> para poder chamar os leads.
        </div>
      )}

      <details className="cartao mb-4 p-4">
        <summary className="cursor-pointer text-sm font-medium">Mensagem enviada ao chamar</summary>
        <textarea className="campo mt-3 min-h-[80px]" value={msg} onChange={e => { setMsg(e.target.value); try { localStorage.setItem(chaveMsg, e.target.value); } catch { /* ignora */ } }} aria-label="Mensagem" />
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-apagado">
          <span>Use <code>{'{nome}'}</code>{!frio && <>, <code>{'{margem}'}</code></>} e <code>{'{atendente}'}</code>.</span>
          {msg !== padrao && <button className="underline" onClick={() => { setMsg(padrao); try { localStorage.removeItem(chaveMsg); } catch { /* ignora */ } }}>Voltar à mensagem padrão</button>}
        </div>
      </details>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {([['chamar', 'Para chamar', doDia.length - chamados], ['chamados', 'Chamados', chamados], ['todos', 'Todos', doDia.length]] as const).map(([f, n, q]) => (
          <button key={f} onClick={() => setFiltro(f)} className={clsx('rounded-full border px-3 py-1 text-sm', filtro === f ? 'border-marca bg-marca text-white' : 'border-borda bg-cartao text-suave')}>{n} <b className="num">{q}</b></button>
        ))}
        {eu.papel === 'admin' && <button className="bt bt-sm ml-auto" onClick={baixar} disabled={!doDia.length}><Download size={14} /> CSV</button>}
      </div>

      {!lista.length ? (
        <Vazio>{!doDia.length ? (liberados ? 'Clique em Extrair para receber os leads de hoje.' : frio ? 'O administrador ainda não liberou leads frios para você hoje.' : 'O administrador ainda não liberou leads para você hoje.') : filtro === 'chamar' ? 'Você já chamou todos os leads de hoje. Extraia mais se quiser.' : 'Nada aqui.'}</Vazio>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {lista.map(l => (
            <li key={l.id} className={clsx('cartao flex items-center gap-3 p-3', l.chamadoEm && 'opacity-70')}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="truncate font-medium">{l.nome}</span>{l.chamadoEm && <Etiqueta cor="verde">Chamado {hora(l.chamadoEm)}</Etiqueta>}</div>
                <div className="num truncate text-xs text-apagado">CPF {fmtCpf(l.cpf)}</div>
                <div className="mt-0.5 text-sm">{ehFrio(l) ? <span className="text-xs text-apagado">lead frio · planilha</span> : <><span className="num font-semibold">margem {brl(l.margem)}</span> <span className="text-xs text-apagado">· {l.banco}</span></>}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {l.chamadoEm && l.clienteId
                  ? <Link className="bt bt-sm" to={`/conversas?c=${l.clienteId}`}><MessageCircle size={14} /> Ver conversa</Link>
                  : <button className="bt bt-sm border-green-600 bg-green-600 text-white hover:bg-green-700" onClick={() => chamar(l)} disabled={!meuNumero || enviando === l.id} aria-label={`Enviar mensagem para ${l.nome}`}>
                      <Send size={14} /> {enviando === l.id ? 'Enviando…' : 'Enviar mensagem'}</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Visão do administrador/gestor: só libera quantos leads cada colaborador pode extrair por dia. */
function LiberarLeads() {
  const { estado, trocar, executar } = useDados();
  const [todos, setTodos] = useState('');
  const [fr, setFr] = useState<{ por: Record<string, number>; disp: number }>({ por: {}, disp: 0 });
  useEffect(() => { frios.info().then(r => setFr({ por: r.frios_por_usuario || {}, disp: r.frios_disponiveis || 0 })).catch(() => {}); }, []);
  async function salvarFrios(id: string, q: number) {
    const valor = Math.max(0, Math.min(1000, Math.round(q) || 0));
    if (valor === (fr.por[id] || 0)) return;
    const u = estado!.usuarios.find(x => x.id === id)!;
    const ok = await executar(() => frios.cota(id, valor), `${u.nome}: ${valor} leads frios por dia`);
    if (ok) setFr(f => ({ ...f, por: { ...f.por, [id]: valor } }));
  }
  const colaboradores = estado!.usuarios.filter(u => u.papel === 'atendente' && u.ativo);
  const hoje = (id: string) => estado!.leadsDia.filter(l => l.extraidoPor === id && deHoje(l));

  async function salvar(id: string, q: number) {
    const u = estado!.usuarios.find(x => x.id === id)!;
    const valor = Math.max(0, Math.min(1000, Math.round(q) || 0));
    if (valor === u.leadsPorDia) return;
    const r = await executar(() => api.salvarUsuario({ id, leadsPorDia: valor }), `${u.nome}: ${valor} leads por dia`);
    if (r) trocar('usuarios', r);
  }
  async function aplicarTodos() {
    const q = Number(todos);
    if (!Number.isFinite(q) || todos === '') return;
    for (const u of colaboradores) await salvar(u.id, q);
    setTodos('');
  }

  const total = colaboradores.reduce((s, u) => s + (u.leadsPorDia || 0), 0);
  const extraidos = colaboradores.reduce((s, u) => s + hoje(u.id).length, 0);
  const chamadosTot = colaboradores.reduce((s, u) => s + hoje(u.id).filter(l => l.chamadoEm).length, 0);

  return (
    <div>
      <Titulo titulo="Leads do dia" sub="Defina quantos leads cada colaborador pode extrair por dia. Ele clica em Extrair e envia a mensagem pelo painel, pelo número dele; a conversa aparece em Conversas." />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Liberados por dia" valor={num(total)} detalhe={`${colaboradores.length} colaboradores`} destaque />
        <Kpi rotulo="Extraídos hoje" valor={num(extraidos)} />
        <Kpi rotulo="Chamados hoje" valor={num(chamadosTot)} />
        <Kpi rotulo="Falta chamar" valor={num(extraidos - chamadosTot)} />
      </div>
      <p className="-mt-3 mb-4 text-xs text-apagado">Leads frios disponíveis na planilha: <b className="num">{num(fr.disp)}</b>. Saem um do final, um do início e um do meio; os usados ficam pintados na planilha (amarelo = liberado, azul = disparado, verde = respondeu).</p>
      {!colaboradores.length ? <Vazio>Nenhum colaborador ativo. Cadastre em Usuários.</Vazio> : (
        <div className="cartao overflow-x-auto">
          <div className="flex flex-wrap items-center gap-2 border-b border-borda px-4 py-3 text-sm">
            <span className="text-suave">Mesma quantidade para todos:</span>
            <input type="number" min={0} className="campo num w-24" value={todos} onChange={e => setTodos(e.target.value)} aria-label="Quantidade para todos" />
            <button className="bt bt-sm" onClick={aplicarTodos} disabled={todos === ''}>Aplicar</button>
          </div>
          <table className="tabela">
            <thead><tr><th>Colaborador</th><th>Leads por dia</th><th>Frios por dia</th><th className="text-right">Extraídos hoje</th><th className="text-right">Chamados</th><th className="text-right">Falta chamar</th><th>Andamento</th></tr></thead>
            <tbody>
              {colaboradores.map(u => {
                const ls = hoje(u.id), ch = ls.filter(l => l.chamadoEm).length, base = Math.max(u.leadsPorDia || 0, ls.length);
                return (
                  <tr key={u.id}>
                    <td className="font-medium">{u.nome}</td>
                    <td><input key={u.leadsPorDia} type="number" min={0} max={1000} defaultValue={u.leadsPorDia || 0} className="campo num w-24" aria-label={`Leads por dia de ${u.nome}`}
                      onBlur={e => salvar(u.id, Number(e.target.value))} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} /></td>
                    <td><input key={'f' + (fr.por[u.id] || 0)} type="number" min={0} max={1000} defaultValue={fr.por[u.id] || 0} className="campo num w-24" aria-label={`Leads frios por dia de ${u.nome}`}
                      onBlur={e => salvarFrios(u.id, Number(e.target.value))} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} /></td>
                    <td className="num text-right">{num(ls.length)}</td>
                    <td className="num text-right">{num(ch)}</td>
                    <td className="num text-right">{num(ls.length - ch)}</td>
                    <td className="min-w-[160px]">
                      <div className="h-2 overflow-hidden rounded-full bg-fundo" role="progressbar" aria-valuenow={ch} aria-valuemax={base} aria-label={`Chamados de ${u.nome}`}>
                        <div className="h-full" style={{ width: `${base ? (ch / base) * 100 : 0}%`, background: 'var(--serie-1)' }} />
                      </div>
                      <div className="mt-0.5 text-[11px] text-apagado">{base ? `${Math.round((ch / base) * 100)}% chamados` : 'sem leads liberados'}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <ExtraidosLista />
    </div>
  );
}

/** Lista dos leads extraídos (últimos 7 dias) para o administrador. */
function ExtraidosLista() {
  const { estado } = useDados();
  const [quem, setQuem] = useState('');
  const nome = (id: string | null) => estado!.usuarios.find(u => u.id === id)?.nome ?? '—';
  const L = [...estado!.leadsDia].filter(l => !quem || l.extraidoPor === quem).sort((a, b) => (b.extraidoEm ?? '').localeCompare(a.extraidoEm ?? ''));
  return (
    <div className="cartao mt-5 overflow-x-auto">
      <div className="flex flex-wrap items-center gap-2 border-b border-borda px-4 py-3">
        <h2 className="font-semibold">Leads extraídos <span className="num text-sm font-normal text-apagado">({num(L.length)} nos últimos 7 dias)</span></h2>
        <select className="campo ml-auto w-auto" value={quem} onChange={e => setQuem(e.target.value)} aria-label="Colaborador">
          <option value="">Todos os colaboradores</option>
          {estado!.usuarios.filter(u => u.papel === 'atendente').map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
      </div>
      {!L.length ? <div className="p-4"><Vazio>Nenhum lead extraído ainda.</Vazio></div> : (
        <table className="tabela">
          <thead><tr><th>Nome</th><th>CPF</th><th>Telefone</th><th className="text-right">Margem</th><th>Colaborador</th><th>Extraído</th><th>Chamado</th></tr></thead>
          <tbody>
            {L.slice(0, 500).map(l => (
              <tr key={l.id}>
                <td className="font-medium">{l.nome}</td>
                <td className="num">{fmtCpf(l.cpf)}</td>
                <td className="num">{l.telefone ? fmtTel(l.telefone) : '—'}</td>
                <td className="num text-right">{ehFrio(l) ? <span className="text-xs text-apagado">frio</span> : brl(l.margem)}</td>
                <td>{nome(l.extraidoPor)}</td>
                <td className="num text-xs">{l.extraidoEm ? new Date(l.extraidoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                <td>{l.chamadoEm ? <Etiqueta cor="verde">Sim</Etiqueta> : <Etiqueta cor="cinza">Não</Etiqueta>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function LeadsDoDia() {
  const { usuario } = useDados();
  return usuario!.papel === 'atendente' ? <MeusLeads /> : <LiberarLeads />;
}
