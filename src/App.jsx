import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SessaoProvider, useSessao } from './nucleo/Sessao.jsx';
import { rotaInicial } from './nucleo/papeis.js';
import { RequerArea } from './rotas.jsx';
import Login from './Login.jsx';
import SemAcesso from './SemAcesso.jsx';
import EscolherEmpresa from './EscolherEmpresa.jsx';
import Carregando from './Carregando.jsx';
import Campo from './campo/Campo.jsx';
import Gestao from './gestao/Gestao.jsx';
import Admin from './admin/Admin.jsx';
import Plataforma from './plataforma/Plataforma.jsx';

function Inicio() {
  const sessao = useSessao();
  if (sessao.carregando) return <Carregando />;
  if (!sessao.user) return <Navigate to="/login" replace />;
  if (sessao.status === 'ok') return <Navigate to={rotaInicial(sessao.papel)} replace />;
  if (sessao.status === 'escolher_empresa') return <Navigate to="/escolher-empresa" replace />;
  if (sessao.status === 'plataforma_apenas') return <Navigate to="/plataforma" replace />;
  return <Navigate to="/sem-acesso" replace />;
}

export default function App() {
  return (
    <SessaoProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/login" element={<Login />} />
          <Route path="/sem-acesso" element={<SemAcesso />} />
          <Route path="/escolher-empresa" element={<EscolherEmpresa />} />

          <Route element={<RequerArea area="campo" />}>
            <Route path="/campo" element={<Campo />} />
          </Route>
          <Route element={<RequerArea area="gestao" />}>
            <Route path="/gestao" element={<Gestao />} />
          </Route>
          <Route element={<RequerArea area="admin" />}>
            <Route path="/admin" element={<Admin />} />
          </Route>
          <Route element={<RequerArea area="plataforma" />}>
            <Route path="/plataforma" element={<Plataforma />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessaoProvider>
  );
}
