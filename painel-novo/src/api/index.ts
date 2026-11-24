import type { Api } from './contrato';
import { demoApi } from './demo';

// Ponto único de troca: quando o backend novo existir, troque demoApi pela implementação real.
export const api: Api = demoApi;
export const MODO_DEMO = true;
export * from './tipos';
