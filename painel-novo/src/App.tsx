import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import { DadosProvider, useDados } from '@/estado/Dados';
import Layout, { podeVer, primeiraTela } from '@/componentes/Layout';
import { Carregando } from '@/componentes/ui';
import Login from '@/telas/Login';
import BI from '@/telas/bi/BI';
import Pipeline from '@/telas/pipeline/Pipeline';
import Clientes from '@/telas/clientes/Clientes';
import Conversas from '@/telas/conversas/Conversas';
import Motor from '@/telas/motor/Motor';
import Disparos from '@/telas/disparos/Disparos';
import Numeros from '@/telas/numeros/Numeros';
import Maturador from '@/telas/maturador/Maturador';
import Indicacoes from '@/telas/indicacoes/Indicacoes';
import Financeiro from '@/telas/financeiro/Financeiro';
import Usuarios from '@/telas/usuarios/Usuarios';
import Comissoes from '@/telas/comissoes/Comissoes';
import LeadsDoDia from '@/telas/leads/LeadsDoDia';

const TELAS: [string, () => ReactElement][] = [
  ['/bi', () => <BI />], ['/pipeline', () => <Pipeline />], ['/clientes', () => <Clientes />], ['/conversas', () => <Conversas />],
  ['/motor', () => <Motor />], ['/leads', () => <LeadsDoDia />], ['/disparos', () => <Disparos />], ['/numeros', () => <Numeros />], ['/maturador', () => <Maturador />],
  ['/indicacoes', () => <Indicacoes />], ['/financeiro', () => <Financeiro />], ['/usuarios', () => <Usuarios />], ['/comissoes', () => <Comissoes />],
];

function Rotas() {
  const { usuario, estado, erro } = useDados();
  if (!usuario) return <Login />;
  const inicio = primeiraTela(usuario.papel);
  return (
    <Routes>
      <Route element={<Layout />}>
        {TELAS.map(([caminho, tela]) => (
          <Route key={caminho} path={caminho + '/*'} element={
            !podeVer(usuario.papel, caminho) ? <Navigate to={inicio} replace />
              : erro && !estado ? <p className="text-sm text-red-600">Não foi possível carregar os dados: {erro}</p>
              : !estado ? <Carregando /> : tela()
          } />
        ))}
        <Route path="*" element={<Navigate to={inicio} replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <DadosProvider><Rotas /></DadosProvider>
    </BrowserRouter>
  );
}
