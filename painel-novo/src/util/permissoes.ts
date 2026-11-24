import type { Cliente, Estado, Usuario } from '@/api/tipos';

/** Atendente com escopo "proprios" só vê os clientes em que ele é o responsável. */
export const podeVerCliente = (u: Usuario, c: Cliente) => u.escopo === 'todos' || c.responsavel === u.id;
export const clientesVisiveis = (e: Estado, u: Usuario) => (u.escopo === 'todos' ? e.clientes : e.clientes.filter(c => podeVerCliente(u, c)));

/** Quem pode escrever nota interna (todos da equipe veem as notas). */
export const podeEscreverNota = (u: Usuario) => u.papel === 'admin' || u.papel === 'gestor';
/** Quem cria, edita e apaga as mensagens prontas (todos podem usar). */
export const podeGerenciarRespostas = (u: Usuario) => u.papel === 'admin' || u.papel === 'gestor';
/** Quem escolhe o responsável por um cliente. */
export const podeDefinirResponsavel = (u: Usuario) => u.papel === 'admin' || u.papel === 'gestor';
