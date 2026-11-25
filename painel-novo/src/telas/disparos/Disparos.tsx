import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Download, Plus, Sparkles, X } from 'lucide-react';
import clsx from 'clsx';
import { Etiqueta, Titulo, Vazio, type Cor } from '@/componentes/ui';
import { fmtTel } from '@/util/formato';
import { token } from '@/api/painel';

/** Disparos de verdade: mesmo backend do painel antigo (credito.disparo_api via /escritorio/disparo). */
const BASE = (import.meta.env.VITE_N8N_WEBHOOK as string | undefined) || 'https://rarelookingorca-n8n.cloudfy.live/webhook';

type Botao = { tipo: 'link' | 'resposta'; texto: string; url: string };
type Msg = { texto: string; variacoes: string[]; imagem: string; rodape: string; botoes: Botao[] };
interface Resumo { total?: number; na_fila?: number; enviando?: number; enviadas?: number; entregues?: number; lidas?: number; responderam?: number; atendimento?: number; simularam?: number; propostas?: number; pagos?: number; bloquearam?: number }
interface Disparo { id: number; nome: string; status: string; numeros: string[]; intervalo_min: number; hora_inicio: number; hora_fim: number; mensagens?: { texto: string; variacoes: string[]; extra?: Partial<Msg> }[]; extra?: Partial<Msg>; resumo?: Resumo }
interface Numero { nome: string; numero: string; funcao: string; estado: string; trava_ate?: string; enviadas: number }
interface Contato { nome: string; telefone: string; instancia: string; status: string; situacao: string; erro: string; enviado_em: string }
interface Resp { disparos: Disparo[]; numeros: Numero[]; contatos: Contato[]; por_numero: { nome: string; enviadas: number; responderam: number; atendimento: number; bloquearam: number }[];
  por_mensagem: { msg: number; enviadas: number; entregues: number; responderam: number; atendimento: number; simularam: number; bloquearam: number }[];
  testes: { criado_em: string; enviado_em: string | null; erro: string | null }[]; atual?: number; aviso?: string; erro?: string; variacoes_novas?: string[] }
interface Ed { id: number; nome: string; numeros: string[]; intervalo_min: number; hora_inicio: number; hora_fim: number; mensagens: Msg[]; aba: number; sujo: boolean }

const ST: Record<string, [string, Cor]> = { rascunho: ['Rascunho', 'cinza'], ativo: ['Enviando', 'verde'], pausado: ['Pausado', 'amarelo'], concluido: ['Concluído', 'azul' as Cor], encerrado: ['Encerrado', 'cinza'] };

async function chamar(acao: string, id: number, extra: Record<string, string> = {}): Promise<Resp> {
  const r = await fetch(BASE + '/escritorio/disparo', { method: 'POST', body: new URLSearchParams({ k: token.ler(), acao, id: id ? String(id) : '', ...extra }) });
  if (r.status === 401) throw new Error('Sessão expirada. Entre de novo.');
  if (!r.ok) throw new Error('O servidor respondeu ' + r.status);
  return r.json();
}

function cpfValido(d: string) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => { let t = 0; for (let i = 0; i < n; i++) t += +d[i] * (n + 1 - i); const r = (t * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +d[9] && dv(10) === +d[10];
}
/** telefone BR: 10/11 dígitos (DDD 11–99) ou 12/13 com 55 */
function ehTelefone(d: string) {
  const n = d.length >= 12 && d.startsWith('55') ? d.slice(2) : d;
  return /^[1-9][1-9]\d{8,9}$/.test(n) && (n.length === 10 || n[2] === '9');
}

/** lê lista colada da planilha ou CSV: nome, telefone, cpf, margem (com ou sem cabeçalho) */
function lerLista(txt: string) {
  const L = String(txt || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!L.length) return [];
  const sep = L[0].includes('\t') ? '\t' : (L[0].split(';').length >= L[0].split(',').length ? ';' : ',');
  const cab = L[0].toLowerCase().split(sep).map(x => x.trim().replace(/"/g, ''));
  const temCab = cab.some(x => /nome|tel|fone|celular|whats|cpf|margem/.test(x));
  const idx = (k: RegExp) => (temCab ? cab.findIndex(x => k.test(x)) : -1);
  const H = { n: idx(/nome/), t: idx(/tel|fone|celular|whats|n[uú]mero/), c: idx(/cpf/), m: idx(/margem|parcela|valor/) };
  const out: { nome: string; telefone: string; cpf: string; margem: string }[] = [];
  for (const l of temCab ? L.slice(1) : L) {
    const c = l.split(sep).map(x => x.trim().replace(/^"|"$/g, ''));
    const dig = c.map(x => x.replace(/\D/g, ''));
    // sem cabeçalho: CPF válido (dígito verificador) é CPF; telefone é o número com DDD que não é o CPF
    const fmtCpf = (i: number) => /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(c[i]);
    const cpf = H.c >= 0 ? dig[H.c] || ''
      : dig.find((d, i) => fmtCpf(i) || (cpfValido(d) && dig.some((o, j) => j !== i && ehTelefone(o)))) || '';
    let tel = H.t >= 0 ? dig[H.t] || '' : dig.find(d => d !== cpf && ehTelefone(d)) || '';
    if (tel.length < 10 || tel === cpf) continue;
    const nome = H.n >= 0 ? c[H.n] : c.find(x => /[a-zA-ZÀ-ú]{2,}/.test(x)) || '';
    out.push({ nome, telefone: tel, cpf, margem: H.m >= 0 ? c[H.m] || '' : '' });
  }
  return out;
}

const fmtWa = (t: string) => t.replace(/[&<>]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[s]!)).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/_([^_\n]+)_/g, '<i>$1</i>').replace(/\n/g, '<br>');
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function Disparos() {
  const [d, setD] = useState<Resp | null>(null);
  const [sel, setSel] = useState<number>(() => { try { return Number(localStorage.getItem('gm_dp') || 0); } catch { return 0; } });
  const [ed, setEd] = useState<Ed | null>(null);
  const [msg, setMsg] = useState('');
  const [novas, setNovas] = useState<{ de: number; lista: string[] }>({ de: 0, lista: [] });
  const [gerando, setGerando] = useState(false);
  const [lista, setLista] = useState('');
  const [prevIdx, setPrevIdx] = useState(0);
  const [testeNum, setTesteNum] = useState('');
  const edRef = useRef(ed); edRef.current = ed;

  const carregar = useCallback(async (acao = 'ver', extra: Record<string, string> = {}, id?: number) => {
    try {
      const r = await chamar(acao, id ?? sel, extra);
      setD(r);
      if (r.atual && (acao === 'criar' || acao === 'duplicar')) { setSel(r.atual); setEd(null); }
      setMsg(r.erro ? '⚠️ ' + r.erro : r.aviso ? '✅ ' + r.aviso : '');
      return r;
    } catch (e) { setMsg('⚠️ ' + (e as Error).message); return null; }
  }, [sel]);

  useEffect(() => { carregar('ver'); }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { localStorage.setItem('gm_dp', String(sel)); } catch { /* sem storage */ } }, [sel]);
  // atualiza o andamento a cada 30 s enquanto não há edição pendente
  useEffect(() => { const t = setInterval(() => { if (!edRef.current?.sujo) carregar('ver'); }, 30000); return () => clearInterval(t); }, [carregar]);

  const L = d?.disparos ?? [];
  const atual = L.find(x => x.id === sel) ?? L[0];
  useEffect(() => { if (atual && atual.id !== sel) setSel(atual.id); }, [atual, sel]);
  useEffect(() => {
    if (!atual || (ed && ed.id === atual.id)) return;
    const x = atual.extra || {};
    setEd({ id: atual.id, nome: atual.nome, numeros: [...(atual.numeros || [])], intervalo_min: atual.intervalo_min, hora_inicio: atual.hora_inicio, hora_fim: atual.hora_fim, aba: 0, sujo: false,
      mensagens: (atual.mensagens?.length ? atual.mensagens : [{ texto: '', variacoes: [] }]).map(m => { const e = ('extra' in m ? m.extra || {} : x) as Partial<Msg>;
        return { texto: m.texto || '', variacoes: [...(m.variacoes || [])], imagem: e.imagem || '', rodape: e.rodape || '', botoes: (e.botoes || []).map(b => ({ tipo: b.tipo === 'link' ? 'link' : 'resposta', texto: b.texto || '', url: b.url || '' })) as Botao[] }; }) });
  }, [atual, ed]);

  const muda = (f: (e: Ed) => void) => setEd(e => { if (!e) return e; const n: Ed = JSON.parse(JSON.stringify(e)); f(n); n.sujo = true; return n; });
  const M = ed ? ed.mensagens[ed.aba] || ed.mensagens[0] : null;

  function validar(): string {
    const E = ed!;
    if (!E.mensagens.some(m => m.texto.trim().length >= 15 || m.variacoes.some(v => v.trim().length >= 15))) return 'Escreva pelo menos uma mensagem.';
    for (const [i, m] of E.mensagens.entries()) {
      const q = E.mensagens.length > 1 ? ` (mensagem ${i + 1})` : '';
      for (const b of m.botoes) { if (!b.texto.trim()) return 'Tem botão sem texto' + q + '.'; if (b.tipo === 'link' && !/^https?:\/\/\S+$/.test(b.url.trim())) return `O link do botão “${b.texto}”${q} precisa começar com https://`; }
      if (m.imagem && !m.botoes.length) return 'A imagem só vai junto com pelo menos 1 botão' + q + '.';
    }
    if (+E.hora_fim <= +E.hora_inicio) return 'O horário de fim precisa ser depois do início.';
    return '';
  }
  const extraMsg = (m: Msg) => ({ imagem: m.imagem || '', rodape: (m.rodape || '').trim(), botoes: m.botoes.map(b => ({ tipo: b.tipo, texto: b.texto.trim(), url: (b.url || '').trim() })) });
  async function salvar() {
    const e = validar(); if (e) { setMsg('⚠️ ' + e); return false; }
    const E = ed!;
    const r = await carregar('salvar', { nome: E.nome.trim(), numeros: JSON.stringify(E.numeros), intervalo_min: String(E.intervalo_min), hora_inicio: String(E.hora_inicio), hora_fim: String(E.hora_fim),
      mensagens: JSON.stringify(E.mensagens.map(m => ({ texto: m.texto.trim(), variacoes: m.variacoes.map(v => v.trim()).filter(v => v.length >= 15), extra: extraMsg(m) })).filter(m => m.texto.length >= 15 || m.variacoes.length)),
      extra: JSON.stringify(extraMsg(E.mensagens[0])) });
    if (r && !r.erro) { const ab = E.aba; setEd(null); setTimeout(() => setEd(x => (x ? { ...x, aba: Math.min(ab, x.mensagens.length - 1) } : x)), 0); return true; }
    return false;
  }
  const salvarAntes = async () => (ed?.sujo ? salvar() : true);
  async function comecar() {
    if (!(await salvarAntes()) || !atual) return;
    const R = atual.resumo || {};
    if (confirm(`Começar o disparo “${atual.nome}”?\n\n${R.na_fila || 0} contatos na fila · ${atual.numeros.length} número(s) · 1 mensagem por número a cada ${atual.intervalo_min} min, das ${atual.hora_inicio}h às ${atual.hora_fim}h.`)) carregar('ativar');
  }
  async function gerar() {
    if (!M || M.texto.trim().length < 15) { setMsg('⚠️ Escreva a mensagem base antes de gerar.'); return; }
    setGerando(true); const de = ed!.aba;
    const r = await carregar('gerar', { mensagem: M.texto.trim() });
    if (r?.variacoes_novas) setNovas({ de, lista: r.variacoes_novas });
    setGerando(false);
  }
  async function teste() {
    const ab = ed?.aba ?? 0;
    if (!(await salvarAntes())) return;
    const r = await carregar('teste', { nome: testeNum || (d?.numeros.find(n => n.estado === 'open')?.nome ?? ''), msg: String(ab + 1) });
    if (r && !r.erro) for (let i = 0; i < 12; i++) { await new Promise(s => setTimeout(s, 15000)); const x = await carregar('ver'); const t = x?.testes?.[0]; if (!t || t.enviado_em || t.erro) break; }
  }
  function imagem(f: File) {
    const img = new Image(), u = URL.createObjectURL(f);
    setMsg('Enviando imagem…');
    img.onload = async () => {
      URL.revokeObjectURL(u);
      const k = Math.min(1, 1080 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      try {
        const r = await fetch(BASE + '/escritorio/campanha', { method: 'POST', body: new URLSearchParams({ k: token.ler(), acao: 'imagem', dados: c.toDataURL('image/jpeg', 0.85).split(',')[1] }) });
        const j = await r.json();
        if (j.imagem_url) { muda(e => { e.mensagens[e.aba].imagem = j.imagem_url; }); setMsg(''); } else setMsg('⚠️ ' + (j.erro || 'não consegui enviar a imagem'));
      } catch { setMsg('⚠️ não consegui enviar a imagem'); }
    };
    img.src = u;
  }
  async function relatorio() {
    if (!atual) return;
    const j = await chamar('relatorio', atual.id).catch(() => null) as unknown as { contatos: Record<string, string>[] } | null;
    if (!j) return setMsg('⚠️ Não consegui gerar o relatório');
    const q = (v: unknown) => { const s = v == null ? '' : String(v); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const linhas = [['Nome', 'Telefone', 'CPF', 'Situação', 'Status do envio', 'Mensagem', 'Número', 'Margem', 'Enviado em', 'Erro'].join(';'),
      ...(j.contatos || []).map(c => [c.nome, c.telefone, c.cpf, c.situacao, c.status, c.msg, c.instancia, c.margem, c.enviado_em ? new Date(c.enviado_em).toLocaleString('pt-BR') : '', c.erro].map(q).join(';'))];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = `disparo-${atual.id}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  }

  const linhasLista = lerLista(lista);
  const hora = new Date().getHours(), saud = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const V = M ? M.variacoes.filter(v => v.trim().length >= 15) : [];
  const textoPrev = M ? (V.length ? V[prevIdx % V.length] : M.texto).replace(/\{saudacao\}/gi, saud).replace(/\{nome\}/g, 'Maria').replace(/\{margem\}/g, 'R$ 1.234,56') : '';
  const fim = atual ? ['encerrado', 'concluido'].includes(atual.status) : false;
  const R = atual?.resumo || {};
  const env = +(R.enviadas || 0);
  const pc = (v?: number) => (env ? Math.round(((v || 0) / env) * 100) + '%' : '');
  const N = (d?.numeros || []).filter(n => n.funcao === 'disparo' || ed?.numeros.includes(n.nome));

  return (
    <div>
      <Titulo titulo="Disparos" sub="Listas pelo WhatsApp (Baileys): várias mensagens em teste, variações com IA, botões, imagem e acompanhamento." />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="cartao h-fit p-3">
          <div className="mb-2 flex items-center justify-between"><b>Disparos</b><button className="bt bt-pri bt-sm" onClick={() => { if (ed?.sujo && !confirm('Tem alterações não salvas. Criar outro mesmo assim?')) return; setEd(null); carregar('criar'); }}><Plus size={14} /> Novo</button></div>
          {!d ? <p className="text-sm text-apagado">Carregando…</p> : !L.length ? <p className="text-sm text-apagado">Nenhum disparo ainda.</p> : L.map(x => {
            const t = +(x.resumo?.total || 0), e2 = +(x.resumo?.enviadas || 0), st = ST[x.status] || ST.rascunho;
            return (
              <button key={x.id} className={clsx('mb-1 block w-full rounded-lg border px-3 py-2 text-left', x.id === atual?.id ? 'border-marca bg-marca-claro' : 'border-borda hover:bg-fundo')}
                onClick={() => { if (ed?.sujo && !confirm('Tem alterações não salvas. Trocar mesmo assim?')) return; setSel(x.id); setEd(null); setNovas({ de: 0, lista: [] }); }}>
                <div className="flex items-center justify-between gap-2"><b className="truncate text-sm">{x.nome}</b><Etiqueta cor={st[1]}>{st[0]}</Etiqueta></div>
                <div className="text-xs text-apagado">{e2} de {t} enviadas · {x.resumo?.atendimento || 0} chamaram</div>
                <div className="mt-1 h-1 rounded bg-fundo"><div className="h-1 rounded bg-marca" style={{ width: (t ? Math.round((e2 / t) * 100) : 0) + '%' }} /></div>
              </button>
            );
          })}
        </aside>

        {!atual || !ed ? <Vazio>{d ? 'Crie um disparo para começar.' : 'Carregando…'}</Vazio> : (
          <div className="min-w-0 space-y-4">
            <section className="cartao p-4">
              <div className="flex flex-wrap items-center gap-2">
                <input className="campo w-auto min-w-[220px] flex-1 font-semibold" maxLength={60} value={ed.nome} aria-label="Nome do disparo" onChange={e => muda(x => { x.nome = e.target.value; })} />
                <Etiqueta cor={(ST[atual.status] || ST.rascunho)[1]}>{(ST[atual.status] || ST.rascunho)[0]}</Etiqueta>
                <button className="bt bt-sm" onClick={relatorio}><Download size={14} /> Relatório</button>
                {atual.status === 'ativo' ? <button className="bt bt-sm" onClick={() => carregar('pausar')}>Pausar</button>
                  : !fim && <button className="bt bt-pri bt-sm" onClick={comecar}>{atual.status === 'pausado' ? 'Continuar' : 'Começar disparo'}</button>}
                {!fim && atual.status !== 'rascunho' && <button className="bt bt-sm" onClick={() => confirm('Encerrar este disparo? Quem ainda está na fila não recebe.') && carregar('encerrar')}>Encerrar</button>}
                {atual.status === 'rascunho' && !env && <button className="bt bt-sm" onClick={() => confirm('Apagar este rascunho?') && carregar('apagar')}>Apagar</button>}
                <button className="bt bt-sm" onClick={async () => { if ((await salvarAntes()) && confirm('Criar um disparo novo com as mesmas mensagens, números e ritmo? A lista não é copiada.')) carregar('duplicar'); }}><Copy size={14} /> Duplicar</button>
                <button className="bt bt-sm" onClick={() => carregar('ver')}>Atualizar</button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:grid-cols-6 xl:grid-cols-11">
                {([['Na fila', R.na_fila], ['Enviando', R.enviando], ['Enviadas', env], ['Entregues', R.entregues, 1], ['Lidas', R.lidas, 1], ['Responderam', R.responderam, 1], ['Chamaram', R.atendimento, 1], ['Simularam', R.simularam, 1], ['Propostas', R.propostas, 1], ['Pagos', R.pagos, 1], ['Bloquearam', R.bloquearam, 1]] as [string, number | undefined, number?][]).map(([n, v, p]) => (
                  <div key={n} className="rounded-lg bg-fundo p-2"><div className="num text-lg font-semibold">{+(v || 0)}</div><div className="text-[11px] text-apagado">{n}</div>{p ? <div className="text-[11px] text-apagado">{pc(v)}</div> : null}</div>
                ))}
              </div>
              {(d!.por_mensagem || []).length > 0 && (
                <div className="mt-3 overflow-x-auto"><table className="tabela"><thead><tr><th>Mensagem</th><th>Enviadas</th><th>Entregues</th><th>Responderam</th><th>Chamaram</th><th>Simularam</th><th>Bloquearam</th></tr></thead>
                  <tbody>{d!.por_mensagem.map(x => <tr key={x.msg}><td>{+x.msg ? 'Mensagem ' + x.msg : 'Removida'}</td><td>{x.enviadas}</td><td>{x.entregues}</td><td>{x.responderam}</td><td>{x.atendimento}</td><td>{x.simularam}</td><td>{x.bloquearam}</td></tr>)}</tbody></table></div>
              )}
              {(d!.por_numero || []).length > 0 && (
                <div className="mt-3 overflow-x-auto"><table className="tabela"><thead><tr><th>Número</th><th>Enviadas</th><th>Responderam</th><th>Chamaram</th><th>Bloquearam</th></tr></thead>
                  <tbody>{d!.por_numero.map(x => <tr key={x.nome}><td>{fmtTel(d!.numeros.find(y => y.nome === x.nome)?.numero || '') || x.nome}</td><td>{x.enviadas}</td><td>{x.responderam}</td><td>{x.atendimento}</td><td>{x.bloquearam}</td></tr>)}</tbody></table></div>
              )}
            </section>

            <section className="cartao p-4">
              <h3 className="mb-2 font-semibold">Números e ritmo</h3>
              <div className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {N.length ? N.map(n => (
                  <label key={n.nome} className={clsx('flex items-center gap-2 rounded-lg border border-borda p-2 text-sm', n.estado !== 'open' && 'opacity-60')}>
                    <input type="checkbox" checked={ed.numeros.includes(n.nome)} onChange={e => muda(x => { x.numeros = e.target.checked ? [...x.numeros, n.nome] : x.numeros.filter(y => y !== n.nome); })} />
                    <span><b>{fmtTel(n.numero) || n.nome}</b><br /><span className="text-xs text-apagado">{n.estado === 'open' ? (n.trava_ate ? '⚠️ restrito pelo WhatsApp' : 'conectado') : 'desconectado'} · {n.enviadas} nas últimas 24h</span></span>
                  </label>)) : <p className="text-sm text-apagado">Nenhum número com função Disparo.</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">Cada número manda 1 mensagem a cada
                <input type="number" min={1} max={120} className="campo w-16" value={ed.intervalo_min} onChange={e => muda(x => { x.intervalo_min = +e.target.value; })} /> min, das
                <input type="number" min={0} max={23} className="campo w-16" value={ed.hora_inicio} onChange={e => muda(x => { x.hora_inicio = +e.target.value; })} />h às
                <input type="number" min={1} max={24} className="campo w-16" value={ed.hora_fim} onChange={e => muda(x => { x.hora_fim = +e.target.value; })} />h.
                <span className="text-xs text-apagado">~{Math.round((ed.numeros.length * 60) / Math.max(1, ed.intervalo_min || 5))} mensagens por hora</span></div>
            </section>

            <section className="cartao grid gap-4 p-4 xl:grid-cols-[1fr_300px]">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2"><h3 className="font-semibold">Mensagens</h3>
                  {L.filter(x => x.id !== atual.id && (x.mensagens || []).length).length > 0 && (
                    <select className="campo ml-auto w-auto text-xs" value="" onChange={e => { const o = L.find(x => String(x.id) === e.target.value); if (o && confirm(`Trocar as mensagens deste disparo pelas do “${o.nome}”?`)) { setEd(null); carregar('copiar', { origem: e.target.value }); } }}>
                      <option value="">Copiar mensagens de…</option>{L.filter(x => x.id !== atual.id && (x.mensagens || []).length).map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
                    </select>)}
                </div>
                <p className="mb-2 text-xs text-apagado">Até 5 mensagens para testar qual funciona melhor; o sistema reveza entre elas. Cada uma pode ter variações para nenhum envio sair igual.</p>
                <div className="mb-3 flex flex-wrap gap-1">
                  {ed.mensagens.map((m, i) => <button key={i} className={clsx('bt bt-sm', i === ed.aba && 'bt-pri')} onClick={() => { setEd({ ...ed, aba: i }); setNovas({ de: 0, lista: [] }); }}>Mensagem {i + 1} <span className="text-[10px] opacity-80">({m.variacoes.length} var.)</span></button>)}
                  {ed.mensagens.length < 5 && <button className="bt bt-sm" onClick={() => muda(x => { const b = x.mensagens[x.aba]; x.mensagens.push({ texto: '', variacoes: [], imagem: b.imagem, rodape: b.rodape, botoes: b.botoes.map(y => ({ ...y })) }); x.aba = x.mensagens.length - 1; })}>+ Mensagem</button>}
                </div>
                {M && <>
                  <label className="rotulo flex items-center">Texto da mensagem {ed.aba + 1}
                    {ed.mensagens.length > 1 && <button className="ml-auto text-xs text-red-600 underline" onClick={() => confirm(`Tirar a mensagem ${ed.aba + 1}?`) && muda(x => { x.mensagens.splice(x.aba, 1); x.aba = 0; })}>tirar esta mensagem</button>}</label>
                  <textarea rows={5} className="campo" maxLength={800} value={M.texto} onChange={e => muda(x => { x.mensagens[x.aba].texto = e.target.value; })} />
                  <p className="mb-3 text-xs text-apagado">{'{saudacao}'} vira Bom dia/Boa tarde/Boa noite · {'{nome}'} o primeiro nome · {'{margem}'} a margem da lista · *negrito*</p>
                  <div className="rotulo">Variações ({M.variacoes.length})</div>
                  {M.variacoes.map((v, j) => (
                    <div key={j} className="mb-2 flex gap-2"><textarea rows={3} className="campo" maxLength={800} value={v} onChange={e => muda(x => { x.mensagens[x.aba].variacoes[j] = e.target.value; })} />
                      <button className="bt bt-sm h-fit" aria-label="Tirar variação" onClick={() => muda(x => { x.mensagens[x.aba].variacoes.splice(j, 1); })}><X size={14} /></button></div>))}
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button className="bt bt-sm" onClick={gerar} disabled={gerando}><Sparkles size={14} /> {gerando ? 'Gerando… (até 30 s)' : 'Gerar variações com IA'}</button>
                    <button className="bt bt-sm" onClick={() => muda(x => { x.mensagens[x.aba].variacoes.push(''); })}>+ Escrever uma</button>
                  </div>
                  {novas.lista.length > 0 && novas.de === ed.aba && (
                    <div className="mb-3 rounded-lg border border-marca p-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm"><b>Sugestões da IA</b><button className="bt bt-pri bt-sm ml-auto" onClick={() => { muda(x => { x.mensagens[novas.de].variacoes.push(...novas.lista); }); setNovas({ de: 0, lista: [] }); }}>Aprovar todas</button><button className="bt bt-sm" onClick={() => setNovas({ de: 0, lista: [] })}>Descartar</button></div>
                      {novas.lista.map((v, j) => (
                        <div key={j} className="mb-2 flex items-start gap-2 rounded bg-fundo p-2 text-sm"><div className="flex-1" dangerouslySetInnerHTML={{ __html: fmtWa(v) }} />
                          <button className="bt bt-sm" onClick={() => { muda(x => { x.mensagens[novas.de].variacoes.push(v); }); setNovas(n => ({ ...n, lista: n.lista.filter((_, k) => k !== j) })); }}>Aprovar</button></div>))}
                    </div>)}
                  <div className="rotulo">Imagem (vai junto com os botões)</div>
                  <div className="mb-3 flex items-center gap-2">{M.imagem && <><img src={M.imagem} alt="" className="h-16 rounded" /><button className="bt bt-sm" onClick={() => muda(x => { x.mensagens[x.aba].imagem = ''; })}>Remover</button></>}
                    <label className="bt bt-sm cursor-pointer">{M.imagem ? 'Trocar' : '+ Escolher imagem'}<input type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && imagem(e.target.files[0])} /></label></div>
                  <label className="rotulo">Rodapé (opcional)</label>
                  <input className="campo mb-3" maxLength={60} placeholder="GM Cred · crédito CLT" value={M.rodape} onChange={e => muda(x => { x.mensagens[x.aba].rodape = e.target.value; })} />
                  <div className="rotulo">Botões (até 3 · até 20 letras)</div>
                  {M.botoes.map((b, i) => (
                    <div key={i} className="mb-2 flex flex-wrap gap-2">
                      <select className="campo w-auto" value={b.tipo} onChange={e => muda(x => { x.mensagens[x.aba].botoes[i].tipo = e.target.value as Botao['tipo']; })}><option value="link">Abrir link</option><option value="resposta">Resposta rápida</option></select>
                      <input className="campo w-40" maxLength={20} placeholder={b.tipo === 'link' ? 'CLIQUE AQUI' : 'BLOQUEAR'} value={b.texto} onChange={e => muda(x => { x.mensagens[x.aba].botoes[i].texto = e.target.value; })} />
                      {b.tipo === 'link' && <input className="campo min-w-[180px] flex-1" placeholder="https://wa.me/55..." value={b.url} onChange={e => muda(x => { x.mensagens[x.aba].botoes[i].url = e.target.value; })} />}
                      <button className="bt bt-sm" aria-label="Tirar botão" onClick={() => muda(x => { x.mensagens[x.aba].botoes.splice(i, 1); })}><X size={14} /></button>
                    </div>))}
                  {M.botoes.length < 3 && <button className="bt bt-sm mb-1" onClick={() => muda(x => { x.mensagens[x.aba].botoes.push({ tipo: 'link', texto: '', url: '' }); })}>+ Adicionar botão</button>}
                  <p className="mb-3 text-xs text-apagado">Resposta rápida “BLOQUEAR”: o cliente sai da lista e a Ana se despede.</p>
                  <div className="flex flex-wrap items-center gap-2 border-t border-borda pt-3">
                    <button className="bt bt-pri" onClick={salvar}>Salvar</button>
                    <select className="campo w-auto" value={testeNum} onChange={e => setTesteNum(e.target.value)} aria-label="Número do teste">
                      {(d!.numeros || []).filter(n => n.estado === 'open').map(n => <option key={n.nome} value={n.nome}>{fmtTel(n.numero) || n.nome}</option>)}</select>
                    <button className="bt" onClick={teste}>Enviar teste para mim</button>
                    <span className="text-sm text-suave">{ed.sujo ? 'alterações não salvas · ' : ''}{msg}</span>
                  </div>
                  {(d!.testes || []).slice(0, 2).map(t => <div key={t.criado_em} className="mt-1 text-xs text-apagado">Teste das {quando(t.criado_em)}: {t.enviado_em ? '✅ enviado' : t.erro ? '❌ ' + t.erro : 'na fila (até 2 min)…'}</div>)}
                </>}
              </div>
              {M && (
                <div>
                  <div className="rounded-xl bg-[#efeae2] p-3 dark:bg-[#0b141a]">
                    <div className="max-w-[260px] rounded-lg bg-white p-2 text-sm text-gray-900 shadow dark:bg-[#202c33] dark:text-gray-100">
                      {M.botoes.some(b => b.texto.trim()) && M.imagem && <img src={M.imagem} alt="" className="mb-1 rounded" />}
                      <div dangerouslySetInnerHTML={{ __html: fmtWa(textoPrev) || '<span style="color:#98a2b3">Escreva a mensagem…</span>' }} />
                      {M.botoes.some(b => b.texto.trim()) && M.rodape.trim() && <div className="mt-1 text-xs text-gray-500">{M.rodape}</div>}
                      {M.botoes.filter(b => b.texto.trim()).map((b, i) => <div key={i} className="mt-1 border-t border-gray-200 pt-1 text-center text-[#00a884]">{b.texto}</div>)}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-apagado">Prévia da mensagem {ed.aba + 1} · <button className="underline" onClick={() => setPrevIdx(i => i + 1)}>sortear outra</button></p>
                </div>)}
            </section>

            <section className="cartao p-4">
              <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">Lista · {R.total || 0} contatos</h3>
                {!!R.na_fila && <button className="bt bt-sm" onClick={() => confirm('Tirar da fila quem ainda não recebeu?') && carregar('limpar_fila')}>Limpar fila</button>}</div>
              {!fim && (
                <details className="mb-3" open={!R.total}>
                  <summary className="cursor-pointer text-sm font-medium">Importar contatos <span className="text-xs text-apagado">(cole da planilha: nome e telefone; CPF e margem opcionais)</span></summary>
                  <textarea rows={5} className="campo mt-2" placeholder={'Maria da Silva\t48999998888'} value={lista} onChange={e => setLista(e.target.value)} />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="bt bt-sm cursor-pointer">Escolher CSV<input type="file" accept=".csv,.txt" hidden onChange={e => { const f = e.target.files?.[0]; if (f) f.text().then(setLista); }} /></label>
                    <span className="text-sm text-suave">{linhasLista.length ? linhasLista.length + ' contato(s) prontos' : lista.trim() ? '⚠️ nenhum telefone encontrado' : ''}</span>
                    <button className="bt bt-pri bt-sm ml-auto" disabled={!linhasLista.length} onClick={async () => { if (await salvarAntes()) { await carregar('importar', { linhas: JSON.stringify(linhasLista) }); setLista(''); } }}>Importar</button>
                  </div>
                </details>)}
              {(d!.contatos || []).length ? (
                <div className="overflow-x-auto"><table className="tabela"><thead><tr><th>Cliente</th><th>Telefone</th><th>Número</th><th>Situação</th><th>Enviado</th></tr></thead>
                  <tbody>{d!.contatos.map((c, i) => { const s2 = c.status === 'na_fila' ? 'Na fila' : c.status === 'removido' ? c.erro || 'Removido' : c.situacao || 'Enviada';
                    const cor: Cor = /Pago|Proposta|Simulou|Chamou|Respondeu/.test(s2) ? 'verde' : /Bloqueou|Não entregue|Removido|bloqueado/.test(s2) ? 'vermelho' : /Lida|Entregue/.test(s2) ? 'roxo' : 'cinza';
                    return <tr key={i}><td>{c.nome || 'Sem nome'}</td><td className="num">{fmtTel(c.telefone)}</td><td>{c.instancia ? fmtTel(d!.numeros.find(y => y.nome === c.instancia)?.numero || '') || c.instancia : '—'}</td><td><Etiqueta cor={cor}>{s2}</Etiqueta></td><td className="text-xs">{c.enviado_em ? quando(c.enviado_em) : '—'}</td></tr>; })}</tbody></table>
                  {d!.contatos.length >= 400 && <p className="mt-1 text-xs text-apagado">Mostrando os 400 mais recentes.</p>}</div>
              ) : <p className="text-sm text-apagado">Nenhum contato importado ainda.</p>}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
