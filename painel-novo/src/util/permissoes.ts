import type { Cliente, Estado, Usuario } from '@/api/tipos';

/** Atendente com escopo "proprios" só vê os clientes em que ele é o responsável. */
export const podeVerCliente = (u: Usuario, c: Cliente) => u.escopo === 'todos' || c.responsavel === u.id;
export const clientesVisiveis = (e: Estado, u: Usuario) => (u.escopo === 'todos' ? e.clientes : e.clientes.filter(c => podeVerCliente(u, c)));

/** Só o administrador escreve nota interna (ao acompanhar o atendimento); o atendente lê. */
export const podeEscreverNota = (u: Usuario) => u.papel === 'admin';
/** Colaborador (atendente) vê e conecta só os números dele. */
export const numerosVisiveis = <N extends { dono: string | null }>(ns: N[], u: Usuario) => (u.papel === 'atendente' ? ns.filter(n => n.dono === u.id) : ns);
/** Quem cria, edita e apaga as mensagens prontas (todos podem usar). */
export const podeGerenciarRespostas = (u: Usuario) => u.papel === 'admin' || u.papel === 'gestor';
/** Quem escolhe o responsável por um cliente. */
export const podeDefinirResponsavel = (u: Usuario) => u.papel === 'admin' || u.papel === 'gestor';
