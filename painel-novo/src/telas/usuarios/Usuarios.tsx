import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useDados } from '@/estado/Dados';
import { api } from '@/api';
import type { Papel, Usuario } from '@/api/tipos';
import { Etiqueta, Modal, Titulo } from '@/componentes/ui';
import { tempoDesde } from '@/util/formato';
import { PAPEIS } from '@/util/rotulos';

export default function Usuarios() {
  const { estado, usuario: eu, trocar, executar, avisar } = useDados();
  const [editando, setEditando] = useState<(Partial<Usuario> & { senha?: string }) | null>(null);
  const U = estado!.usuarios;
  const atendendo = (id: string) => estado!.clientes.filter(c => c.atendente === id && c.etapa !== 'perdido').length;

  async function salvar() {
    const u = editando!;
    if (!u.nome?.trim() || !/^\S+@\S+\.\S+$/.test(u.email ?? '')) return avisar('Preencha nome e um e-mail válido', 'erro');
    if (!u.id && (u.senha ?? '').length < 6) return avisar('Defina uma senha com pelo menos 6 caracteres', 'erro');
    if (u.id === eu!.id && (u.papel !== 'admin' || !u.ativo)) return avisar('Você não pode tirar o seu próprio acesso de administrador', 'erro');
    const r = await executar(() => api.salvarUsuario(u), u.id ? 'Usuário atualizado' : 'Usuário criado — ele entra com este e-mail e a senha definida');
    if (r) { trocar('usuarios', r); setEditando(null); }
  }

  return (
    <div>
      <Titulo titulo="Usuários" sub="Quem pode entrar no painel e o que cada um vê." acoes={<button className="bt bt-pri" onClick={() => setEditando({ papel: 'atendente', escopo: 'proprios', ativo: true })}><Plus size={16} /> Novo usuário</button>} />
      <div className="mb-5 grid gap-3 md:grid-cols-3">
        {(Object.keys(PAPEIS) as Papel[]).map(p => (
          <div key={p} className="cartao p-4"><div className="font-medium">{PAPEIS[p].nome} <span className="num text-apagado">· {U.filter(u => u.papel === p && u.ativo).length}</span></div><p className="text-xs text-apagado">{PAPEIS[p].desc}</p></div>
        ))}
      </div>
      <div className="cartao overflow-x-auto">
        <table className="tabela">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Tipo</th><th>Vê</th><th>Situação</th><th className="text-right">Clientes dele</th><th className="text-right">Atendendo agora</th><th>Último acesso</th></tr></thead>
          <tbody>{U.map(u => (
            <tr key={u.id} className="cursor-pointer" onClick={() => setEditando({ ...u, senha: '' })}>
              <td className="font-medium">{u.nome}{u.id === eu!.id && <span className="text-apagado"> (você)</span>}</td><td>{u.email}</td>
              <td>{PAPEIS[u.papel].nome}</td><td className="whitespace-nowrap">{u.escopo === 'proprios' ? 'Só os dele' : 'Tudo'}</td><td><Etiqueta cor={u.ativo ? 'verde' : 'cinza'}>{u.ativo ? 'Ativo' : 'Desativado'}</Etiqueta></td>
              <td className="num text-right">{estado!.clientes.filter(c => c.responsavel === u.id && c.etapa !== 'perdido').length}</td><td className="num text-right">{atendendo(u.id)}</td><td className="text-apagado">{u.ultimoAcesso ? tempoDesde(u.ultimoAcesso) : 'nunca'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <Modal aberto={!!editando} fechar={() => setEditando(null)} titulo={editando?.id ? 'Editar usuário' : 'Novo usuário'} largura="max-w-md"
        rodape={<><button className="bt" onClick={() => setEditando(null)}>Cancelar</button><button className="bt bt-pri" onClick={salvar}>Salvar</button></>}>
        {editando && (
          <div className="space-y-3">
            <div><label className="rotulo" htmlFor="un">Nome</label><input id="un" className="campo" value={editando.nome ?? ''} onChange={e => setEditando({ ...editando, nome: e.target.value })} /></div>
            <div><label className="rotulo" htmlFor="ue">E-mail (é o login)</label><input id="ue" type="email" className="campo" value={editando.email ?? ''} onChange={e => setEditando({ ...editando, email: e.target.value })} /></div>
            <fieldset><legend className="rotulo">Tipo de acesso</legend>
              {(Object.keys(PAPEIS) as Papel[]).map(p => (
                <label key={p} className="flex items-start gap-2 py-1 text-sm"><input type="radio" className="mt-1" checked={editando.papel === p} onChange={() => setEditando({ ...editando, papel: p, escopo: p === 'atendente' ? editando.escopo ?? 'proprios' : 'todos' })} />
                  <span><b className="font-medium">{PAPEIS[p].nome}</b><br /><span className="text-xs text-apagado">{PAPEIS[p].desc}</span></span></label>
              ))}
            </fieldset>
            <fieldset><legend className="rotulo">Quais conversas e clientes vê</legend>
              {([['proprios', 'Só os dele', 'Conversas, clientes e pipeline só dos clientes em que ele é o responsável'], ['todos', 'Todos', 'Vê as conversas e os clientes de toda a equipe']] as const).map(([v, n, d]) => (
                <label key={v} className="flex items-start gap-2 py-1 text-sm"><input type="radio" className="mt-1" checked={(editando.escopo ?? 'todos') === v} disabled={editando.papel !== 'atendente'} onChange={() => setEditando({ ...editando, escopo: v })} />
                  <span><b className="font-medium">{n}</b><br /><span className="text-xs text-apagado">{d}</span></span></label>
              ))}
              {editando.papel !== 'atendente' && <p className="text-xs text-apagado">Administrador e Gestor sempre veem tudo.</p>}
            </fieldset>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!editando.ativo} onChange={e => setEditando({ ...editando, ativo: e.target.checked })} /> Pode entrar no painel</label>
            <div><label className="rotulo" htmlFor="us">{editando.id ? 'Nova senha (deixe em branco para manter)' : 'Senha (mínimo 6 caracteres)'}</label>
              <input id="us" type="text" autoComplete="new-password" className="campo" value={editando.senha ?? ''} onChange={e => setEditando({ ...editando, senha: e.target.value })} /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
