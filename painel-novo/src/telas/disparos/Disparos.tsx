import { useState } from 'react';
import { Copy, Pause, Play, Plus, Square, Trash2, Upload } from 'lucide-react';
import { useDados } from '@/estado/Dados';
import { api } from '@/api';
import type { Disparo, MensagemDisparo } from '@/api/tipos';
import { Etiqueta, Modal, Titulo, Vazio, type Cor } from '@/componentes/ui';
import { dataHora, num, pct, soDigitos } from '@/util/formato';

const STATUS: Record<Disparo['status'], [string, Cor]> = { rascunho: ['Rascunho', 'cinza'], ativo: ['Enviando', 'verde'], pausado: ['Pausado', 'amarelo'], encerrado: ['Encerrado', 'azul'] };

function previa(t: string) {
  return t.replace(/\{nome\}/g, 'Maria').replace(/\{margem\}/g, 'R$ 412,50');
}

function Editor({ d, fechar }: { d: Disparo; fechar: () => void }) {
  const { estado, trocar, executar } = useDados();
  const [f, setF] = useState<Disparo>(d);
  const [importar, setImportar] = useState('');
  const editavel = f.status !== 'encerrado';
  const set = <K extends keyof Disparo>(k: K, v: Disparo[K]) => setF(x => ({ ...x, [k]: v }));
  const setMsg = (i: number, m: Partial<MensagemDisparo>) => set('mensagens', f.mensagens.map((x, j) => (j === i ? { ...x, ...m } : x)));
  const chips = estado!.numeros.filter(n => n.funcao === 'disparo');

  async function salvar() {
    const r = await executar(() => api.salvarDisparo(f), 'Disparo salvo');
    if (r) { trocar('disparos', r); fechar(); }
  }
  async function fazerImportacao() {
    const linhas = importar.split('\n').map(l => l.split(/[;,\t]/).map(x => x.trim())).map(p => (p.length > 1 ? { nome: p[0], telefone: soDigitos(p[1]) } : { nome: '', telefone: soDigitos(p[0]) })).filter(l => l.telefone.length >= 10);
    if (!linhas.length) return;
    const r = await executar(() => api.importarContatos(f.id, linhas), `${linhas.length} contatos importados`);
    if (r) { trocar('disparos', r); setF(x => ({ ...x, contatos: r.contatos, naFila: r.naFila })); setImportar(''); }
  }
  function lerArquivo(arq: File) { arq.text().then(t => setImportar(t)); }

  return (
    <Modal aberto fechar={fechar} titulo={d.nome} largura="max-w-3xl" rodape={<><button className="bt" onClick={fechar}>Cancelar</button><button className="bt bt-pri" onClick={salvar} disabled={!editavel}>Salvar</button></>}>
      <fieldset disabled={!editavel} className="space-y-5">
        <div><label className="rotulo" htmlFor="dn">Nome do disparo</label><input id="dn" className="campo" value={f.nome} onChange={e => set('nome', e.target.value)} /></div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Mensagens (teste A/B: cada contato recebe uma delas)</h3>
            {f.mensagens.length < 5 && <button type="button" className="bt bt-sm" onClick={() => set('mensagens', [...f.mensagens, { texto: '', variacoes: [], rodape: 'GM Cred', botoes: [] }])}><Plus size={14} /> Mensagem</button>}
          </div>
          <p className="mb-2 text-xs text-apagado">Use <code>{'{nome}'}</code> e <code>{'{margem}'}</code>. Variações são jeitos diferentes de dizer a mesma coisa (o sistema sorteia uma, para o WhatsApp não ver mensagens iguais).</p>
          <div className="space-y-3">
            {f.mensagens.map((m, i) => (
              <div key={i} className="rounded-lg border border-borda p-3">
                <div className="mb-2 flex items-center justify-between"><b className="text-sm">Mensagem {String.fromCharCode(65 + i)}</b>
                  {f.mensagens.length > 1 && <button type="button" className="text-apagado hover:text-red-600" onClick={() => set('mensagens', f.mensagens.filter((_, j) => j !== i))} aria-label="Remover mensagem"><Trash2 size={16} /></button>}
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_240px]">
                  <div className="space-y-2">
                    <textarea className="campo min-h-[80px]" value={m.texto} onChange={e => setMsg(i, { texto: e.target.value })} aria-label="Texto" />
                    {m.variacoes.map((v, j) => (
                      <div key={j} className="flex gap-1"><textarea className="campo min-h-[56px] text-xs" value={v} onChange={e => setMsg(i, { variacoes: m.variacoes.map((x, k) => (k === j ? e.target.value : x)) })} aria-label={`Variação ${j + 1}`} />
                        <button type="button" className="text-apagado hover:text-red-600" onClick={() => setMsg(i, { variacoes: m.variacoes.filter((_, k) => k !== j) })} aria-label="Remover variação"><Trash2 size={14} /></button></div>
                    ))}
                    <button type="button" className="bt bt-sm" onClick={() => setMsg(i, { variacoes: [...m.variacoes, ''] })}><Plus size={14} /> Variação</button>
                    <div className="grid grid-cols-2 gap-2">
                      <input className="campo" placeholder="Rodapé" value={m.rodape} onChange={e => setMsg(i, { rodape: e.target.value })} aria-label="Rodapé" />
                      <input className="campo" placeholder="Botões (separe com ;)" value={m.botoes.map(b => b.texto).join('; ')} aria-label="Botões"
                        onChange={e => setMsg(i, { botoes: e.target.value.split(';').map(t => t.trim()).filter(Boolean).slice(0, 3).map(texto => ({ tipo: 'resposta' as const, texto })) })} />
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#e7ddd3] p-3 dark:bg-[#0b141a]">
                    <div className="rounded-lg bg-white p-2 text-xs text-gray-900 shadow-sm dark:bg-[#202c33] dark:text-gray-100">
                      <div className="whitespace-pre-wrap">{previa(m.texto) || <span className="text-gray-400">Prévia…</span>}</div>
                      {m.rodape && <div className="mt-1 text-[10px] text-gray-500">{m.rodape}</div>}
                    </div>
                    {m.botoes.map(b => <div key={b.texto} className="mt-1 rounded-lg bg-white py-1.5 text-center text-xs font-medium text-sky-600 shadow-sm dark:bg-[#202c33]">{b.texto}</div>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Números que enviam</h3>
            {!chips.length ? <p className="text-sm text-apagado">Nenhum número com função “disparo”. Configure em Números.</p> : chips.map(n => (
              <label key={n.id} className="flex items-center gap-2 py-0.5 text-sm">
                <input type="checkbox" checked={f.numeros.includes(n.id)} onChange={e => set('numeros', e.target.checked ? [...f.numeros, n.id] : f.numeros.filter(x => x !== n.id))} />
                {n.sessao} <span className={n.estado === 'conectado' ? 'text-green-600' : 'text-red-600'}>· {n.estado === 'conectado' ? 'conectado' : n.estado.replace('_', ' ')}</span>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="rotulo" htmlFor="iv">Intervalo (s)</label><input id="iv" type="number" min={10} className="campo num" value={f.intervaloSeg} onChange={e => set('intervaloSeg', Number(e.target.value))} /></div>
            <div><label className="rotulo" htmlFor="hi">Começa (h)</label><input id="hi" type="number" min={0} max={23} className="campo num" value={f.horaInicio} onChange={e => set('horaInicio', Number(e.target.value))} /></div>
            <div><label className="rotulo" htmlFor="hf">Termina (h)</label><input id="hf" type="number" min={1} max={24} className="campo num" value={f.horaFim} onChange={e => set('horaFim', Number(e.target.value))} /></div>
            <p className="col-span-3 text-xs text-apagado">Cada número manda 1 mensagem a cada {f.intervaloSeg}s, das {f.horaInicio}h às {f.horaFim}h ({num(Math.max(0, Math.floor(((f.horaFim - f.horaInicio) * 3600) / Math.max(1, f.intervaloSeg))) * Math.max(1, f.numeros.length))} mensagens/dia com {f.numeros.length || 1} número(s)).</p>
          </div>
        </div>

        <div>
          <h3 className="mb-1 text-sm font-semibold">Lista de contatos <span className="font-normal text-apagado">· {num(f.contatos)} no total, {num(f.naFila)} na fila</span></h3>
          <textarea className="campo min-h-[70px] font-mono text-xs" placeholder={'Uma linha por contato: nome;telefone\nMaria Silva;48991234567'} value={importar} onChange={e => setImportar(e.target.value)} aria-label="Contatos para importar" />
          <div className="mt-2 flex gap-2">
            <label className="bt bt-sm cursor-pointer"><Upload size={14} /> Arquivo CSV<input type="file" accept=".csv,.txt" className="hidden" onChange={e => e.target.files?.[0] && lerArquivo(e.target.files[0])} /></label>
            <button type="button" className="bt bt-sm" onClick={fazerImportacao} disabled={!importar.trim()}>Importar para a fila</button>
          </div>
        </div>
      </fieldset>
    </Modal>
  );
}

export default function Disparos() {
  const { estado, trocar, executar } = useDados();
  const [editando, setEditando] = useState<Disparo | null>(null);

  async function status(d: Disparo, s: Disparo['status']) {
    if (s === 'ativo' && !d.numeros.length) return alert('Escolha pelo menos um número antes de começar.');
    if (s === 'ativo' && !d.naFila) return alert('A fila está vazia. Importe contatos primeiro.');
    if (s === 'encerrado' && !confirm(`Encerrar “${d.nome}”? Quem ainda está na fila não recebe mais.`)) return;
    const r = await executar(() => api.mudarStatusDisparo(d.id, s), { ativo: 'Disparo começou', pausado: 'Disparo pausado', encerrado: 'Disparo encerrado', rascunho: '' }[s]);
    if (r) trocar('disparos', r);
  }
  async function novo() { const r = await executar(() => api.salvarDisparo({})); if (r) { trocar('disparos', r); setEditando(r); } }
  async function duplicar(d: Disparo) { const r = await executar(() => api.duplicarDisparo(d.id), 'Cópia criada (sem a lista)'); if (r) trocar('disparos', r); }

  return (
    <div>
      <Titulo titulo="Disparos" sub="Envio pelos chips do servidor Baileys próprio, orquestrado pelo n8n. Respostas entram nas Conversas e no Pipeline."
        acoes={<button className="bt bt-pri" onClick={novo}><Plus size={16} /> Novo disparo</button>} />
      {!estado!.disparos.length ? <Vazio>Nenhum disparo ainda.</Vazio> : (
        <div className="space-y-3">
          {estado!.disparos.map(d => {
            const [nome, cor] = STATUS[d.status];
            const prog = d.contatos ? d.enviadas / d.contatos : 0;
            return (
              <section key={d.id} className="cartao p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button className="min-w-0 text-left" onClick={() => setEditando(d)}>
                    <div className="flex items-center gap-2"><h2 className="font-semibold">{d.nome}</h2><Etiqueta cor={cor}>{nome}</Etiqueta></div>
                    <p className="text-xs text-apagado">Criado {dataHora(d.criadoEm)} · {d.mensagens.length} mensagem(ns) · {d.numeros.length} número(s) · {d.horaInicio}h–{d.horaFim}h</p>
                  </button>
                  <div className="flex flex-wrap gap-1.5">
                    {(d.status === 'rascunho' || d.status === 'pausado') && <button className="bt bt-sm bt-pri" onClick={() => status(d, 'ativo')}><Play size={14} /> {d.status === 'pausado' ? 'Continuar' : 'Começar'}</button>}
                    {d.status === 'ativo' && <button className="bt bt-sm" onClick={() => status(d, 'pausado')}><Pause size={14} /> Pausar</button>}
                    {(d.status === 'ativo' || d.status === 'pausado') && <button className="bt bt-sm" onClick={() => status(d, 'encerrado')}><Square size={14} /> Encerrar</button>}
                    <button className="bt bt-sm" onClick={() => duplicar(d)}><Copy size={14} /> Duplicar</button>
                    <button className="bt bt-sm" onClick={() => setEditando(d)}>{d.status === 'encerrado' ? 'Ver' : 'Editar'}</button>
                  </div>
                </div>
                {d.contatos > 0 && (
                  <>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-fundo" role="progressbar" aria-valuenow={Math.round(prog * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do envio">
                      <div className="h-full rounded-full" style={{ width: `${prog * 100}%`, background: 'var(--serie-1)' }} />
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-3 text-sm sm:grid-cols-7">
                      {([['Contatos', d.contatos], ['Na fila', d.naFila], ['Enviadas', d.enviadas], ['Entregues', d.entregues], ['Responderam', d.responderam], ['Mandaram CPF', d.mandaramCpf], ['Bloquearam', d.bloquearam]] as [string, number][]).map(([r, v]) => (
                        <div key={r}><dt className="text-xs text-apagado">{r}</dt><dd className="num font-semibold">{num(v)}</dd></div>
                      ))}
                    </dl>
                    <p className="mt-1 text-xs text-apagado">Resposta {pct(d.entregues ? d.responderam / d.entregues : NaN)} das entregues · CPF {pct(d.responderam ? d.mandaramCpf / d.responderam : NaN)} de quem respondeu</p>
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}
      {editando && <Editor d={editando} fechar={() => setEditando(null)} />}
    </div>
  );
}
