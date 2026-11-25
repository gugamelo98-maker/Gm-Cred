import { useState, type FormEvent } from 'react';
import { useDados } from '@/estado/Dados';


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
          <img src="/simbolo.png" alt="" className="h-12 w-12 rounded-full" />
          <div><div className="font-semibold">GM Cred</div><div className="text-xs text-apagado">Entrar no painel</div></div>
        </div>
        <label className="rotulo" htmlFor="email">E-mail</label>
        <input id="email" className="campo mb-3" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required />
        <label className="rotulo" htmlFor="senha">Senha</label>
        <input id="senha" className="campo mb-4" type="password" autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} required />
        {erro && <p className="mb-3 text-sm text-red-600">{erro}</p>}
        <button className="bt bt-pri w-full" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}
