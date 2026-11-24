import { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { useDados } from '@/estado/Dados';
import type { Cliente, Origem } from '@/api/tipos';
import { Etiqueta, Titulo, Vazio } from '@/componentes/ui';
import { brl, fmtCpf, fmtTel, tempoDesde } from '@/util/formato';
import { ORIGENS, nomeEtapa } from '@/util/rotulos';
import Ficha, { COR_ETAPA, nomeAtendente } from './Ficha';
import { clientesVisiveis } from '@/util/permissoes';

type Grupo = 'todos' | 'andamento' | 'com_margem' | 'humano' | 'sem_resp' | 'pagos' | 'perdidos' | 'sem_margem';
const GRUPOS: { id: Grupo; nome: string; filtro: (c: Cliente) => boolean }[] = [
  { id: 'todos', nome: 'Todos', filtro: () => true },
  { id: 'andamento', nome: 'Em atendimento', filtro: c => c.etapa !== 'perdido' && c.etapa !== 'posvenda' },
  { id: 'com_margem', nome: 'Com margem', filtro: c => c.margem != null && c.etapa !== 'posvenda' },
  { id: 'humano', nome: 'Com humano', filtro: c => c.atendente !== 'ia' },
  { id: 'sem_resp', nome: 'Sem responsável', filtro: c => !c.responsavel && c.etapa !== 'perdido' },
  { id: 'pagos', nome: 'Pagos', filtro: c => c.etapa === 'posvenda' },
  { id: 'sem_margem', nome: 'Sem margem', filtro: c => !!c.cpf && c.margem == null },
  { id: 'perdidos', nome: 'Perdidos', filtro: c => c.etapa === 'perdido' },
];
const PAGINA = 50;

function baixarCsv(cs: Cliente[]) {
  const col: [string, (c: Cliente) => unknown][] = [
    ['Nome', c => c.nome], ['Telefone', c => c.telefone], ['CPF', c => c.cpf], ['Produto', c => c.produto], ['Origem', c => ORIGENS[c.origem]],
    ['Etapa', c => nomeEtapa(c.etapa)], ['Situação', c => c.situacao], ['Margem', c => c.margem], ['Banco', c => c.banco],
    ['Valor liberado', c => c.valorLiberado], ['Prazo', c => c.prazo], ['Parcela', c => c.parcela], ['Comissão', c => c.comissao], ['Entrou em', c => c.entrouEm],
  ];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = '﻿' + [col.map(c => esc(c[0])).join(';'), ...cs.map(c => col.map(([, f]) => esc(f(c))).join(';'))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `clientes_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Clientes() {
  const { estado, usuario } = useDados();
  const visiveis = useMemo(() => clientesVisiveis(estado!, usuario!), [estado, usuario]);
  const [grupo, setGrupo] = useState<Grupo>('andamento');
  const [busca, setBusca] = useState('');
  const [origem, setOrigem] = useState<Origem | 'todas'>('todas');
  const [produto, setProduto] = useState<'todos' | 'CLT' | 'FGTS'>('todos');
  const [limite, setLimite] = useState(PAGINA);
  const [aberto, setAberto] = useState<Cliente | null>(null);

  const base = useMemo(() => {
    const q = busca.trim().toLowerCase(), qd = q.replace(/\D/g, '');
    return visiveis.filter(c => (origem === 'todas' || c.origem === origem) && (produto === 'todos' || c.produto === produto)
      && (!q || c.nome.toLowerCase().includes(q) || (qd.length >= 3 && (c.telefone.includes(qd) || (c.cpf ?? '').includes(qd)))));
  }, [visiveis, busca, origem, produto]);
  const filtro = GRUPOS.find(g => g.id === grupo)!.filtro;
  const lista = base.filter(filtro);

  return (
    <div>
      <Titulo titulo="Clientes" sub={usuario!.escopo === 'proprios' ? `${visiveis.length} clientes sob sua responsabilidade` : `${visiveis.length} clientes no cadastro`}
        acoes={<button className="bt" onClick={() => baixarCsv(lista)} disabled={!lista.length}><Download size={16} /> Exportar CSV ({lista.length})</button>} />

      <div className="mb-3 flex flex-wrap gap-1.5">
        {GRUPOS.filter(g => g.id !== 'sem_resp' || usuario!.escopo === 'todos').map(g => (
          <button key={g.id} onClick={() => { setGrupo(g.id); setLimite(PAGINA); }}
            className={`rounded-full border px-3 py-1 text-sm ${grupo === g.id ? 'border-marca bg-marca text-white' : 'border-borda bg-cartao text-suave hover:bg-fundo'}`}>
            {g.nome} <b className="num">{base.filter(g.filtro).length}</b>
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-apagado" />
          <input className="campo w-64 pl-9" placeholder="Nome, telefone ou CPF" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar" />
        </div>
        <select className="campo w-auto" value={origem} onChange={e => setOrigem(e.target.value as Origem | 'todas')} aria-label="Origem">
          <option value="todas">Todas as origens</option>{(Object.keys(ORIGENS) as Origem[]).map(o => <option key={o} value={o}>{ORIGENS[o]}</option>)}
        </select>
        <select className="campo w-auto" value={produto} onChange={e => setProduto(e.target.value as typeof produto)} aria-label="Produto">
          <option value="todos">CLT e FGTS</option><option value="CLT">Só CLT</option><option value="FGTS">Só FGTS</option>
        </select>
      </div>

      {!lista.length ? <Vazio>Nenhum cliente com esses filtros.</Vazio> : (
        <>
        <ul className="space-y-2 md:hidden">
          {lista.slice(0, limite).map(c => (
            <li key={c.id}>
              <button className="cartao w-full p-3 text-left" onClick={() => setAberto(c)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><div className="truncate font-medium">{c.nome}</div><div className="num text-xs text-apagado">{fmtTel(c.telefone)} · {c.produto} · {ORIGENS[c.origem]}</div></div>
                  <Etiqueta cor={COR_ETAPA[c.etapa]}>{nomeEtapa(c.etapa)}</Etiqueta>
                </div>
                <div className="mt-1 flex justify-between gap-2 text-xs text-suave"><span className="truncate">{c.situacao}</span><span className="num shrink-0">{c.valorLiberado ? brl(c.valorLiberado) : c.margem ? 'margem ' + brl(c.margem) : tempoDesde(c.ultimaMsgEm)}</span></div>
              </button>
            </li>
          ))}
          {lista.length > limite && <li className="text-center"><button className="bt" onClick={() => setLimite(l => l + PAGINA)}>Mostrar mais ({lista.length - limite})</button></li>}
        </ul>
        <div className="cartao hidden overflow-x-auto md:block">
          <table className="tabela">
            <thead><tr><th>Cliente</th><th>Etapa</th><th>Situação</th><th>CPF</th><th className="text-right">Margem</th><th className="text-right">Proposta</th><th>Origem</th><th>Responsável</th><th>Última msg</th></tr></thead>
            <tbody>
              {lista.slice(0, limite).map(c => (
                <tr key={c.id} className="cursor-pointer" onClick={() => setAberto(c)}>
                  <td><div className="font-medium">{c.nome}</div><div className="num text-xs text-apagado">{fmtTel(c.telefone)} · {c.produto}</div></td>
                  <td><Etiqueta cor={COR_ETAPA[c.etapa]}>{nomeEtapa(c.etapa)}</Etiqueta></td>
                  <td className="max-w-[220px] truncate text-suave">{c.situacao}</td>
                  <td className="num whitespace-nowrap">{c.cpf ? fmtCpf(c.cpf) : '—'}</td>
                  <td className="num text-right">{brl(c.margem)}</td>
                  <td className="num whitespace-nowrap text-right">{c.valorLiberado ? brl(c.valorLiberado) : '—'}</td>
                  <td className="whitespace-nowrap">{ORIGENS[c.origem]}</td>
                  <td className="whitespace-nowrap">{c.responsavel ? nomeAtendente(c.responsavel, estado!.usuarios) : <span className="text-apagado">—</span>}</td>
                  <td className="whitespace-nowrap text-apagado">{tempoDesde(c.ultimaMsgEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lista.length > limite && <div className="p-3 text-center"><button className="bt" onClick={() => setLimite(l => l + PAGINA)}>Mostrar mais ({lista.length - limite} restantes)</button></div>}
        </div>
        </>
      )}
      <Ficha cliente={aberto} fechar={() => setAberto(null)} />
    </div>
  );
}
