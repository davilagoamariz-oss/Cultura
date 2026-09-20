import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider.jsx';
import { podeAcessar } from './auth/papeis.js';
import Layout from './Layout.jsx';
import Carregando from './Carregando.jsx';

/** Protege uma área: exige login, perfil válido e o papel certo. */
export function RequerPapel({ area }) {
  const { carregando, user, status, papel } = useAuth();

  if (carregando) return <Carregando texto="Carregando…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (status !== 'ok') return <Navigate to="/sem-acesso" replace />;
  if (!podeAcessar(papel, area)) return <Navigate to="/" replace />;

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
