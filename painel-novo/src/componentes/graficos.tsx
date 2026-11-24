import { useEffect, useRef, useState, type ReactNode } from 'react';
import { num, pct } from '@/util/formato';

function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.floor(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function passos(max: number) {
  if (max <= 0) return [0, 1];
  const bruto = max / 4, mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const passo = [1, 2, 2.5, 5, 10].map(m => m * mag).find(p => p >= bruto)!;
  const topo = Math.ceil(max / passo) * passo;
  return Array.from({ length: Math.round(topo / passo) + 1 }, (_, i) => i * passo);
}

export function Dica({ x, y, largura, children }: { x: number; y: number; largura: number; children: ReactNode }) {
  const esquerda = x > largura - 180;
  return (
    <div className="pointer-events-none absolute z-10 min-w-[150px] rounded-lg border border-borda bg-cartao px-3 py-2 text-xs shadow-lg"
      style={{ top: y, left: esquerda ? undefined : x + 12, right: esquerda ? largura - x + 12 : undefined }}>
      {children}
    </div>
  );
}

/** Funil horizontal: uma barra por etapa, uma cor só (é a mesma medida em todas as etapas). */
export function Funil({ etapas }: { etapas: { nome: string; valor: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const topo = etapas[0]?.valor || 0;
  return (
    <div className="space-y-2.5" onMouseLeave={() => setHover(null)}>
      {etapas.map((e, i) => {
        const ant = i ? etapas[i - 1].valor : e.valor;
        // a barra usa no máximo 62% da largura, para o rótulo caber sempre do lado de fora
        const w = topo ? (e.valor / topo) * 62 : 0;
        return (
          <div key={e.nome} className="grid grid-cols-[110px_1fr] items-center gap-3 sm:grid-cols-[140px_1fr]" onMouseEnter={() => setHover(i)}>
            <div className="text-sm text-suave">{e.nome}</div>
            <div className="flex h-8 items-center gap-2">
              <div className="h-full shrink-0 transition-opacity" style={{ width: `max(${w}%, 4px)`, background: 'var(--serie-1)', borderRadius: '0 4px 4px 0', opacity: hover == null || hover === i ? 1 : 0.55 }} />
              <div className="num flex min-w-0 items-baseline gap-1.5 whitespace-nowrap text-sm">
                <b>{num(e.valor)}</b>
                <span className="truncate text-xs text-apagado">{i ? `${pct(ant ? e.valor / ant : 0)} da anterior` : ''}</span>
              </div>
            </div>
          </div>
        );
      })}
      {topo > 0 && <p className="pt-1 text-xs text-apagado">Conversão total (entrou → pago): <b className="num text-texto">{pct((etapas.at(-1)?.valor ?? 0) / topo)}</b></p>}
    </div>
  );
}

export interface Serie { nome: string; cor: string; valores: number[] }

/** Linhas por dia (mesma escala para todas as séries — nunca dois eixos). */
export function Linhas({ rotulos, series, altura = 240 }: { rotulos: string[]; series: Serie[]; altura?: number }) {
  const [ref, w] = useLargura<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const m = { t: 12, r: 112, b: 26, l: 36 };
  const iw = w - m.l - m.r, ih = altura - m.t - m.b;
  const max = Math.max(1, ...series.flatMap(s => s.valores));
  const ticks = passos(max), topo = ticks.at(-1)!;
  const n = rotulos.length;
  const x = (i: number) => m.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => m.t + ih - (v / topo) * ih;
  const cadaQuantos = Math.ceil(n / Math.max(2, Math.floor(iw / 60)));

  // rótulos diretos no fim das linhas, sem sobrepor
  const fins = series.map(s => ({ s, y: y(s.valores.at(-1) ?? 0) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < fins.length; i++) if (fins[i].y - fins[i - 1].y < 14) fins[i].y = fins[i - 1].y + 14;

  function mover(ev: React.PointerEvent<SVGRectElement>) {
    const r = (ev.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = ev.clientX - r.left;
    setHover(Math.max(0, Math.min(n - 1, Math.round(n <= 1 ? 0 : (px / r.width) * (n - 1)))));
  }

  return (
    <div ref={ref} className="relative">
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-suave">
        {series.map(s => <span key={s.nome} className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 rounded" style={{ background: s.cor }} />{s.nome}</span>)}
      </div>
      <svg width={w} height={altura} role="img" aria-label={`Gráfico de linhas: ${series.map(s => s.nome).join(', ')}`}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={m.l} x2={m.l + iw} y1={y(t)} y2={y(t)} stroke="var(--grade)" />
            <text x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--apagado)" className="num">{num(t)}</text>
          </g>
        ))}
        {rotulos.map((r, i) => (i % cadaQuantos === 0 || i === n - 1) && (
          <text key={i} x={x(i)} y={altura - 6} textAnchor="middle" fontSize={11} fill="var(--apagado)">{r}</text>
        ))}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={m.t + ih} stroke="var(--apagado)" strokeDasharray="3 3" />}
        {series.map(s => (
          <path key={s.nome} d={s.valores.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('')} fill="none" stroke={s.cor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {hover != null && series.map(s => <circle key={s.nome} cx={x(hover)} cy={y(s.valores[hover])} r={4.5} fill={s.cor} stroke="var(--cartao)" strokeWidth={2} />)}
        {fins.map(({ s, y: yy }) => (
          <text key={s.nome} x={m.l + iw + 8} y={yy} dy="0.32em" fontSize={11} fill="var(--suave)">
            <tspan fontWeight={600} fill="var(--texto)" className="num">{num(s.valores.at(-1) ?? 0)}</tspan> {s.nome.length > 14 ? s.nome.slice(0, 13) + '…' : s.nome}
          </text>
        ))}
        <rect x={m.l} y={m.t} width={iw} height={ih} fill="transparent" onPointerMove={mover} onPointerLeave={() => setHover(null)} />
      </svg>
      {hover != null && (
        <Dica x={x(hover)} y={m.t + 24} largura={w}>
          <div className="mb-1 font-medium">{rotulos[hover]}</div>
          {series.map(s => (
            <div key={s.nome} className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 text-suave"><span className="inline-block h-2 w-2 rounded-full" style={{ background: s.cor }} />{s.nome}</span>
              <b className="num">{num(s.valores[hover])}</b>
            </div>
          ))}
        </Dica>
      )}
    </div>
  );
}
