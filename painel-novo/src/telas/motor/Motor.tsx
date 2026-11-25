import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Copy, ExternalLink, Loader2, Send, Trophy, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { Etiqueta, Modal, Titulo, Vazio, type Cor } from '@/componentes/ui';
import { useDados } from '@/estado/Dados';
import { painel, type RegrasComissao } from '@/api/painel';
import { brl, mascaraCpf, soDigitos, validaCpf } from '@/util/formato';
import {
  motor, SemAcesso, PARTES, PENDENTE,
  type ConsultaMotor, type DadosDigitacao, type OfertaMotor, type Parte, type ParteId, type ResultadoDigitacao, type Situacao,
} from '@/api/motor';

const SITUACAO: Record<Situacao, [string, Cor]> = {
  iniciando: ['Consultando', 'roxo'], processando: ['Consultando', 'roxo'], simulando: ['Simulando', 'roxo'],
  aguardando_termo: ['Aguardando termo', 'amarelo'], aguardando_autorizacao: ['Aguardando autorização', 'amarelo'],
  ofertas: ['Com ofertas', 'verde'], sem_ofertas: ['Sem ofertas', 'cinza'], sem_margem: ['Sem margem', 'cinza'],
  sem_saldo: ['Sem saldo', 'cinza'], sem_autorizacao: ['Sem autorização', 'amarelo'], sem_adesao: ['Sem adesão', 'amarelo'], erro: ['Erro', 'vermelho'],
};
const corOk = (c: string): Cor => (['cinza', 'verde', 'amarelo', 'vermelho', 'roxo'].includes(c) ? (c as Cor) : 'cinza');

/** texto para mandar ao cliente: CLT = prazo, parcela e liberado; FGTS = só o liberado */
const textoCliente = (produto: 'CLT' | 'FGTS', o: OfertaMotor) =>
  produto === 'CLT' ? `${o.prazo}x de ${brl(o.parcela ?? 0)}\nValor liberado: ${brl(o.valor)}` : `Valor liberado: ${brl(o.valor)}`;

function BotaoCopiar({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="shrink-0 px-3 py-1.5 text-apagado hover:text-texto" title="Copiar para mandar ao cliente" aria-label="Copiar"
      onClick={() => { navigator.clipboard?.writeText(texto).then(() => { setOk(true); setTimeout(() => setOk(false), 1200); }); }}>
      {ok ? <CheckCircle2 size={14} className="text-green-600" /> : <Copy size={14} />}
    </button>
  );
}

type Grupo = { chave: string; tabela: string; banco: string; ofertas: OfertaMotor[]; maxComissao: number; minParcela: number; maxValor: number };

/** junta as ofertas de um banco por tabela; a tabela que mais comissiona vem primeiro */
function agrupar(p: Parte | undefined): Grupo[] {
  const g: Record<string, Grupo> = {};
  for (const o of p?.ofertas ?? []) {
    const k = o.banco + '|' + o.tabela;
    const x = g[k] ?? (g[k] = { chave: k, tabela: o.tabela || 'Tabela', banco: o.banco, ofertas: [], maxComissao: 0, minParcela: Infinity, maxValor: 0 });
    x.ofertas.push(o);
    x.maxComissao = Math.max(x.maxComissao, o.comissao ?? 0);
    if (o.parcela) x.minParcela = Math.min(x.minParcela, o.parcela);
    x.maxValor = Math.max(x.maxValor, o.valor);
  }
  const lista = Object.values(g);
  lista.forEach(x => x.ofertas.sort((a, b) => (b.comissao ?? -1) - (a.comissao ?? -1) || b.valor - a.valor));
  return lista.sort((a, b) => b.maxComissao - a.maxComissao || b.maxValor - a.maxValor);
}

function CartaoBanco({ id, parte, digitar }: { id: ParteId; parte: Parte | undefined; digitar: (p: ParteId, o: OfertaMotor) => void }) {
  const info = PARTES.find(x => x.id === id)!;
  const [aberto, setAberto] = useState<string | null>(null);
  const grupos = useMemo(() => agrupar(parte), [parte]);
  const sit = parte?.situacao ?? 'iniciando';
  const [nome, cor] = SITUACAO[sit] ?? ['—', 'cinza'];
  const pendente = PENDENTE.includes(sit);
  const semMargem = sit === 'sem_margem';
  return (
    <section className="cartao overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-borda px-4 py-3">
        <div className="font-semibold">{info.banco} <span className="text-xs font-normal text-apagado">{info.produto}</span></div>
        <span className="inline-flex items-center gap-1.5">
          {pendente ? <Loader2 size={14} className="animate-spin text-apagado" /> : sit === 'ofertas' ? <CheckCircle2 size={14} className="text-green-600" /> : sit === 'erro' ? <AlertTriangle size={14} className="text-red-600" /> : <XCircle size={14} className="text-apagado" />}
          <Etiqueta cor={corOk(cor)}>{nome}</Etiqueta>
        </span>
      </div>
      {parte?.mensagem && !semMargem && <p className="px-4 pt-3 text-sm text-suave">{parte.mensagem}</p>}
      {parte?.detalhe && parte.detalhe.length > 0 && sit !== 'ofertas' && !semMargem && (
        <ul className="px-4 pt-2 text-xs text-apagado">{parte.detalhe.map(d => <li key={d.banco}>• <b>{d.banco}</b>: {SITUACAO[d.situacao]?.[0] ?? d.situacao}</li>)}</ul>
      )}
      {parte?.link_termo && <a className="mx-4 mt-2 inline-flex items-center gap-1 text-sm text-marca underline" href={parte.link_termo} target="_blank" rel="noreferrer">Link do termo <ExternalLink size={12} /></a>}
      {grupos.length > 0 && (
        <ul className="mt-2">
          {grupos.map(g => {
            const ab = aberto === g.chave;
            return (
              <li key={g.chave} className="border-t border-borda">
                <button className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-fundo" onClick={() => setAberto(ab ? null : g.chave)} aria-expanded={ab}>
                  {ab ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{g.tabela} {info.produto === 'FGTS' || g.banco !== info.banco ? <span className="text-xs font-normal text-apagado">· {g.banco}</span> : null}</div>
                    <div className="text-xs text-apagado">
                      {Number.isFinite(g.minParcela) ? <>a partir de <span className="num">{brl(g.minParcela)}</span>/mês · </> : null}até <span className="num">{brl(g.maxValor)}</span> · {g.ofertas.length} {g.ofertas.length === 1 ? 'oferta' : 'ofertas'}
                    </div>
                  </div>
                  {g.maxComissao > 0 && <span className="shrink-0 text-right text-xs text-green-700 dark:text-green-400">comissão<br /><b className="num text-sm">{brl(g.maxComissao)}</b></span>}
                </button>
                {ab && (
                  <ul className="divide-y divide-borda border-t border-borda bg-fundo/50">
                    {g.ofertas.map((o, i) => (
                      <li key={i} className="flex items-center">
                        <button className="flex min-w-0 flex-1 items-center gap-2 px-4 py-1.5 text-left text-xs hover:bg-marca-claro disabled:opacity-60" onClick={() => digitar(id, o)} title="Digitar esta oferta">
                          <span className="num w-8 shrink-0 font-medium">{o.prazo}x</span>
                          {o.parcela ? <span className="num w-16 shrink-0 text-suave">{brl(o.parcela)}</span> : null}
                          <span className="num flex-1 font-semibold">{brl(o.valor)}</span>
                          {info.produto === 'CLT' && <span className="w-7 shrink-0 text-apagado">{o.seguro === false ? 'sem' : 'seg'}</span>}
                          <span className="num w-24 shrink-0 text-right text-green-700 dark:text-green-400">{o.comissao != null ? <>com. {brl(o.comissao)}</> : '—'}</span>
                        </button>
                        <BotaoCopiar texto={textoCliente(info.produto, o)} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!grupos.length && !parte?.mensagem && !semMargem && <p className="px-4 py-3 text-sm text-apagado">{pendente ? 'Aguardando o banco…' : '—'}</p>}
      <div className="h-2" />
    </section>
  );
}

function Digitacao({ consulta, alvo, fechar }: { consulta: ConsultaMotor; alvo: { parte: ParteId; oferta: OfertaMotor }; fechar: () => void }) {
  const info = PARTES.find(x => x.id === alvo.parte)!;
  const [d, setD] = useState<DadosDigitacao>({ mae: '', pix_tipo: 'cpf', pix_chave: consulta.cpf, email: consulta.cliente.email ?? '' });
  const [indo, setIndo] = useState<'previa' | 'envio' | null>(null);
  const [res, setRes] = useState<ResultadoDigitacao | null>(null);
  const [erro, setErro] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const muda = (k: keyof DadosDigitacao, v: string) => setD(x => ({ ...x, [k]: v }));
  const o = alvo.oferta;
  async function vai(enviar: boolean) {
    setIndo(enviar ? 'envio' : 'previa'); setErro(''); setConfirmar(false);
    try { setRes(await motor.digitar(consulta.id, alvo.parte, o, d, enviar)); } catch (x) { setErro((x as Error).message); }
    setIndo(null);
  }
  const porConta = alvo.parte === 'hub_fgts' || alvo.parte === 'unno_fgts';
  const prontoEnviar = d.mae.trim().length > 3 && (porConta ? !!(d.banco && d.agencia && d.conta && d.conta_digito) : d.pix_chave.trim().length > 3);
  return (
    <Modal aberto fechar={fechar} titulo={`Digitar · ${info.banco} ${info.produto}`} largura="max-w-2xl"
      rodape={res?.enviado && res.ok ? <button className="bt" onClick={fechar}>Fechar</button> : (
        <>
          <button className="bt" onClick={() => vai(false)} disabled={!!indo}>{indo === 'previa' && <Loader2 size={14} className="animate-spin" />} Ver o que vai para o banco</button>
          {confirmar
            ? <button className="bt bt-perigo" onClick={() => vai(true)} disabled={!!indo}>{indo === 'envio' && <Loader2 size={14} className="animate-spin" />} Confirmar: criar proposta de verdade</button>
            : <button className="bt bt-pri" onClick={() => setConfirmar(true)} disabled={!prontoEnviar || !!indo}><Send size={14} /> Enviar proposta</button>}
        </>
      )}>
      <div className="mb-4 rounded-lg bg-fundo p-3 text-sm">
        <div className="font-medium">{consulta.cliente.nome ?? 'Cliente'} · <span className="num">{mascaraCpf(consulta.cpf)}</span></div>
        <div className="mt-1 text-base font-semibold text-marca">Tabela: {o.tabela}{o.banco ? ` · ${o.banco}` : ''}</div>
        <div className="text-suave">{o.prazo}x{o.parcela ? ` de ${brl(o.parcela)}` : ''} · libera <b className="num">{brl(o.valor)}</b>{o.comissao != null ? <> · comissão <b className="num">{brl(o.comissao)}</b></> : null}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="rotulo" htmlFor="mae">Nome da mãe *</label><input id="mae" className="campo" value={d.mae} onChange={e => muda('mae', e.target.value)} /></div>
        {porConta ? (<>
          <div><label className="rotulo" htmlFor="bco">Banco (código) *</label><input id="bco" className="campo num" inputMode="numeric" placeholder="ex.: 260" value={d.banco ?? ''} onChange={e => muda('banco', e.target.value.replace(/\D/g, ''))} /></div>
          <div><label className="rotulo" htmlFor="tpc">Tipo de conta *</label>
            <select id="tpc" className="campo" value={d.conta_tipo ?? 'corrente'} onChange={e => muda('conta_tipo', e.target.value)}><option value="corrente">Corrente</option><option value="poupanca">Poupança</option></select></div>
          <div className="grid grid-cols-[1fr_70px] gap-2"><div><label className="rotulo" htmlFor="ag">Agência *</label><input id="ag" className="campo num" inputMode="numeric" value={d.agencia ?? ''} onChange={e => muda('agencia', e.target.value.replace(/\D/g, ''))} /></div>
            <div><label className="rotulo" htmlFor="agd">Dígito</label><input id="agd" className="campo num" value={d.agencia_digito ?? ''} onChange={e => muda('agencia_digito', e.target.value)} /></div></div>
          <div className="grid grid-cols-[1fr_70px] gap-2"><div><label className="rotulo" htmlFor="cc">Conta *</label><input id="cc" className="campo num" inputMode="numeric" value={d.conta ?? ''} onChange={e => muda('conta', e.target.value.replace(/\D/g, ''))} /></div>
            <div><label className="rotulo" htmlFor="ccd">Dígito *</label><input id="ccd" className="campo num" value={d.conta_digito ?? ''} onChange={e => muda('conta_digito', e.target.value)} /></div></div>
        </>) : (<>
        <div><label className="rotulo" htmlFor="pixt">Tipo da chave PIX *</label>
          <select id="pixt" className="campo" value={d.pix_tipo} onChange={e => muda('pix_tipo', e.target.value)}>
            <option value="cpf">CPF</option><option value="phone">Celular</option><option value="email">E-mail</option><option value="random">Aleatória</option>
          </select></div>
        <div><label className="rotulo" htmlFor="pixc">Chave PIX *</label><input id="pixc" className="campo" value={d.pix_chave} onChange={e => muda('pix_chave', e.target.value)} /></div>
        </>)}
        <div className="sm:col-span-2"><label className="rotulo" htmlFor="em">E-mail do cliente</label><input id="em" className="campo" value={d.email} onChange={e => muda('email', e.target.value)} /></div>
      </div>
      <p className="mt-3 text-xs text-apagado">Preenchido automaticamente: nome, nascimento e celular (V8); RG 0000000/SSP/SP; endereço Servidão Unidos 654, Tapera da Base, Florianópolis/SC; solteiro; pai "NÃO CONSTA"; RH rh@gmail.com e DDD do cliente{info.banco === 'HUB' ? '; CPF do atendente da HUB' : ''}.</p>
      {erro && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/15 dark:text-red-300">{erro}</p>}
      {res && (
        <div className={clsx('mt-3 rounded-lg p-3 text-sm', res.ok ? 'bg-green-50 text-green-800 dark:bg-green-500/15 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300')}>
          {res.previa && res.ok && <div className="font-medium">Prévia montada — nada foi enviado ao banco.{res.faltando?.length ? ` Falta: ${res.faltando.join(', ')}.` : ''}</div>}
          {res.enviado && res.ok && <div className="font-medium">Proposta criada{res.proposta ? ` (${res.proposta})` : ''}.</div>}
          {!res.ok && <div className="font-medium">{res.erro}</div>}
          {res.link && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <a className="inline-flex items-center gap-1 underline" href={res.link} target="_blank" rel="noreferrer">Link de assinatura <ExternalLink size={12} /></a>
              <button className="bt bt-sm" onClick={() => navigator.clipboard?.writeText(res.link!)}><Copy size={12} /> Copiar</button>
            </div>
          )}
        </div>
      )}
      {res && (res.payload || res.rascunho_unno || res.resposta_banco) ? (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-apagado">Detalhes técnicos</summary>
          {res.rascunho_unno && <><div className="mt-2 font-medium">O que a Unno já tem do cliente</div><pre className="max-h-48 overflow-auto rounded bg-fundo p-2">{res.rascunho_unno}</pre></>}
          {res.payload ? <><div className="mt-2 font-medium">O que vai para o banco</div><pre className="max-h-64 overflow-auto rounded bg-fundo p-2">{JSON.stringify(res.payload, null, 2)}</pre></> : null}
          {res.resposta_banco && <><div className="mt-2 font-medium">Resposta do banco</div><pre className="max-h-48 overflow-auto rounded bg-fundo p-2">{res.resposta_banco}</pre></>}
        </details>
      ) : null}
    </Modal>
  );
}

export default function Motor() {
  const [params, setParams] = useSearchParams();
  const logado = true;
  const setLogado = (_: boolean) => { /* sessão é a do painel */ };
  const { usuario } = useDados();
  const [regras, setRegras] = useState<RegrasComissao | null>(null);
  useEffect(() => { painel.eu().then(r => setRegras(r.comissao)).catch(() => {}); }, []);
  const [cpf, setCpf] = useState(mascaraCpf(params.get('cpf') ?? ''));
  const [consulta, setConsulta] = useState<ConsultaMotor | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [erro, setErro] = useState('');
  const [alvo, setAlvo] = useState<{ parte: ParteId; oferta: OfertaMotor } | null>(null);
  // colaborador vê a comissão DELE: % sobre o que a GM Cred recebe (CLT pela faixa inicial do mês, FGTS fixo)
  const ehAdmin = usuario?.papel === 'admin';
  const pctEquipe = (prod: 'CLT' | 'FGTS') => (prod === 'CLT' ? regras?.clt?.[0]?.pct ?? 30 : regras?.fgts ?? 35);
  const vista = useMemo(() => {
    if (!consulta || ehAdmin) return consulta;
    const partes = Object.fromEntries(Object.entries(consulta.partes).map(([k, p]) => {
      const pct = pctEquipe(PARTES.find(x => x.id === k)?.produto ?? 'CLT');
      return [k, p && { ...p, ofertas: p.ofertas.map(o => ({ ...o, comissao: o.comissao == null ? null : Math.round(o.comissao * pct) / 100, comissao_pct: o.comissao_pct == null ? null : Math.round(o.comissao_pct * pct) / 100 })) }];
    }));
    return { ...consulta, partes } as ConsultaMotor;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta, ehAdmin, regras]);
  const rodada = useRef(0);
  const cpfOk = validaCpf(cpf);

  useEffect(() => () => { rodada.current++; }, []);

  // guarda a última consulta: sair da aba e voltar não perde o resultado (e continua acompanhando o que faltava)
  const ULTIMA = 'gm_motor_ultima';
  async function acompanhar(cInicial: ConsultaMotor | null, cpfNovo: string | null, idSalvo?: number) {
    const minha = ++rodada.current;
    setConsultando(true); setErro('');
    if (cpfNovo) setConsulta(null);
    try {
      let c = cInicial ?? (cpfNovo ? await motor.consultar(cpfNovo) : await motor.atualizar(idSalvo!));
      if (minha !== rodada.current) return;
      setConsulta(c); try { localStorage.setItem(ULTIMA, String(c.id)); } catch { /* sem storage */ }
      const inicio = Date.now();
      while (c.pendentes > 0 && Date.now() - inicio < 6 * 60_000) {
        await new Promise(r => setTimeout(r, 3500));
        if (minha !== rodada.current) return;
        c = await motor.atualizar(c.id);
        if (minha !== rodada.current) return;
        setConsulta(c);
      }
    } catch (x) {
      if (x instanceof SemAcesso) setLogado(false);
      if (minha === rodada.current) setErro((x as Error).message);
    }
    if (minha === rodada.current) setConsultando(false);
  }
  function consultar(e?: FormEvent) { e?.preventDefault(); if (cpfOk) acompanhar(null, soDigitos(cpf)); }
  useEffect(() => {
    if (!logado) return;
    // CPF vindo de outra aba (link): consulta uma vez e tira da URL, para atualizar a página não simular de novo
    if (params.get('cpf') && cpfOk) { setParams({}, { replace: true }); consultar(); return; }
    let id = 0; try { id = Number(localStorage.getItem(ULTIMA)) || 0; } catch { /* sem storage */ }
    if (id) acompanhar(null, null, id).then(() => setCpf(c => c));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logado]);
  useEffect(() => { if (consulta && !soDigitos(cpf)) setCpf(mascaraCpf(consulta.cpf)); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta]);



  return (
    <div>
      <Titulo titulo="Motor de Crédito" sub="Cola o CPF: consulta CLT e FGTS na V8, Unno e HUB e mostra primeiro o que mais comissiona."
/>

      <form onSubmit={consultar} className="cartao mb-5 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[220px] flex-1">
          <label className="rotulo" htmlFor="cpf">CPF do cliente</label>
          <input id="cpf" className="campo num text-lg" inputMode="numeric" placeholder="000.000.000-00" value={cpf}
            onChange={e => setCpf(mascaraCpf(e.target.value))}
            onPaste={e => { const t = soDigitos(e.clipboardData.getData('text')); if (t.length === 11) { e.preventDefault(); setCpf(mascaraCpf(t)); } }} />
          {soDigitos(cpf).length === 11 && !cpfOk && <p className="mt-1 text-xs text-red-600">CPF inválido.</p>}
        </div>
        <button className="bt bt-pri" disabled={!cpfOk || consultando}>{consultando && <Loader2 size={16} className="animate-spin" />} {consultando ? 'Consultando…' : 'Consultar'}</button>
        {consulta && <div className="w-full text-sm text-suave">{consulta.cliente.nome ?? '—'}{consulta.cliente.nascimento ? ` · nasc. ${consulta.cliente.nascimento.split('-').reverse().join('/')}` : ''}{consulta.pendentes > 0 ? ` · faltam ${consulta.pendentes} bancos responderem` : ' · todos os bancos responderam'}</div>}
      </form>

      {erro && <div className="cartao mb-5 border-red-300 p-4 text-sm text-red-700">{erro}</div>}

      {consulta && (
        <>
          {(['CLT', 'FGTS'] as const).map(prod => (
            <div key={prod} className="mb-5">
              <h2 className="mb-2 text-sm font-semibold text-suave">{prod}</h2>
              {(() => {
                // maior comissão deste produto (CLT ou FGTS)
                const m = PARTES.filter(p => p.produto === prod).flatMap(p => (vista!.partes[p.id]?.ofertas ?? []).map(o => ({ o, p })))
                  .filter(x => x.o.comissao != null).sort((a, b) => (b.o.comissao ?? 0) - (a.o.comissao ?? 0))[0];
                if (!m) return null;
                return (
                  <section className="cartao mb-3 flex items-center gap-3 border-marca px-4 py-2.5">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-1">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-marca"><Trophy size={16} /> {ehAdmin ? 'Maior comissão' : 'Sua maior comissão'} {prod}</div>
                    <div className="text-sm"><b>{m.p.banco}</b> · {m.o.tabela}{m.o.banco && m.o.banco !== m.p.banco ? ` · ${m.o.banco}` : ''}</div>
                    <div className="text-sm">Cliente recebe <b className="num">{brl(m.o.valor)}</b> · {m.o.prazo}x{m.o.parcela ? ` ${brl(m.o.parcela)}` : ''}</div>
                    <div className="text-sm text-green-700 dark:text-green-400">{ehAdmin ? 'Comissão' : 'Sua comissão'} <b className="num">{brl(m.o.comissao)}</b> ({m.o.comissao_pct?.toLocaleString('pt-BR')}%)</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1"><BotaoCopiar texto={textoCliente(prod, m.o)} />
                    <button className="bt bt-pri bt-sm" onClick={() => setAlvo({ parte: m.p.id, oferta: m.o })}>Digitar esta</button></div>
                  </section>
                );
              })()}
              <div className="grid gap-4 lg:grid-cols-3">
                {PARTES.filter(p => p.produto === prod).map(p => <CartaoBanco key={p.id} id={p.id} parte={vista!.partes[p.id]} digitar={(parte, oferta) => setAlvo({ parte, oferta })} />)}
              </div>
            </div>
          ))}
        </>
      )}
      {!consulta && !consultando && !erro && <Vazio>Cole um CPF e clique em Consultar.</Vazio>}
      {consulta && alvo && <Digitacao consulta={consulta} alvo={alvo} fechar={() => setAlvo(null)} />}
    </div>
  );
}
