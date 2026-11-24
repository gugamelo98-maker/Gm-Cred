import { useState, type FormEvent } from 'react';
import { useDados } from '@/estado/Dados';
import { MODO_DEMO } from '@/api';

const DEMO = [
  ['dono@gmcred.com.br', 'Administrador'],
  ['larissa@gmcred.com.br', 'Gestor'],
  ['bianca@gmcred.com.br', 'Atendente'],
];

export default function Login() {
  const { entrar } = useDados();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(''); setEnviando(true);
    try { await entrar(email, senha); } catch (x) { setErro((x as Error).message); } finally { setEnviando(false); }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <form onSubmit={enviar} className="cartao w-full max-w-sm p-6">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-marca font-bold text-white">GM</div>
          <div><div className="font-semibold">GM Cred</div><div className="text-xs text-apagado">Entrar no painel</div></div>
        </div>
        <label className="rotulo" htmlFor="email">E-mail</label>
        <input id="email" className="campo mb-3" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required />
        <label className="rotulo" htmlFor="senha">Senha</label>
        <input id="senha" className="campo mb-4" type="password" autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} />
        {erro && <p className="mb-3 text-sm text-red-600">{erro}</p>}
        <button className="bt bt-pri w-full" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        {MODO_DEMO && (
          <div className="mt-5 border-t border-borda pt-4 text-xs text-apagado">
            <p className="mb-2">Demonstração: qualquer senha. Entrar como:</p>
            <div className="flex flex-wrap gap-1">
              {DEMO.map(([e, p]) => <button type="button" key={e} className="bt bt-sm" onClick={() => setEmail(e)}>{p}</button>)}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
