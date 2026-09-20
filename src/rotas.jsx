import { Navigate, Outlet } from 'react-router-dom';
import { useSessao } from './nucleo/Sessao.jsx';
import { podeAcessar } from './nucleo/papeis.js';
import Layout from './Layout.jsx';
import Carregando from './Carregando.jsx';

/**
 * Protege uma área do app. Isto é só conforto de navegação: quem barra o acesso de verdade são as
 * firestore.rules. Áreas de empresa: campo, gestao, admin. Área da plataforma: plataforma.
 */
export function RequerArea({ area }) {
  const sessao = useSessao();

  if (sessao.carregando) return <Carregando texto="Carregando…" />;
  if (!sessao.user) return <Navigate to="/login" replace />;

  if (area === 'plataforma') {
    return sessao.ehPlataforma ? (
      <Layout>
        <Outlet />
      </Layout>
    ) : (
      <Navigate to="/" replace />
    );
  }

  if (sessao.status === 'escolher_empresa') return <Navigate to="/escolher-empresa" replace />;
  if (sessao.status === 'plataforma_apenas') return <Navigate to="/plataforma" replace />;
  if (sessao.status !== 'ok') return <Navigate to="/sem-acesso" replace />;
  if (!podeAcessar(sessao.papel, area)) return <Navigate to="/" replace />;

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
