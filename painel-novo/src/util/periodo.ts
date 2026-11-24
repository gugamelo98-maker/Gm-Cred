export type Periodo = 'hoje' | '7d' | '30d' | 'mes' | 'mes_passado' | 'datas';
export const PERIODOS: { id: Periodo; nome: string }[] = [
  { id: 'hoje', nome: 'Hoje' }, { id: '7d', nome: '7 dias' }, { id: '30d', nome: '30 dias' },
  { id: 'mes', nome: 'Este mês' }, { id: 'mes_passado', nome: 'Mês passado' }, { id: 'datas', nome: 'Datas' },
];

/** Devolve [início, fim) em milissegundos */
export function intervalo(p: Periodo, de?: string, ate?: string): [number, number] {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const amanha = hoje.getTime() + 86400000;
  switch (p) {
    case 'hoje': return [hoje.getTime(), amanha];
    case '7d': return [hoje.getTime() - 6 * 86400000, amanha];
    case '30d': return [hoje.getTime() - 29 * 86400000, amanha];
    case 'mes': return [new Date(hoje.getFullYear(), hoje.getMonth(), 1).getTime(), amanha];
    case 'mes_passado': return [new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).getTime(), new Date(hoje.getFullYear(), hoje.getMonth(), 1).getTime()];
    case 'datas': {
      const a = de ? new Date(de + 'T00:00:00').getTime() : hoje.getTime();
      const b = ate ? new Date(ate + 'T00:00:00').getTime() + 86400000 : amanha;
      return [a, Math.max(a + 86400000, b)];
    }
  }
}

export const dentro = (isoStr: string | null, [a, b]: [number, number]) => {
  if (!isoStr) return false;
  const t = new Date(isoStr).getTime();
  return t >= a && t < b;
};

export function dias([a, b]: [number, number]): number[] {
  const xs: number[] = [];
  for (let t = a; t < b; t += 86400000) xs.push(t);
  return xs;
}
