// Contrato de dados do painel novo.
// O backend novo (seja n8n, Baileys próprio ou outro) precisa entregar exatamente estes formatos.
// Datas são sempre ISO 8601 (string). Valores em reais (number).

export type Etapa = 'recepcao' | 'simulacao' | 'vendas' | 'formalizacao' | 'posvenda' | 'perdido';
export type Origem = 'disparo' | 'trafego' | 'indicacao' | 'organico';
export type Produto = 'CLT' | 'FGTS';
export type Banco = 'V8' | 'Unno' | 'HUB';
export type Papel = 'admin' | 'gestor' | 'atendente';

export interface MudancaEtapa {
  em: string;
  de: Etapa | null;
  para: Etapa;
  /** 'ia' quando a própria IA mudou, ou o id do usuário que arrastou no pipeline */
  por: string;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  cpf: string | null;
  produto: Produto;
  origem: Origem;
  /** id do disparo, do indicador etc. que trouxe o cliente */
  origemRef: string | null;
  etapa: Etapa;
  /** texto curto do ponto em que a conversa parou, ex.: "Aguardando assinatura" */
  situacao: string;
  etiqueta: string | null;
  margem: number | null;
  banco: Banco | null;
  valorLiberado: number | null;
  parcela: number | null;
  prazo: number | null;
  comissao: number | null;
  /** quem atende agora: 'ia' ou o id de um usuário */
  atendente: string;
  /** usuário dono do cliente (o atendente com escopo 'proprios' só vê os clientes dele); null = sem responsável */
  responsavel: string | null;
  numeroId: string;
  naoLidas: number;
  // marcos do funil (usados pelo BI)
  entrouEm: string;
  cpfEm: string | null;
  margemEm: string | null;
  propostaEm: string | null;
  pagoEm: string | null;
  ultimaMsgEm: string;
  historico: MudancaEtapa[];
}

export type TipoMidia = 'imagem' | 'documento' | 'audio' | 'video';

export interface Midia {
  tipo: TipoMidia;
  /** endereço para abrir/baixar. No backend real: URL assinada do armazenamento */
  url: string;
  nome: string;
  mime: string;
  tamanho: number;
  /** só áudio/vídeo */
  duracaoSeg?: number;
  /** áudio gravado no painel ou mensagem de voz do WhatsApp (o servidor converte para ogg/opus ao enviar) */
  voz?: boolean;
}

export interface Mensagem {
  id: string;
  clienteId: string;
  /** 'nota' = nota interna: só a equipe vê, nunca vai para o WhatsApp */
  de: 'cliente' | 'ia' | 'humano' | 'nota';
  /** id do usuário quando de = 'humano' ou 'nota' */
  autor: string | null;
  /** texto da mensagem, ou legenda quando tem mídia */
  texto: string;
  midia: Midia | null;
  em: string;
  status: 'enviando' | 'enviada' | 'entregue' | 'lida' | 'erro' | null;
}

export interface RespostaPronta {
  id: string;
  /** digitado depois da barra, ex.: cpf → /cpf */
  atalho: string;
  titulo: string;
  /** pode usar {nome} (primeiro nome do cliente) */
  texto: string;
}

/** arquivo escolhido no painel para enviar */
export interface Anexo {
  nome: string;
  mime: string;
  tamanho: number;
  /** conteúdo em data URL (base64) */
  dados: string;
  duracaoSeg?: number;
  voz?: boolean;
}

export interface Numero {
  id: string;
  /** nome da sessão no servidor de WhatsApp (Baileys), ex.: gmcred-3 */
  sessao: string;
  telefone: string;
  nomePerfil: string;
  funcao: 'atendimento' | 'disparo' | 'reserva';
  estado: 'conectado' | 'aguardando_qr' | 'caiu' | 'parado';
  aparelho: string;
  enviadasHoje: number;
  entreguesHoje: number;
  falhasHoje: number;
  maturar: boolean;
  /** trava do WhatsApp para iniciar conversa; null = sem trava */
  travaAte: string | null;
  conectadoDesde: string | null;
}

export interface Maturador {
  ativo: boolean;
  intervaloMin: number;
  horaInicio: number;
  horaFim: number;
  ultimas: { em: string; de: string; para: string; texto: string }[];
}

export interface MensagemDisparo {
  texto: string;
  variacoes: string[];
  rodape: string;
  botoes: { tipo: 'resposta' | 'link'; texto: string; url?: string }[];
}

export interface Disparo {
  id: string;
  nome: string;
  status: 'rascunho' | 'ativo' | 'pausado' | 'encerrado';
  mensagens: MensagemDisparo[];
  numeros: string[];
  intervaloSeg: number;
  horaInicio: number;
  horaFim: number;
  criadoEm: string;
  contatos: number;
  naFila: number;
  enviadas: number;
  entregues: number;
  responderam: number;
  mandaramCpf: number;
  bloquearam: number;
}

export interface Indicador {
  id: string;
  nome: string;
  telefone: string;
  codigo: string;
  pix: string;
  indicacoes: number;
  fechadas: number;
  /** valor por venda fechada */
  premio: number;
  pago: number;
}

export type CategoriaGasto = 'disparos' | 'numeros' | 'trafego' | 'bms' | 'equipe' | 'outros';

export interface Gasto {
  id: string;
  data: string;
  categoria: CategoriaGasto;
  descricao: string;
  valor: number;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  /** 'proprios' = só vê as conversas e os clientes em que é o responsável */
  escopo: 'todos' | 'proprios';
  ativo: boolean;
  ultimoAcesso: string | null;
}

export interface Oferta {
  prazo: number;
  parcela: number;
  valorLiberado: number;
  taxaMes: number;
  comSeguro: boolean;
  /** % de comissão para a GM Cred nessa tabela */
  comissaoPct: number;
}

export interface ResultadoBanco {
  banco: Banco;
  status: 'ok' | 'sem_margem' | 'erro' | 'precisa_dados';
  mensagem: string;
  margem: number | null;
  ofertas: Oferta[];
}

/** Tudo que o painel carrega de uma vez (equivalente ao /escritorio/estado de hoje) */
export interface Estado {
  clientes: Cliente[];
  numeros: Numero[];
  maturador: Maturador;
  disparos: Disparo[];
  indicadores: Indicador[];
  gastos: Gasto[];
  usuarios: Usuario[];
  respostas: RespostaPronta[];
}
