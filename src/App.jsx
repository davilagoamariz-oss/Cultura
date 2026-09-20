import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SessaoProvider, useSessao } from './nucleo/Sessao.jsx';
import { destinoDaRaiz } from './nucleo/acesso.js';
import { RequerEmpresa, RequerModulo, RequerAdminEmpresa, RequerPlataforma } from './rotas.jsx';
import Login from './Login.jsx';
import SemAcesso from './SemAcesso.jsx';
import EscolherEmpresa from './EscolherEmpresa.jsx';
import Carregando from './Carregando.jsx';
import Inicio from './paginas/Inicio.jsx';
import Fitossanidade from './modulos/fitossanidade/Fitossanidade.jsx';
import Admin from './admin/Admin.jsx';
import Plataforma from './plataforma/Plataforma.jsx';

/** "/" decide para onde ir depois do login. */
function Raiz() {
  const destino = destinoDaRaiz(useSessao());
  return destino ? <Navigate to={destino} replace /> : <Carregando />;
}

export default function App() {
  return (
    <SessaoProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Raiz />} />
          <Route path="/login" element={<Login />} />
          <Route path="/sem-acesso" element={<SemAcesso />} />
          <Route path="/escolher-empresa" element={<EscolherEmpresa />} />

          <Route element={<RequerEmpresa />}>
            <Route path="/inicio" element={<Inicio />} />
            <Route element={<RequerModulo modulo="fitossanidade" />}>
              <Route path="/fitossanidade" element={<Fitossanidade />} />
            </Route>
            <Route element={<RequerAdminEmpresa />}>
              <Route path="/admin" element={<Admin />} />
            </Route>
          </Route>

          <Route element={<RequerPlataforma />}>
            <Route path="/plataforma" element={<Plataforma />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessaoProvider>
  );
}
