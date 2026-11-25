import type {
  Anexo, Banco, Cliente, Disparo, Estado, Etapa, Gasto, Indicador, LeadDia, Maturador, Mensagem, Numero, RespostaPronta, ResultadoBanco, Usuario,
} from './tipos';

/**
 * Tudo que o painel pede ao backend. Hoje só existe a implementação de demonstração (demo.ts).
 * Para ligar no sistema de verdade, crie outra classe que implemente esta interface
 * chamando o backend novo e troque em api/index.ts — nenhuma tela precisa mudar.
 *
 * WhatsApp: o envio e o recebimento continuam no fluxo que já funciona no n8n com o Baileys próprio.
 * enviarMensagem / enviarMidia chamam um webhook desse fluxo; o n8n manda pelo Baileys e devolve a Mensagem.
 * Mídia recebida do cliente: o n8n baixa do Baileys, guarda num armazenamento e grava a Mensagem com midia.url.
 * Áudio gravado no painel chega como webm/ogg (voz = true): o fluxo envia como mensagem de voz (ptt).
 * Nota interna nunca passa pelo Baileys: é só gravada no banco.
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
  /** inicia conversa com um número (acha o cliente pelo telefone ou cria) e manda a primeira mensagem */
  novaConversa(telefone: string, nome: string, texto: string, autor: string): Promise<Cliente>;
  /** envia imagem, PDF, áudio ou vídeo para o cliente pelo WhatsApp; texto vira a legenda */
  enviarMidia(clienteId: string, anexo: Anexo, texto: string, autor: string): Promise<Mensagem>;
  /** nota interna: fica só no painel */
  adicionarNota(clienteId: string, texto: string, autor: string): Promise<Mensagem>;
  /** define o usuário responsável pelo cliente (null = sem responsável) */
  definirResponsavel(clienteId: string, responsavel: string | null): Promise<Cliente>;
  salvarResposta(r: Partial<RespostaPronta> & { id?: string }): Promise<RespostaPronta>;
  apagarResposta(id: string): Promise<void>;
  /** humano assume a conversa (a IA para de responder) ou devolve para a IA */
  assumirConversa(clienteId: string, atendente: string): Promise<Cliente>;
  finalizarConversa(clienteId: string, motivo: string, por: string): Promise<Cliente>;
  marcarLida(clienteId: string): Promise<void>;

  // Motor de crédito
  consultarCpf(cpf: string): Promise<ResultadoBanco[]>;
  simular(cpf: string, parcela: number | null, prazo: number | null, bancos: Banco[]): Promise<ResultadoBanco[]>;

  // WhatsApp
  salvarNumero(n: Partial<Numero> & { id: string }): Promise<Numero>;
  novoNumero(sessao: string, funcao: Numero['funcao'], dono: string | null): Promise<Numero>;
  excluirNumero(id: string): Promise<void>;
  qrCode(id: string): Promise<string>;
  salvarMaturador(m: Partial<Maturador>): Promise<Maturador>;
  salvarDisparo(d: Partial<Disparo> & { id?: string }): Promise<Disparo>;
  mudarStatusDisparo(id: string, status: Disparo['status']): Promise<Disparo>;
  duplicarDisparo(id: string): Promise<Disparo>;
  importarContatos(id: string, linhas: { nome: string; telefone: string }[]): Promise<Disparo>;

  // Leads do dia
  /** entrega ao colaborador o que falta da cota de hoje (Usuario.leadsPorDia menos o que já extraiu hoje).
   *  A cota é conferida no backend; o admin define a cota com salvarUsuario({ id, leadsPorDia }). */
  extrairLeads(por: string): Promise<LeadDia[]>;
  /** manda a primeira mensagem pelo número do colaborador (Numero.dono = por) e cria a conversa,
   *  que aparece em Conversas com o colaborador como responsável e atendente (a IA não responde) */
  chamarLead(id: string, texto: string, por: string): Promise<{ lead: LeadDia; cliente: Cliente; mensagem: Mensagem }>;

  // Gestão
  salvarIndicador(i: Partial<Indicador> & { id?: string }): Promise<Indicador>;
  pagarIndicador(id: string, valor: number): Promise<Indicador>;
  salvarGasto(g: Partial<Gasto> & { id?: string }): Promise<Gasto>;
  apagarGasto(id: string): Promise<void>;
  salvarUsuario(u: Partial<Usuario> & { id?: string; senha?: string }): Promise<Usuario>;
}
