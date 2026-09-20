import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider.jsx';
import { rotaInicial } from './auth/papeis.js';
import { RequerPapel } from './rotas.jsx';
import Login from './Login.jsx';
import SemAcesso from './SemAcesso.jsx';
import Carregando from './Carregando.jsx';
import Campo from './campo/Campo.jsx';
import Gestor from './gestor/Gestor.jsx';
import Admin from './admin/Admin.jsx';

function Inicio() {
  const { carregando, user, status, papel } = useAuth();
  if (carregando) return <Carregando />;
  if (!user) return <Navigate to="/login" replace />;
  if (status !== 'ok') return <Navigate to="/sem-acesso" replace />;
  return <Navigate to={rotaInicial(papel)} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/login" element={<Login />} />
          <Route path="/sem-acesso" element={<SemAcesso />} />

          <Route element={<RequerPapel area="campo" />}>
            <Route path="/campo" element={<Campo />} />
          </Route>
          <Route element={<RequerPapel area="gestor" />}>
            <Route path="/gestor" element={<Gestor />} />
          </Route>
          <Route element={<RequerPapel area="admin" />}>
            <Route path="/admin" element={<Admin />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
