import type { Api } from './contrato';
import { demoApi } from './demo';
import { painel } from './painel';

// Login e usuários já são de verdade (banco); o resto das abas ainda usa a implementação local.
export const api: Api = {
  ...demoApi,
  entrar: (email, senha) => painel.entrar(email, senha),
  async estado() {
    const [e, usuarios] = await Promise.all([demoApi.estado(), painel.listar()]);
    return { ...e, usuarios };
  },
  salvarUsuario: u => painel.salvar(u),
};
export const MODO_DEMO = true;
export * from './tipos';
