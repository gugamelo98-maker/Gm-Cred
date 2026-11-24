import type {
  Banco, Cliente, Disparo, Estado, Etapa, Gasto, Indicador, Maturador, Mensagem, Numero, ResultadoBanco, Usuario,
} from './tipos';

/**
 * Tudo que o painel pede ao backend. Hoje só existe a implementação de demonstração (demo.ts).
 * Para ligar no sistema de verdade, crie outra classe que implemente esta interface
 * chamando o backend novo e troque em api/index.ts — nenhuma tela precisa mudar.
 */
export interface Api {
  entrar(email: string, senha: string): Promise<Usuario>;
  estado(): Promise<Estado>;

  // Pipeline / Clientes
  moverCliente(clienteId: string, para: Etapa, por: string): Promise<Cliente>;
  salvarCliente(cliente: Partial<Cliente> & { id: string }): Promise<Cliente>;

  // Conversas
  mensagens(clienteId: string): Promise<Mensagem[]>;
  enviarMensagem(clienteId: string, texto: string, autor: string): Promise<Mensagem>;
  /** humano assume a conversa (a IA para de responder) ou devolve para a IA */
  assumirConversa(clienteId: string, atendente: string): Promise<Cliente>;
  finalizarConversa(clienteId: string, motivo: string, por: string): Promise<Cliente>;
  marcarLida(clienteId: string): Promise<void>;

  // Motor de crédito
  consultarCpf(cpf: string): Promise<ResultadoBanco[]>;
  simular(cpf: string, parcela: number | null, prazo: number | null, bancos: Banco[]): Promise<ResultadoBanco[]>;

  // WhatsApp
  salvarNumero(n: Partial<Numero> & { id: string }): Promise<Numero>;
  novoNumero(sessao: string, funcao: Numero['funcao']): Promise<Numero>;
  excluirNumero(id: string): Promise<void>;
  qrCode(id: string): Promise<string>;
  salvarMaturador(m: Partial<Maturador>): Promise<Maturador>;
  salvarDisparo(d: Partial<Disparo> & { id?: string }): Promise<Disparo>;
  mudarStatusDisparo(id: string, status: Disparo['status']): Promise<Disparo>;
  duplicarDisparo(id: string): Promise<Disparo>;
  importarContatos(id: string, linhas: { nome: string; telefone: string }[]): Promise<Disparo>;

  // Gestão
  salvarIndicador(i: Partial<Indicador> & { id?: string }): Promise<Indicador>;
  pagarIndicador(id: string, valor: number): Promise<Indicador>;
  salvarGasto(g: Partial<Gasto> & { id?: string }): Promise<Gasto>;
  apagarGasto(id: string): Promise<void>;
  salvarUsuario(u: Partial<Usuario> & { id?: string }): Promise<Usuario>;
}
