export const soDigitos = (s: string) => (s || '').replace(/\D/g, '');

export function validaCpf(cpf: string): boolean {
  const d = soDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  for (const t of [9, 10]) {
    let s = 0;
    for (let i = 0; i < t; i++) s += Number(d[i]) * (t + 1 - i);
    if ((s * 10) % 11 % 10 !== Number(d[t])) return false;
  }
  return true;
}

export const fmtCpf = (s: string | null) => {
  const d = soDigitos(s || '');
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : d;
};
export const mascaraCpf = (s: string) => {
  const d = soDigitos(s).slice(0, 11);
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};
export const fmtTel = (s: string) => {
  const d = soDigitos(s).replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return s || '—';
};
export const brl = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const brlCurto = (v: number) =>
  Math.abs(v) >= 1000 ? 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : brl(v);
export const num = (v: number) => v.toLocaleString('pt-BR');
export const pct = (v: number) => (Number.isFinite(v) ? (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' : '—');

export function tempoDesde(isoStr: string | null): string {
  if (!isoStr) return '—';
  const min = Math.max(0, Math.round((Date.now() - new Date(isoStr).getTime()) / 60000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.floor(min / 60)}h`;
  return `há ${Math.floor(min / 1440)}d`;
}
export const dataHora = (isoStr: string) => new Date(isoStr).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export const hora = (isoStr: string) => new Date(isoStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
export const dataCurta = (isoStr: string) => new Date(isoStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
