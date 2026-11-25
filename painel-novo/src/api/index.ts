import type { Api } from './contrato';
import { realApi } from './real';

// Sistema de verdade: login, usuários, clientes, conversas, números, maturador, indicações, gastos e leads do dia.
export const api: Api = realApi;
export const MODO_DEMO = false;
export * from './tipos';
