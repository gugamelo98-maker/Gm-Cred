import type { CategoriaGasto, Etapa, Origem, Papel } from '@/api/tipos';

export const ETAPAS: { id: Etapa; nome: string; desc: string }[] = [
  { id: 'recepcao', nome: 'Recepção', desc: 'Respondeu, ainda sem CPF' },
  { id: 'simulacao', nome: 'Simulação', desc: 'Mandou o CPF, consultando' },
  { id: 'vendas', nome: 'Vendas', desc: 'Tem margem, negociando' },
  { id: 'formalizacao', nome: 'Formalização', desc: 'Proposta feita, falta assinar' },
  { id: 'posvenda', nome: 'Pós-venda', desc: 'Pago' },
  { id: 'perdido', nome: 'Perdidos', desc: 'Finalizados sem venda' },
];
export const nomeEtapa = (e: Etapa) => ETAPAS.find(x => x.id === e)?.nome ?? e;

export const ORIGENS: Record<Origem, string> = { disparo: 'Disparo', trafego: 'Tráfego pago', indicacao: 'Indicação', organico: 'Orgânico', leads_dia: 'Leads do dia' };

export const CATEGORIAS: Record<CategoriaGasto, string> = {
  disparos: 'Disparos / servidor', numeros: 'Números (chips)', trafego: 'Tráfego pago', bms: 'BMs Meta', equipe: 'Equipe', outros: 'Outros',
};

export const PAPEIS: Record<Papel, { nome: string; desc: string }> = {
  admin: { nome: 'Administrador', desc: 'Tudo, inclusive usuários e financeiro' },
  gestor: { nome: 'Gestor', desc: 'Tudo, menos usuários' },
  atendente: { nome: 'Atendente', desc: 'Pipeline, clientes, conversas, motor de crédito, leads do dia e o próprio número (sem disparos)' },
};
